import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurveyResponseSummaries, type SurveyResponseType } from "@/lib/survey-analytics";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const type = (request.nextUrl.searchParams.get("type") || undefined) as SurveyResponseType | undefined;
  const orgUnit =
    request.nextUrl.searchParams.get("clinic") ||
    request.nextUrl.searchParams.get("entity") ||
    undefined;

  return NextResponse.json(getSurveyResponseSummaries(surveyId, { type, orgUnit }));
}
