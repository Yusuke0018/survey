import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllSurveys, createSurvey } from "@/lib/db";

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const surveys = getAllSurveys();
  return NextResponse.json(surveys);
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { name, conducted_at, survey_type } = await request.json();
  if (!name || !conducted_at) {
    return NextResponse.json({ error: "名前と実施日は必須です" }, { status: 400 });
  }

  const id = createSurvey(name, conducted_at, survey_type || "clinic");
  return NextResponse.json({ id, name, conducted_at, survey_type: survey_type || "clinic" });
}
