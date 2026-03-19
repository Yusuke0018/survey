import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurvey, getQuestionTemplates, submitResponse, execute } from "@/lib/db";
import { parseDirectorCSVDynamic } from "@/lib/csv-parser";
import type { QuestionDef } from "@/lib/csv-parser";
import { getStorageWriteGuardResponse } from "@/lib/storage-mode";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  if (!file) {
    return NextResponse.json({ error: "CSVファイルが必要です" }, { status: 400 });
  }

  // Try reading as UTF-8 first, fall back to Shift_JIS
  let text: string;
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder("utf-8").decode(buffer);

  if (utf8Text.includes("\uFFFD")) {
    text = new TextDecoder("shift_jis").decode(buffer);
  } else {
    text = utf8Text;
  }

  // Fetch question templates for this survey (clinic questions only: respondent_type is null)
  const templates = await getQuestionTemplates(surveyId);
  const clinicTemplates = templates.filter((t) => t.respondent_type === null);

  const questions: QuestionDef[] = clinicTemplates.map((t) => ({
    templateId: t.id,
    num: t.num,
    staffText: t.staff_text,
    directorText: t.director_text,
  }));

  const result = parseDirectorCSVDynamic(text, surveyId, questions);

  if (result.errors.length > 0 && result.responses.length === 0) {
    return NextResponse.json({ error: result.errors.join("; ") }, { status: 400 });
  }

  // Delete existing director responses for this survey (replace mode)
  await execute("DELETE FROM responses WHERE survey_id = ? AND type = 'director' AND entity IS NULL", [surveyId]);

  // Insert via submitResponse
  let count = 0;
  for (const resp of result.responses) {
    await submitResponse({
      surveyId,
      type: "director",
      clinic: resp.clinic,
      respondentName: resp.respondentName ?? undefined,
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
}
