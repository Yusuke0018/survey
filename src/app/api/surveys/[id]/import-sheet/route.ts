import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurvey, getQuestionTemplates, upsertJigyotaiQuestions, upsertQuestionTemplates, withTransaction } from "@/lib/db";
import { parseStaffCSVDynamic, detectRespondentType } from "@/lib/csv-parser";
import type { QuestionDef } from "@/lib/csv-parser";
import { getStorageWriteGuardResponse } from "@/lib/storage-mode";
import { getJigyotaiQuestions } from "@/lib/jigyotai-questions";
import { QUESTIONS } from "@/lib/questions";
import { fetchAllSheets } from "@/lib/google-sheets";
import type { SheetResult } from "@/lib/google-sheets";

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

async function prepareJigyotaiQuestionsByType(
  surveyId: number
): Promise<Record<string, QuestionDef[]>> {
  const types = ["staff", "manager", "corporate"] as const;
  const result: Record<string, QuestionDef[]> = {};

  for (const t of types) {
    let templates = await getQuestionTemplates(surveyId, t);

    if (templates.length === 0) {
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

  const questionsCommon: QuestionDef[] = clinicTemplates.map((t) => ({
    templateId: t.id,
    num: t.num,
    staffText: t.staff_text || "",
    directorText: t.director_text || "",
  }));

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

  return { staff: questionsForStaff, director: questionsForDirector, _common: questionsCommon };
}

/**
 * 1シート分のデータをインポートする
 */
async function importOneSheet(
  surveyId: number,
  surveyType: string,
  respondentType: string,
  questions: QuestionDef[],
  text: string
): Promise<{ count: number; matchedQuestions: number; totalQuestions: number; totalRows: number; warnings: string[] }> {
  const result = parseStaffCSVDynamic(text, surveyId, questions);

  if (result.errors.length > 0 && result.responses.length === 0) {
    return { count: 0, matchedQuestions: result.matchedQuestions, totalQuestions: result.totalQuestions, totalRows: 0, warnings: result.errors };
  }

  const count = await withTransaction(async (tx) => {
    // 既存データを削除（置換モード）
    if (surveyType === "jigyotai") {
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
          surveyType === "clinic" ? resp.clinic : "",
          surveyType === "jigyotai" ? (resp.entity || resp.clinic || "") : null,
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

  return { count, matchedQuestions: result.matchedQuestions, totalQuestions: result.totalQuestions, totalRows: result.totalRows, warnings: result.errors };
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

    // 全シートを取得（シート名からタイプを自動判定）
    const sheets: SheetResult[] = await fetchAllSheets(url, survey.survey_type as "clinic" | "jigyotai");

    // 質問テンプレートを全タイプ分準備
    let questionsByType: Record<string, QuestionDef[]>;
    if (survey.survey_type === "jigyotai") {
      questionsByType = await prepareJigyotaiQuestionsByType(surveyId);
    } else {
      questionsByType = await prepareClinicQuestionsByType(surveyId);
    }

    const importResults: Array<{
      sheetName: string;
      type: string;
      count: number;
      matchedQuestions: number;
      totalQuestions: number;
    }> = [];
    const allWarnings: string[] = [];

    // 各シートを順番にインポート
    for (const sheet of sheets) {
      let respondentType = sheet.type;

      // シート名でタイプが決まらなかった場合（"auto"）、ヘッダーから自動判定
      if (respondentType === "auto") {
        const detectionTargets = { ...questionsByType };
        delete detectionTargets._common;
        const detected = detectRespondentType(sheet.csv, detectionTargets);
        respondentType = detected.type;
      }

      // パース用の質問テンプレートを取得
      let questions: QuestionDef[];
      if (survey.survey_type === "jigyotai") {
        questions = questionsByType[respondentType] || questionsByType.staff;
      } else {
        questions = questionsByType._common || questionsByType.staff;
      }

      const result = await importOneSheet(surveyId, survey.survey_type, respondentType, questions, sheet.csv);

      const typeLabel = { staff: "スタッフ", director: "院長", manager: "責任者", corporate: "経営企画室" }[respondentType] || respondentType;

      if (result.count > 0) {
        importResults.push({
          sheetName: sheet.sheetName,
          type: respondentType,
          count: result.count,
          matchedQuestions: result.matchedQuestions,
          totalQuestions: result.totalQuestions,
        });
      }

      if (result.warnings.length > 0) {
        allWarnings.push(`[${typeLabel}] ${result.warnings.join("; ")}`);
      }
    }

    const totalCount = importResults.reduce((sum, r) => sum + r.count, 0);

    return NextResponse.json({
      count: totalCount,
      sheets: importResults,
      mode: "replace",
      warnings: allWarnings,
    });
  } catch (err) {
    console.error("Sheet import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
