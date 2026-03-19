import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClinicLatestDirectorByClinic, getClinicStaffAveragesByClinic, computeAreaAverages } from "@/lib/survey-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);

  const clinicData = await getClinicStaffAveragesByClinic(surveyId);
  const directorClinics = new Set((await getClinicLatestDirectorByClinic(surveyId)).keys());
  const questions = clinicData.questions;

  const clinics = clinicData.rows.map((ca) => {
    const scores: Record<string, number | null> = {};
    const alertItems: Array<{ qNum: number; score: number; label: string }> = [];

    for (const q of questions) {
      const val = ca.averages[q.questionKey];
      scores[q.questionKey] = val != null ? Math.round(val * 100) / 100 : null;
      if (val != null && val < 3.0) {
        alertItems.push({ qNum: q.num, score: Math.round(val * 100) / 100, label: q.areaLabel });
      }
    }

    const areaAverages = computeAreaAverages(questions, ca.averages);

    const allScores = questions.map((q) => ca.averages[q.questionKey]).filter((v): v is number => v != null);
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
