import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { QUESTIONS, AREAS, AREA_ORDER, getShortLabel } from "@/lib/questions";
import {
  getClinicAverageScores,
  getClinicLatestDirectorByClinic,
  getClinicNormalizedResponses,
} from "@/lib/survey-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id, name } = await params;
  const surveyId = parseInt(id);
  const clinicName = decodeURIComponent(name);

  // Clinic averages
  const clinicAvg = getClinicAverageScores(surveyId, "staff", clinicName) as Record<string, number | null> & { count: number };
  // Overall averages
  const overallAvg = getClinicAverageScores(surveyId, "staff") as Record<string, number | null> & { count: number };
  // Individual responses
  const staffResponses = getClinicNormalizedResponses(surveyId, { type: "staff", clinic: clinicName });
  // Director response
  const directorResponse = getClinicLatestDirectorByClinic(surveyId).get(clinicName) ?? null;

  // Question scores with comparison
  const questionScores = QUESTIONS.map((q) => {
    const clinicScore = clinicAvg[q.id] != null ? Math.round((clinicAvg[q.id] as number) * 100) / 100 : null;
    const globalScore = overallAvg[q.id] != null ? Math.round((overallAvg[q.id] as number) * 100) / 100 : null;
    const diff = clinicScore != null && globalScore != null ? Math.round((clinicScore - globalScore) * 100) / 100 : null;
    const directorScore = directorResponse ? directorResponse.answers[q.id] : null;

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
    const scores = QUESTIONS.map((q) => r.answers[q.id]).filter((v): v is number => v != null);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      id: r.key,
      timestamp: r.timestamp,
      name: r.respondentName || "匿名",
      avgScore: Math.round(avg * 100) / 100,
      freeText: r.freeText || null,
    };
  });

  // Free text comments
  const freeTexts = staffResponses
    .filter((r) => r.freeText && r.freeText.trim())
    .map((r) => ({
      text: r.freeText as string,
      name: r.respondentName || "匿名",
      timestamp: r.timestamp || "",
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
          directorScore: directorResponse.answers[q.id],
          staffScore: clinicAvg[q.id] != null ? Math.round((clinicAvg[q.id] as number) * 100) / 100 : null,
        }))
      : null,
  });
}
