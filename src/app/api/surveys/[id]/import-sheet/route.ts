import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurvey, getQuestionTemplates, upsertJigyotaiQuestions, upsertQuestionTemplates, withTransaction } from "@/lib/db";
import { parseStaffCSVDynamic, detectRespondentType } from "@/lib/csv-parser";
import type { QuestionDef } from "@/lib/csv-parser";
import { getStorageWriteGuardResponse } from "@/lib/storage-mode";
import { getJigyotaiQuestions } from "@/lib/jigyotai-questions";
import { QUESTIONS } from "@/lib/questions";
import { fetchSheetAsCSV } from "@/lib/google-sheets";

function buildAnswerInsert(
  responseId: number,
  answers: Array<{ questionId: number; score: number | null }>
) {
  return {
    sql: `INSERT INTO response_answers (response_id, question_id, score, skip_reason) VALUES ${answers
      .map(() => "(?, ?, ?, NULL)")
      .join(", ")}`,
    args: answers.flatMap((answer) => [responseId, answer.questionId, answer.score]),
  };
}

/**
 * 事業体サーベイの全タイプの質問テンプレートを準備して返す
 */
async function prepareJigyotaiQuestionsByType(
  surveyId: number
): Promise<Record<string, QuestionDef[]>> {
  const types = ["staff", "manager", "corporate"] as const;
  const result: Record<string, QuestionDef[]> = {};

  for (const t of types) {
    let templates = await getQuestionTemplates(surveyId, t);

    if (templates.length === 0) {
      // 未登録の場合はデフォルト質問を自動登録
      const defaults = getJigyotaiQuestions(t);
      await upsertJigyotaiQuestions(surveyId, t, defaults.map((q) => ({
        num: q.id,
        text: q.text,
        area: q.area,
        short_label: q.short,
        core_id: q.coreId,
        scale_type: q.isCompensation ? "compensation" : "agreement",
        skip_options: q.skip,
      })));
      templates = await getQuestionTemplates(surveyId, t);
    }

    result[t] = templates.map((tmpl) => ({
      templateId: tmpl.id,
      num: tmpl.num,
      staffText: tmpl.staff_text || "",
      directorText: tmpl.director_text || "",
      text: tmpl.text || "",
    }));
  }

  return result;
}

/**
 * クリニックサーベイの全タイプの質問テンプレートを準備して返す
 */
async function prepareClinicQuestionsByType(
  surveyId: number
): Promise<Record<string, QuestionDef[]>> {
  let templates = await getQuestionTemplates(surveyId);
  let clinicTemplates = templates.filter((t) => t.respondent_type === null);

  if (clinicTemplates.length === 0) {
    await upsertQuestionTemplates(surveyId, QUESTIONS.map((q) => ({
      num: q.num,
      staff_text: q.staffText,
      director_text: q.directorText,
      area: q.area,
      area_label: q.areaLabel,
      respondent_type: null,
      text: null,
      short_label: null,
      core_id: null,
      scale_type: "agreement",
      skip_options: null,
      question_key: q.questionKey,
      compare_key: q.compareKey,
    })));
    templates = await getQuestionTemplates(surveyId);
    clinicTemplates = templates.filter((t) => t.respondent_type === null);
  }

  const questionsForStaff: QuestionDef[] = clinicTemplates.map((t) => ({
    templateId: t.id,
    num: t.num,
    staffText: t.staff_text || "",
    directorText: "",
    text: t.staff_text || "",
  }));

  const questionsForDirector: QuestionDef[] = clinicTemplates.map((t) => ({
    templateId: t.id,
    num: t.num,
    staffText: "",
    directorText: t.director_text || "",
    text: t.director_text || "",
  }));

  // 共通のテンプレート（両方のテキストを含む）もフォールバック用に用意
  const questionsCommon: QuestionDef[] = clinicTemplates.map((t) => ({
    templateId: t.id,
    num: t.num,
    staffText: t.staff_text || "",
    directorText: t.director_text || "",
  }));

  return { staff: questionsForStaff, director: questionsForDirector, _common: questionsCommon };
}

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

    const body = await request.json();
    const { url } = body as { url: string };

    if (!url) {
      return NextResponse.json({ error: "スプレッドシートのURLが必要です" }, { status: 400 });
    }

    // Fetch CSV from Google Sheets
    const { csv: text } = await fetchSheetAsCSV(url);

    // 質問テンプレートを全タイプ分準備
    let questionsByType: Record<string, QuestionDef[]>;
    if (survey.survey_type === "jigyotai") {
      questionsByType = await prepareJigyotaiQuestionsByType(surveyId);
    } else {
      questionsByType = await prepareClinicQuestionsByType(surveyId);
    }

    // ヘッダーから回答者タイプを自動判定
    const detectionTargets = { ...questionsByType };
    delete detectionTargets._common; // 判定対象から共通テンプレートを除外
    const detected = detectRespondentType(text, detectionTargets);
    const respondentType = detected.type;

    // パース用の質問テンプレートを取得
    let questions: QuestionDef[];
    if (survey.survey_type === "jigyotai") {
      questions = questionsByType[respondentType] || questionsByType.staff;
    } else {
      // クリニックの場合は共通テンプレート（staffText+directorText両方含む）を使用
      questions = questionsByType._common || questionsByType.staff;
    }

    const result = parseStaffCSVDynamic(text, surveyId, questions);

    if (result.errors.length > 0 && result.responses.length === 0) {
      return NextResponse.json({ error: result.errors.join("; ") }, { status: 400 });
    }

    // Bulk insert in a single transaction
    const count = await withTransaction(async (tx) => {
      // Delete existing response_answers first (FK constraint), then responses
      if (survey.survey_type === "jigyotai") {
        await tx.execute({
          sql: "DELETE FROM response_answers WHERE response_id IN (SELECT id FROM responses WHERE survey_id = ? AND type = ? AND entity IS NOT NULL)",
          args: [surveyId, respondentType],
        });
        await tx.execute({
          sql: "DELETE FROM responses WHERE survey_id = ? AND type = ? AND entity IS NOT NULL",
          args: [surveyId, respondentType],
        });
      } else {
        await tx.execute({
          sql: "DELETE FROM response_answers WHERE response_id IN (SELECT id FROM responses WHERE survey_id = ? AND type = ? AND entity IS NULL)",
          args: [surveyId, respondentType],
        });
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

        if (resp.answers.length > 0) {
          await tx.execute(buildAnswerInsert(responseId, resp.answers));
        }
        inserted++;
      }
      return inserted;
    });

    return NextResponse.json({
      count,
      detectedType: respondentType,
      detectedMatchCount: detected.matchCount,
      matchedQuestions: result.matchedQuestions,
      totalQuestions: result.totalQuestions,
      totalRows: result.totalRows,
      mode: "replace",
      warnings: result.errors,
    });
  } catch (err) {
    console.error("Sheet import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
