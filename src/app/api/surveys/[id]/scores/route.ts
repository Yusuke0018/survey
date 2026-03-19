import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { QUESTIONS, AREAS, AREA_ORDER, getShortLabel } from "@/lib/questions";
import { getClinicAverageScores } from "@/lib/survey-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const avg = getClinicAverageScores(surveyId, "staff");

  const scores = QUESTIONS.map((q) => ({
    id: q.id,
    num: q.num,
    text: q.staffText,
    shortLabel: getShortLabel(q),
    area: q.area,
    areaLabel: q.areaLabel,
    areaColor: AREAS[q.area].color,
    score: avg[q.id] != null ? Math.round((avg[q.id] as number) * 100) / 100 : null,
  }));

  // Area averages for radar chart
  const areaAverages = AREA_ORDER.map((key) => {
    const areaQuestions = QUESTIONS.filter((q) => q.area === key);
    const areaScores = areaQuestions.map((q) => avg[q.id] as number | null).filter((v): v is number => v != null);
    const areaAvg = areaScores.length > 0 ? areaScores.reduce((a, b) => a + b, 0) / areaScores.length : 0;
    return {
      area: key,
      label: AREAS[key].label,
      color: AREAS[key].color,
      score: Math.round(areaAvg * 100) / 100,
    };
  });

  return NextResponse.json({ scores, areaAverages });
}
