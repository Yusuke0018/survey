import { NextRequest, NextResponse } from "next/server";
import { getQuestionTemplates, upsertQuestionTemplates, upsertJigyotaiQuestions, getSurvey } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getStorageWriteGuardResponse } from "@/lib/storage-mode";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const surveyId = parseInt(id);
  const survey = await getSurvey(surveyId);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const respondentType = request.nextUrl.searchParams.get("respondentType");
  const questions = await getQuestionTemplates(surveyId, respondentType || undefined);
  return NextResponse.json({ survey_type: survey.survey_type, questions });
}

export async function PUT(
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
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const body = await request.json();
  const questions = Array.isArray(body?.questions) ? body.questions : null;

  if (!questions) {
    return NextResponse.json({ error: "questions must be an array" }, { status: 400 });
  }

  if (survey.survey_type === "jigyotai" && body.respondent_type) {
    if (typeof body.respondent_type !== "string" || !body.respondent_type.trim()) {
      return NextResponse.json({ error: "respondent_type is required" }, { status: 400 });
    }

    await upsertJigyotaiQuestions(surveyId, body.respondent_type.trim(), questions);
    return NextResponse.json({ success: true, count: questions.length });
  }

  await upsertQuestionTemplates(surveyId, questions);
  return NextResponse.json({ success: true, count: questions.length });
}
