import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClinicAverageScores, computeAreaAverages } from "@/lib/survey-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const avg = await getClinicAverageScores(surveyId, "staff");

  const scores = avg.questions.map((q) => {
    const val = avg.averages[q.questionKey];
    return {
      id: q.questionKey,
      num: q.num,
      text: q.staffText,
      shortLabel: q.shortLabel,
      area: q.area,
      areaLabel: q.areaLabel,
      areaColor: q.areaColor,
      score: val != null ? Math.round(val * 100) / 100 : null,
    };
  });

  const areaAverages = computeAreaAverages(avg.questions, avg.averages);

  return NextResponse.json({ scores, areaAverages });
}
