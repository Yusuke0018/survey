import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getStaffResponses } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const clinic = request.nextUrl.searchParams.get("clinic") || undefined;

  const responses = getStaffResponses(surveyId, clinic) as Array<Record<string, unknown>>;

  const freeTexts = responses
    .filter((r) => r.free_text && (r.free_text as string).trim())
    .map((r) => ({
      id: r.id,
      clinic: r.clinic,
      name: r.respondent_name || "匿名",
      timestamp: r.timestamp,
      text: r.free_text,
    }));

  return NextResponse.json(freeTexts);
}
