import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getStaffScoreAverages, getDirectorResponses, getDb } from "@/lib/db";
import { QUESTIONS } from "@/lib/questions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);

  const staffAvg = getStaffScoreAverages(surveyId);
  const directorResponses = getDirectorResponses(surveyId);

  const db = getDb();
  const staffCount = (db.prepare("SELECT COUNT(*) as c FROM staff_responses WHERE survey_id = ?").get(surveyId) as { c: number }).c;
  const directorCount = directorResponses.length;

  // Calculate overall average
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
    staffCount,
    directorCount,
    overallAvg: Math.round(overallAvg * 100) / 100,
    highest: highestQ,
    lowest: lowestQ,
  });
}
