import { NextResponse } from "next/server";
import { getActiveSurveys } from "@/lib/db";

export async function GET() {
  const surveys = await getActiveSurveys();
  return NextResponse.json(surveys);
}
