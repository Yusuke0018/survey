import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurvey, getQuestionTemplates, execute, upsertJigyotaiQuestions, withTransaction } from "@/lib/db";
import { parseStaffCSVDynamic } from "@/lib/csv-parser";
import type { QuestionDef } from "@/lib/csv-parser";
import { getStorageWriteGuardResponse } from "@/lib/storage-mode";
import { getJigyotaiQuestions } from "@/lib/jigyotai-questions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const storageError = getStorageWriteGuardResponse();
    if (storageError) return storageError;

    const { id } = await params;
    const surveyId = parseInt(id);
    const survey = await getSurvey(surveyId);
    if (!survey) {
      return NextResponse.json({ error: "サーベイが見つかりません" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("csv") as File;
    const respondentType = (formData.get("type") as string) || "staff";
    if (!file) {
      return NextResponse.json({ error: "CSVファイルが必要です" }, { status: 400 });
    }

    const validTypes = survey.survey_type === "jigyotai"
      ? ["staff", "manager", "corporate"]
      : ["staff", "director"];
    if (!validTypes.includes(respondentType)) {
      return NextResponse.json({ error: `無効な回答者タイプ: ${respondentType}` }, { status: 400 });
    }

    let text: string;
    const buffer = await file.arrayBuffer();
    const utf8Text = new TextDecoder("utf-8").decode(buffer);
    text = utf8Text.includes("\uFFFD")
      ? new TextDecoder("shift_jis").decode(buffer)
      : utf8Text;

    // Fetch question templates
    const templates = await getQuestionTemplates(surveyId);

    let questions: QuestionDef[];
    if (survey.survey_type === "jigyotai") {
      const filtered = templates.filter((t) => t.respondent_type === respondentType);
      questions = filtered.map((t) => ({
        templateId: t.id,
        num: t.num,
        staffText: t.staff_text || "",
        directorText: t.director_text || "",
        text: t.text || "",
      }));

      if (questions.length === 0) {
        // Auto-register default jigyotai questions
        const defaults = getJigyotaiQuestions(respondentType as "staff" | "manager" | "corporate");
        await upsertJigyotaiQuestions(surveyId, respondentType, defaults.map((q) => ({
          num: q.id,
          text: q.text,
          area: q.area,
          short_label: q.short,
          core_id: q.coreId,
          scale_type: q.isCompensation ? "compensation" : "agreement",
          skip_options: q.skip,
        })));

        // Re-fetch templates after auto-registration
        const newTemplates = await getQuestionTemplates(surveyId, respondentType);
        questions = newTemplates.map((t) => ({
          templateId: t.id,
          num: t.num,
          staffText: t.staff_text || "",
          directorText: t.director_text || "",
          text: t.text || "",
        }));
      }
    } else {
      const filtered = templates.filter((t) => t.respondent_type === null);
      questions = filtered.map((t) => ({
        templateId: t.id,
        num: t.num,
        staffText: t.staff_text || "",
        directorText: t.director_text || "",
      }));
    }

    const result = parseStaffCSVDynamic(text, surveyId, questions);

    if (result.errors.length > 0 && result.responses.length === 0) {
      return NextResponse.json({ error: result.errors.join("; ") }, { status: 400 });
    }

    // Bulk insert in a single transaction
    const count = await withTransaction(async (tx) => {
      // Delete existing responses for this type
      if (survey.survey_type === "jigyotai") {
        await tx.execute({
          sql: "DELETE FROM responses WHERE survey_id = ? AND type = ? AND entity IS NOT NULL",
          args: [surveyId, respondentType],
        });
      } else {
        await tx.execute({
          sql: "DELETE FROM responses WHERE survey_id = ? AND type = ? AND entity IS NULL",
          args: [surveyId, respondentType],
        });
      }

      let inserted = 0;
      for (const resp of result.responses) {
        const insertRes = await tx.execute({
          sql: `INSERT INTO responses (survey_id, type, clinic, entity, respondent_name, free_text, session_token,
                  owner_provider, owner_subject, owner_email, owner_name)
                VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)`,
          args: [
            surveyId,
            respondentType,
            survey.survey_type === "clinic" ? resp.clinic : "",
            survey.survey_type === "jigyotai" ? (resp.entity || resp.clinic || "") : null,
            respondentType === "staff" ? (resp.respondentName || null) : null,
            resp.freeText || null,
          ],
        });
        const responseId = Number(insertRes.lastInsertRowid);
        for (const answer of resp.answers) {
          await tx.execute({
            sql: "INSERT INTO response_answers (response_id, question_id, score, skip_reason) VALUES (?, ?, ?, NULL)",
            args: [responseId, answer.questionId, answer.score],
          });
        }
        inserted++;
      }
      return inserted;
    });

    return NextResponse.json({
      count,
      matchedQuestions: result.matchedQuestions,
      totalQuestions: result.totalQuestions,
      totalRows: result.totalRows,
      mode: "replace",
      warnings: result.errors,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
