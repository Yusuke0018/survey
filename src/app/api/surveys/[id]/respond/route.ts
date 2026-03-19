import { NextRequest, NextResponse } from "next/server";
import { getSurvey, getQuestionTemplates, submitResponse, hasSubmitted } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const surveyId = parseInt(id);

  const survey = getSurvey(surveyId);
  if (!survey || survey.status !== "active") {
    return NextResponse.json({ error: "このサーベイは現在回答を受け付けていません" }, { status: 400 });
  }

  const body = await request.json();
  const { clinic, respondentName, freeText, answers, sessionToken } = body;

  if (!clinic) {
    return NextResponse.json({ error: "拠点を選択してください" }, { status: 400 });
  }

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: "回答を入力してください" }, { status: 400 });
  }

  // Check duplicate
  if (sessionToken && hasSubmitted(surveyId, sessionToken)) {
    return NextResponse.json({ error: "このサーベイには既に回答済みです" }, { status: 400 });
  }

  // Validate question IDs
  const questions = getQuestionTemplates(surveyId);
  const validIds = new Set(questions.map(q => q.id));
  for (const a of answers) {
    if (!validIds.has(a.questionId)) {
      return NextResponse.json({ error: "無効な質問IDが含まれています" }, { status: 400 });
    }
    if (a.score < 1 || a.score > 5) {
      return NextResponse.json({ error: "スコアは1〜5の範囲で入力してください" }, { status: 400 });
    }
  }

  const responseId = submitResponse({
    surveyId,
    type: "staff",
    clinic,
    respondentName,
    freeText,
    sessionToken,
    answers,
  });

  return NextResponse.json({ success: true, responseId });
}
