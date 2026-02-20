import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClinicStaffAverages } from "@/lib/db";
import { QUESTIONS } from "@/lib/questions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const clinicAverages = getClinicStaffAverages(surveyId);

  const data = clinicAverages.map((ca) => {
    const q7Score = ca.q7 != null ? Math.round((ca.q7 as number) * 100) / 100 : 0;
    const q15Score = ca.q15 != null ? Math.round((ca.q15 as number) * 100) / 100 : 0;

    let label: string;
    let level: "critical" | "warning-director" | "warning-other" | "good";

    if (q7Score < 3.0 && q15Score < 3.0) {
      label = "要緊急対応（院長関係×離職意向）";
      level = "critical";
    } else if (q7Score < 3.0 && q15Score >= 3.0) {
      label = "院長関係に課題あり（踏みとどまり中）";
      level = "warning-director";
    } else if (q7Score >= 3.0 && q15Score < 3.0) {
      label = "院長以外の要因で離職リスク";
      level = "warning-other";
    } else {
      label = "概ね良好";
      level = "good";
    }

    const allScores = QUESTIONS.map((q) => ca[q.id] as number | null).filter((v): v is number => v != null);
    const overallAvg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    return {
      clinic: ca.clinic,
      q7: q7Score,
      q15: q15Score,
      overallAvg: Math.round(overallAvg * 100) / 100,
      count: ca.count,
      label,
      level,
    };
  });

  return NextResponse.json(data);
}
