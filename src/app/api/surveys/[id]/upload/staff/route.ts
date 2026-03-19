import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurvey, insertStaffResponses } from "@/lib/db";
import { parseStaffCSV } from "@/lib/csv-parser";
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

  // Check if UTF-8 decode produced replacement characters (indicates wrong encoding)
  if (utf8Text.includes("\uFFFD")) {
    text = new TextDecoder("shift_jis").decode(buffer);
  } else {
    text = utf8Text;
  }

  const result = parseStaffCSV(text, surveyId);

  if (result.errors.length > 0 && result.rows.length === 0) {
    return NextResponse.json({ error: result.errors.join("; ") }, { status: 400 });
  }

  const count = await insertStaffResponses(result.rows);
  return NextResponse.json({
    count,
    matchedQuestions: result.matchedQuestions,
    totalRows: result.totalRows,
    warnings: result.errors,
  });
}
