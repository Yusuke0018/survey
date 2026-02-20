import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getStaffResponses } from "@/lib/db";
import { QUESTIONS } from "@/lib/questions";

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

  const result = responses.map((r) => {
    const scores = QUESTIONS.map((q) => ({
      id: q.id,
      num: q.num,
      value: r[q.id] as number | null,
    }));
    const validScores = scores.filter((s) => s.value != null).map((s) => s.value as number);
    const avg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0;
    const lowestScore = scores.reduce(
      (min, s) => (s.value != null && (min.value == null || s.value < min.value) ? s : min),
      scores[0]
    );

    return {
      id: r.id,
      timestamp: r.timestamp,
      clinic: r.clinic,
      name: r.respondent_name || "匿名",
      avgScore: Math.round(avg * 100) / 100,
      lowestQuestion: lowestScore ? `Q${lowestScore.num}` : null,
      lowestScore: lowestScore?.value || null,
      hasFreeText: !!(r.free_text && (r.free_text as string).trim()),
      scores,
    };
  });

  return NextResponse.json(result);
}
