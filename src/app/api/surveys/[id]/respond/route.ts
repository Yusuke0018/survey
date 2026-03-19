import { NextRequest, NextResponse } from "next/server";
import { getCurrentGoogleUser } from "@/lib/auth";
import { getSurvey, getQuestionTemplates, submitResponse, hasSubmitted, hasSubmittedByOwner } from "@/lib/db";
import { getStorageWriteGuardResponse } from "@/lib/storage-mode";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const storageError = getStorageWriteGuardResponse();
  if (storageError) return storageError;

  const { id } = await params;
  const surveyId = parseInt(id);

  const survey = await getSurvey(surveyId);
  if (!survey || survey.status !== "active") {
    return NextResponse.json({ error: "このサーベイは現在回答を受け付けていません" }, { status: 400 });
  }

  const body = await request.json();
  const { clinic, entity, respondentName, freeText, answers, sessionToken, respondentType } = body;
  const googleUser = await getCurrentGoogleUser();

  const orgUnit = survey.survey_type === "jigyotai" ? entity : clinic;
  if (!orgUnit) {
    return NextResponse.json({ error: survey.survey_type === "jigyotai" ? "事業体を選択してください" : "拠点を選択してください" }, { status: 400 });
  }

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: "回答を入力してください" }, { status: 400 });
  }

  // Determine response type
  const type = respondentType || "staff";
  const allowedTypes = survey.survey_type === "jigyotai"
    ? ["staff", "manager", "corporate"]
    : ["staff", "director"];
  if (!allowedTypes.includes(type)) {
    return NextResponse.json({ error: "無効な回答者タイプです" }, { status: 400 });
  }

  // Check duplicate (corporate planning can submit per entity)
  if (googleUser) {
    if (type === "corporate") {
      if (await hasSubmittedByOwner(surveyId, googleUser.sub, type, entity)) {
        return NextResponse.json({ error: "この事業体には既に回答済みです。マイ回答から確認できます。" }, { status: 400 });
      }
    } else if (await hasSubmittedByOwner(surveyId, googleUser.sub, type)) {
      return NextResponse.json({ error: "このGoogleアカウントでは既に回答済みです。マイ回答から確認できます。" }, { status: 400 });
    }
  } else if (sessionToken) {
    if (type === "corporate") {
      if (await hasSubmitted(surveyId, sessionToken, entity)) {
        return NextResponse.json({ error: "この事業体にはすでに回答済みです" }, { status: 400 });
      }
    } else {
      if (await hasSubmitted(surveyId, sessionToken)) {
        return NextResponse.json({ error: "このサーベイには既に回答済みです" }, { status: 400 });
      }
    }
  }

  // Validate question IDs
  const rType = survey.survey_type === "jigyotai" ? type : undefined;
  const questions = await getQuestionTemplates(surveyId, rType);
  const validIds = new Set(questions.map(q => q.id));
  for (const a of answers) {
    if (!validIds.has(a.questionId)) {
      return NextResponse.json({ error: "無効な質問IDが含まれています" }, { status: 400 });
    }
    // Allow null score for skip answers
    if (a.score !== null && (a.score < 1 || a.score > 5)) {
      return NextResponse.json({ error: "スコアは1〜5の範囲で入力してください" }, { status: 400 });
    }
  }

  const responseId = await submitResponse({
    surveyId,
    type,
    clinic: survey.survey_type === "clinic" ? orgUnit : "",
    entity: survey.survey_type === "jigyotai" ? orgUnit : undefined,
    respondentName,
    freeText,
    sessionToken,
    owner: googleUser
      ? {
          provider: googleUser.provider,
          subject: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
        }
      : undefined,
    answers: answers.map((a: { questionId: number; score: number | null; skipReason?: string }) => ({
      questionId: a.questionId,
      score: a.score,
      skipReason: a.skipReason || null,
    })),
  });

  return NextResponse.json({ success: true, responseId });
}
