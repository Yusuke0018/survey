import { NextRequest, NextResponse } from "next/server";
import { getQuestionTemplates, upsertQuestionTemplates, getSurvey } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const surveyId = parseInt(id);
  const survey = getSurvey(surveyId);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }
  const questions = getQuestionTemplates(surveyId);
  return NextResponse.json(questions);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const survey = getSurvey(surveyId);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const { questions } = await request.json();
  upsertQuestionTemplates(surveyId, questions);
  return NextResponse.json({ success: true, count: questions.length });
}
