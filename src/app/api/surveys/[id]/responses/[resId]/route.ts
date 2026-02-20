import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb, getStaffScoreAverages } from "@/lib/db";
import { QUESTIONS, AREAS, getShortLabel } from "@/lib/questions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; resId: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id, resId } = await params;
  const surveyId = parseInt(id);
  const responseId = parseInt(resId);

  const db = getDb();
  const response = db.prepare("SELECT * FROM staff_responses WHERE id = ? AND survey_id = ?").get(responseId, surveyId) as Record<string, unknown> | undefined;

  if (!response) {
    return NextResponse.json({ error: "回答が見つかりません" }, { status: 404 });
  }

  const clinicAvg = getStaffScoreAverages(surveyId, response.clinic as string);

  const questionDetails = QUESTIONS.map((q) => {
    const value = response[q.id] as number | null;
    const clinicScore = clinicAvg[q.id] != null ? Math.round((clinicAvg[q.id] as number) * 100) / 100 : null;
    const diff = value != null && clinicScore != null ? Math.round((value - clinicScore) * 100) / 100 : null;

    return {
      id: q.id,
      num: q.num,
      text: q.staffText,
      shortLabel: getShortLabel(q),
      area: q.area,
      areaLabel: q.areaLabel,
      areaColor: AREAS[q.area].color,
      value,
      clinicAvg: clinicScore,
      diff,
    };
  });

  const validScores = questionDetails.filter((q) => q.value != null).map((q) => q.value as number);
  const avg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0;

  return NextResponse.json({
    id: response.id,
    timestamp: response.timestamp,
    clinic: response.clinic,
    name: response.respondent_name || "匿名",
    avgScore: Math.round(avg * 100) / 100,
    freeText: response.free_text || null,
    questions: questionDetails,
  });
}
