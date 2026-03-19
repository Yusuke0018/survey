import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClinicStaffAveragesByClinic } from "@/lib/survey-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const clinicData = await getClinicStaffAveragesByClinic(surveyId);
  const questions = clinicData.questions;

  const clinics = clinicData.rows.map((ca) => ca.clinic);

  const rows = questions.map((q) => {
    const values: Record<string, number | null> = {};
    for (const ca of clinicData.rows) {
      const val = ca.averages[q.questionKey];
      values[ca.clinic] = val != null ? Math.round(val * 100) / 100 : null;
    }
    return {
      id: q.questionKey,
      num: q.num,
      shortLabel: q.shortLabel,
      area: q.area,
      areaLabel: q.areaLabel,
      values,
    };
  });

  const clinicTotals: Record<string, { avg: number; count: number }> = {};
  for (const ca of clinicData.rows) {
    const scores = questions.map((q) => ca.averages[q.questionKey]).filter((v): v is number => v != null);
    clinicTotals[ca.clinic] = {
      avg: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0,
      count: ca.count,
    };
  }

  return NextResponse.json({ clinics, rows, clinicTotals });
}
