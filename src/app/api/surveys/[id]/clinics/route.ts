import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { QUESTIONS, AREAS, AREA_ORDER } from "@/lib/questions";
import { getClinicLatestDirectorByClinic, getClinicStaffAveragesByClinic } from "@/lib/survey-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);

  const clinicAverages = getClinicStaffAveragesByClinic(surveyId) as Array<Record<string, number | null> & {
    clinic: string;
    count: number;
  }>;
  const directorClinics = new Set(getClinicLatestDirectorByClinic(surveyId).keys());

  const clinics = clinicAverages.map((ca) => {
    const scores: Record<string, number | null> = {};
    const alertItems: Array<{ qNum: number; score: number; label: string }> = [];

    for (const q of QUESTIONS) {
      const val = ca[q.id] as number | null;
      scores[q.id] = val != null ? Math.round(val * 100) / 100 : null;
      if (val != null && val < 3.0) {
        alertItems.push({ qNum: q.num, score: Math.round(val * 100) / 100, label: q.areaLabel });
      }
    }

    // Calculate area averages for mini radar
    const areaAverages = AREA_ORDER.map((key) => {
      const areaQuestions = QUESTIONS.filter((q) => q.area === key);
      const areaScores = areaQuestions.map((q) => ca[q.id] as number | null).filter((v): v is number => v != null);
      return {
        area: key,
        label: AREAS[key].label,
        score: areaScores.length > 0 ? Math.round((areaScores.reduce((a, b) => a + b, 0) / areaScores.length) * 100) / 100 : 0,
      };
    });

    const allScores = QUESTIONS.map((q) => ca[q.id] as number | null).filter((v): v is number => v != null);
    const overallAvg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    return {
      clinic: ca.clinic,
      count: ca.count,
      hasDirector: directorClinics.has(ca.clinic),
      overallAvg: Math.round(overallAvg * 100) / 100,
      scores,
      areaAverages,
      alertItems: alertItems.sort((a, b) => a.score - b.score).slice(0, 3),
    };
  });

  return NextResponse.json(clinics);
}
