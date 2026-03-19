import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSurvey, getNewScoreAverages, queryAll, queryOne } from "@/lib/db";
import { QUESTIONS } from "@/lib/questions";
import { getClinicAverageScores, getClinicNormalizedResponses } from "@/lib/survey-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);

  const survey = await getSurvey(surveyId);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  // Jigyotai survey summary
  if (survey.survey_type === "jigyotai") {
    const staffCount = (await queryOne<{ c: number }>("SELECT COUNT(*) as c FROM responses WHERE survey_id = ? AND type = 'staff'", [surveyId]))?.c ?? 0;
    const managerCount = (await queryOne<{ c: number }>("SELECT COUNT(*) as c FROM responses WHERE survey_id = ? AND type = 'manager'", [surveyId]))?.c ?? 0;
    const corporateCount = (await queryOne<{ c: number }>("SELECT COUNT(*) as c FROM responses WHERE survey_id = ? AND type = 'corporate'", [surveyId]))?.c ?? 0;

    // Get staff score averages
    const staffScores = await getNewScoreAverages(surveyId, "staff");
    const validScores = staffScores.filter((s) => s.avg_score != null);
    const overallAvg = validScores.length > 0
      ? validScores.reduce((sum, s) => sum + (s.avg_score || 0), 0) / validScores.length
      : 0;

    let highest = { num: 0, score: 0, area: "" };
    let lowest = { num: 0, score: 5, area: "" };
    for (const s of validScores) {
      const score = s.avg_score || 0;
      if (score > highest.score) highest = { num: s.num, score, area: s.area };
      if (score < lowest.score) lowest = { num: s.num, score, area: s.area };
    }

    // Get entity list with counts
    const entities = await queryAll<{ entity: string; count: number }>(`
      SELECT entity, COUNT(*) as count FROM responses
      WHERE survey_id = ? AND type = 'staff' AND entity IS NOT NULL
      GROUP BY entity ORDER BY entity
    `, [surveyId]);

    return NextResponse.json({
      surveyType: "jigyotai",
      staffCount,
      managerCount,
      corporateCount,
      overallAvg: Math.round(overallAvg * 100) / 100,
      highest,
      lowest,
      entities,
    });
  }

  // Clinic survey summary (original)
  const staffAvg = await getClinicAverageScores(surveyId, "staff");
  const staffCount = staffAvg.count;
  const directorCount = (await getClinicNormalizedResponses(surveyId, { type: "director" })).length;

  const scores: number[] = [];
  let highestQ = { num: 0, score: 0, area: "" };
  let lowestQ = { num: 0, score: 5, area: "" };

  for (const q of QUESTIONS) {
    const val = staffAvg[q.id] as number | null;
    if (val != null) {
      scores.push(val);
      if (val > highestQ.score) highestQ = { num: q.num, score: val, area: q.areaLabel };
      if (val < lowestQ.score) lowestQ = { num: q.num, score: val, area: q.areaLabel };
    }
  }

  const overallAvg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return NextResponse.json({
    surveyType: "clinic",
    staffCount,
    directorCount,
    overallAvg: Math.round(overallAvg * 100) / 100,
    highest: highestQ,
    lowest: lowestQ,
  });
}
