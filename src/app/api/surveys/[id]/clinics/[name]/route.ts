import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getStaffScoreAverages, getStaffResponses, getDirectorResponses } from "@/lib/db";
import { QUESTIONS, AREAS, AREA_ORDER, getShortLabel } from "@/lib/questions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id, name } = await params;
  const surveyId = parseInt(id);
  const clinicName = decodeURIComponent(name);

  // Clinic averages
  const clinicAvg = getStaffScoreAverages(surveyId, clinicName);
  // Overall averages
  const overallAvg = getStaffScoreAverages(surveyId);
  // Individual responses
  const staffResponses = getStaffResponses(surveyId, clinicName) as Array<Record<string, unknown>>;
  // Director response
  const directorResponses = getDirectorResponses(surveyId, clinicName) as Array<Record<string, unknown>>;
  const directorResponse = directorResponses.length > 0 ? directorResponses[directorResponses.length - 1] : null;

  // Question scores with comparison
  const questionScores = QUESTIONS.map((q) => {
    const clinicScore = clinicAvg[q.id] != null ? Math.round((clinicAvg[q.id] as number) * 100) / 100 : null;
    const globalScore = overallAvg[q.id] != null ? Math.round((overallAvg[q.id] as number) * 100) / 100 : null;
    const diff = clinicScore != null && globalScore != null ? Math.round((clinicScore - globalScore) * 100) / 100 : null;
    const directorScore = directorResponse ? (directorResponse[q.id] as number | null) : null;

    return {
      id: q.id,
      num: q.num,
      text: q.staffText,
      shortLabel: getShortLabel(q),
      area: q.area,
      areaLabel: q.areaLabel,
      areaColor: AREAS[q.area].color,
      clinicScore,
      globalScore,
      diff,
      directorScore,
    };
  });

  // Area averages
  const areaAverages = AREA_ORDER.map((key) => {
    const areaQuestions = QUESTIONS.filter((q) => q.area === key);
    const clinicScores = areaQuestions.map((q) => clinicAvg[q.id] as number | null).filter((v): v is number => v != null);
    const globalScores = areaQuestions.map((q) => overallAvg[q.id] as number | null).filter((v): v is number => v != null);
    return {
      area: key,
      label: AREAS[key].label,
      color: AREAS[key].color,
      clinicScore: clinicScores.length > 0 ? Math.round((clinicScores.reduce((a, b) => a + b, 0) / clinicScores.length) * 100) / 100 : 0,
      globalScore: globalScores.length > 0 ? Math.round((globalScores.reduce((a, b) => a + b, 0) / globalScores.length) * 100) / 100 : 0,
    };
  });

  // Individual responses formatted
  const responses = staffResponses.map((r) => {
    const scores = QUESTIONS.map((q) => r[q.id] as number | null).filter((v): v is number => v != null);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      id: r.id,
      timestamp: r.timestamp,
      name: r.respondent_name || "匿名",
      avgScore: Math.round(avg * 100) / 100,
      freeText: r.free_text || null,
    };
  });

  // Free text comments
  const freeTexts = staffResponses
    .filter((r) => r.free_text && (r.free_text as string).trim())
    .map((r) => ({
      text: r.free_text as string,
      name: (r.respondent_name as string) || "匿名",
      timestamp: r.timestamp as string,
    }));

  const allClinicScores = QUESTIONS.map((q) => clinicAvg[q.id] as number | null).filter((v): v is number => v != null);
  const clinicOverallAvg = allClinicScores.length > 0 ? allClinicScores.reduce((a, b) => a + b, 0) / allClinicScores.length : 0;

  let highestQ = { num: 0, score: 0 };
  let lowestQ = { num: 0, score: 5 };
  for (const q of QUESTIONS) {
    const val = clinicAvg[q.id] as number | null;
    if (val != null) {
      if (val > highestQ.score) highestQ = { num: q.num, score: Math.round(val * 100) / 100 };
      if (val < lowestQ.score) lowestQ = { num: q.num, score: Math.round(val * 100) / 100 };
    }
  }

  return NextResponse.json({
    clinic: clinicName,
    count: clinicAvg.count || 0,
    hasDirector: directorResponse != null,
    overallAvg: Math.round(clinicOverallAvg * 100) / 100,
    highest: highestQ,
    lowest: lowestQ,
    questionScores,
    areaAverages,
    responses,
    freeTexts,
    directorResponse: directorResponse
      ? QUESTIONS.map((q) => ({
          id: q.id,
          num: q.num,
          shortLabel: getShortLabel(q),
          directorScore: directorResponse[q.id] as number | null,
          staffScore: clinicAvg[q.id] != null ? Math.round((clinicAvg[q.id] as number) * 100) / 100 : null,
        }))
      : null,
  });
}
