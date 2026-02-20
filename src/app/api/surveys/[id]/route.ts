import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSurvey, deleteSurvey } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const survey = getSurvey(parseInt(id));
  if (!survey) {
    return NextResponse.json({ error: "サーベイが見つかりません" }, { status: 404 });
  }
  return NextResponse.json(survey);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  deleteSurvey(parseInt(id));
  return NextResponse.json({ success: true });
}
