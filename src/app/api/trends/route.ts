import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurvey } from "@/lib/db";
import { QUESTIONS, AREAS, AREA_ORDER } from "@/lib/questions";
import { getClinicAverageScores, getClinicStaffAveragesByClinic } from "@/lib/survey-analytics";

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const idsParam = request.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ error: "サーベイIDが必要です" }, { status: 400 });
  }

  const ids = idsParam.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));

  const trends = ids.map((surveyId) => {
    const survey = getSurvey(surveyId);
    if (!survey) return null;

    const avg = getClinicAverageScores(surveyId, "staff") as Record<string, number | null> & { count: number };
    const clinicAverages = getClinicStaffAveragesByClinic(surveyId) as Array<Record<string, number | null> & {
      clinic: string;
      count: number;
    }>;

    const areaAverages = AREA_ORDER.map((key) => {
      const areaQuestions = QUESTIONS.filter((q) => q.area === key);
      const areaScores = areaQuestions.map((q) => avg[q.id] as number | null).filter((v): v is number => v != null);
      return {
        area: key,
        label: AREAS[key].label,
        color: AREAS[key].color,
        score: areaScores.length > 0 ? Math.round((areaScores.reduce((a, b) => a + b, 0) / areaScores.length) * 100) / 100 : 0,
      };
    });

    const clinicScores = clinicAverages.map((ca) => {
      const scores = QUESTIONS.map((q) => ca[q.id] as number | null).filter((v): v is number => v != null);
      return {
        clinic: ca.clinic,
        avg: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0,
      };
    });

    return {
      surveyId,
      name: survey.name,
      conductedAt: survey.conducted_at,
      areaAverages,
      clinicScores,
    };
  }).filter(Boolean);

  return NextResponse.json(trends);
}
