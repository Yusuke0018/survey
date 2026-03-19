import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurveyResponseDetail } from "@/lib/survey-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; resId: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id, resId } = await params;
  const surveyId = parseInt(id);
  const detail = getSurveyResponseDetail(surveyId, decodeURIComponent(resId));
  if (!detail) {
    return NextResponse.json({ error: "回答が見つかりません" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
