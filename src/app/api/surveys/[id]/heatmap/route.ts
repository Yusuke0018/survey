import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClinicStaffAverages } from "@/lib/db";
import { QUESTIONS, getShortLabel } from "@/lib/questions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const clinicAverages = getClinicStaffAverages(surveyId);

  const clinics = clinicAverages.map((ca) => ca.clinic);

  const rows = QUESTIONS.map((q) => {
    const values: Record<string, number | null> = {};
    for (const ca of clinicAverages) {
      values[ca.clinic] = ca[q.id] != null ? Math.round((ca[q.id] as number) * 100) / 100 : null;
    }
    return {
      id: q.id,
      num: q.num,
      shortLabel: getShortLabel(q),
      area: q.area,
      areaLabel: q.areaLabel,
      values,
    };
  });

  // Clinic overall averages
  const clinicTotals: Record<string, { avg: number; count: number }> = {};
  for (const ca of clinicAverages) {
    const scores = QUESTIONS.map((q) => ca[q.id] as number | null).filter((v): v is number => v != null);
    clinicTotals[ca.clinic] = {
      avg: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0,
      count: ca.count,
    };
  }

  return NextResponse.json({ clinics, rows, clinicTotals });
}
