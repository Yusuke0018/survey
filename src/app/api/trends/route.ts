import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurvey } from "@/lib/db";
import { getClinicAverageScores, getClinicStaffAveragesByClinic, computeAreaAverages } from "@/lib/survey-analytics";

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const idsParam = request.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ error: "サーベイIDが必要です" }, { status: 400 });
  }

  const ids = idsParam.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));

  const trends = (await Promise.all(ids.map(async (surveyId) => {
    const survey = await getSurvey(surveyId);
    if (!survey) return null;

    const avg = await getClinicAverageScores(surveyId, "staff");
    const clinicData = await getClinicStaffAveragesByClinic(surveyId);

    const areaAverages = computeAreaAverages(avg.questions, avg.averages);

    const clinicScores = clinicData.rows.map((ca) => {
      const scores = clinicData.questions.map((q) => ca.averages[q.questionKey]).filter((v): v is number => v != null);
      return {
        clinic: ca.clinic,
        avg: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0,
      };
    });

    const questionScores = avg.questions.map((q) => ({
      questionKey: q.questionKey,
      num: q.num,
      shortLabel: q.shortLabel,
      area: q.area,
      areaLabel: q.areaLabel,
      score: avg.averages[q.questionKey] != null
        ? Math.round((avg.averages[q.questionKey] as number) * 100) / 100
        : null,
    }));

    return {
      surveyId,
      name: survey.name,
      conductedAt: survey.conducted_at,
      areaAverages,
      clinicScores,
      questionScores,
    };
  }))).filter(Boolean);

  return NextResponse.json(trends);
}
