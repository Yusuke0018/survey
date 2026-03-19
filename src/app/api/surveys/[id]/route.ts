import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurvey, deleteSurvey, updateSurveyStatus } from "@/lib/db";
import { getStorageWriteGuardResponse } from "@/lib/storage-mode";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const survey = await getSurvey(parseInt(id));
  if (!survey) {
    return NextResponse.json({ error: "サーベイが見つかりません" }, { status: 404 });
  }
  return NextResponse.json(survey);
}

export async function PATCH(
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

  const { status } = await request.json();
  if (!["draft", "active"].includes(status)) {
    return NextResponse.json({ error: "無効なステータスです" }, { status: 400 });
  }

  await updateSurveyStatus(surveyId, status);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const storageError = getStorageWriteGuardResponse();
  if (storageError) return storageError;

  const { id } = await params;
  await deleteSurvey(parseInt(id));
  return NextResponse.json({ success: true });
}
