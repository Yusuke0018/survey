import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSurvey, insertDirectorResponses } from "@/lib/db";
import { parseDirectorCSV } from "@/lib/csv-parser";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const survey = getSurvey(surveyId);
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

  const result = parseDirectorCSV(text, surveyId);

  if (result.errors.length > 0 && result.rows.length === 0) {
    return NextResponse.json({ error: result.errors.join("; ") }, { status: 400 });
  }

  const count = insertDirectorResponses(result.rows);
  return NextResponse.json({
    count,
    matchedQuestions: result.matchedQuestions,
    totalRows: result.totalRows,
    warnings: result.errors,
  });
}
