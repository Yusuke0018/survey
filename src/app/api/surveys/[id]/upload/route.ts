import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurvey, getQuestionTemplates, submitResponse, execute } from "@/lib/db";
import { parseStaffCSVDynamic } from "@/lib/csv-parser";
import type { QuestionDef } from "@/lib/csv-parser";
import { getStorageWriteGuardResponse } from "@/lib/storage-mode";

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
        return NextResponse.json({
          error: `この回答者タイプ(${respondentType})の質問テンプレートが未設定です。先に質問編集画面で質問を登録してください。`,
        }, { status: 400 });
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

    // Delete existing responses for this type
    if (survey.survey_type === "jigyotai") {
      await execute(
        "DELETE FROM responses WHERE survey_id = ? AND type = ? AND entity IS NOT NULL",
        [surveyId, respondentType]
      );
    } else {
      await execute(
        "DELETE FROM responses WHERE survey_id = ? AND type = ? AND entity IS NULL",
        [surveyId, respondentType]
      );
    }

    let count = 0;
    for (const resp of result.responses) {
      await submitResponse({
        surveyId,
        type: respondentType,
        clinic: survey.survey_type === "clinic" ? resp.clinic : undefined,
        entity: survey.survey_type === "jigyotai" ? (resp.entity || resp.clinic || "") : undefined,
        respondentName: respondentType === "staff" ? (resp.respondentName ?? undefined) : undefined,
        freeText: resp.freeText ?? undefined,
        answers: resp.answers,
      });
      count++;
    }

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
