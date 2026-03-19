import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getNewScoreAverages } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const type = request.nextUrl.searchParams.get("type") || "staff";
  const entity = request.nextUrl.searchParams.get("entity") || undefined;

  const scores = getNewScoreAverages(surveyId, type, entity);

  // Group by area for area averages
  const areaMap: Record<string, { scores: number[]; label: string }> = {};
  for (const s of scores) {
    const area = s.area;
    if (!areaMap[area]) areaMap[area] = { scores: [], label: s.area };
    if (s.avg_score != null) areaMap[area].scores.push(s.avg_score);
  }

  const areaAverages = Object.entries(areaMap).map(([area, data]) => ({
    area,
    label: data.label,
    score: data.scores.length > 0
      ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100) / 100
      : 0,
  }));

  const formattedScores = scores.map((s) => ({
    questionId: s.question_id,
    num: s.num,
    text: s.q_text || s.staff_text,
    shortLabel: s.short_label || (s.q_text || s.staff_text).substring(0, 10),
    area: s.area,
    coreId: s.core_id,
    score: s.avg_score != null ? Math.round(s.avg_score * 100) / 100 : null,
    answerCount: s.answer_count,
    skipCount: s.skip_count,
  }));

  return NextResponse.json({ scores: formattedScores, areaAverages });
}
