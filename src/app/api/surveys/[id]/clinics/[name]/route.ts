import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getClinicAverageScores,
  getClinicLatestDirectorByClinic,
  getClinicNormalizedResponses,
  computeAreaAverages,
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

  const clinicAvg = await getClinicAverageScores(surveyId, "staff", clinicName);
  const overallAvg = await getClinicAverageScores(surveyId, "staff");
  const staffResponses = await getClinicNormalizedResponses(surveyId, { type: "staff", clinic: clinicName });
  const directorResponse = (await getClinicLatestDirectorByClinic(surveyId)).get(clinicName) ?? null;

  const questions = clinicAvg.questions;

  const questionScores = questions.map((q) => {
    const clinicScore = clinicAvg.averages[q.questionKey] != null
      ? Math.round((clinicAvg.averages[q.questionKey] as number) * 100) / 100
      : null;
    const globalScore = overallAvg.averages[q.questionKey] != null
      ? Math.round((overallAvg.averages[q.questionKey] as number) * 100) / 100
      : null;
    const diff = clinicScore != null && globalScore != null
      ? Math.round((clinicScore - globalScore) * 100) / 100
      : null;
    const directorScore = directorResponse
      ? directorResponse.answers[q.questionKey] ?? null
      : null;

    return {
      id: q.questionKey,
      num: q.num,
      text: q.staffText,
      shortLabel: q.shortLabel,
      area: q.area,
      areaLabel: q.areaLabel,
      areaColor: q.areaColor,
      clinicScore,
      globalScore,
      diff,
      directorScore,
    };
  });

  const areaAverages = computeAreaAverages(questions, clinicAvg.averages).map((a) => {
    const globalArea = computeAreaAverages(questions, overallAvg.averages).find((g) => g.area === a.area);
    return {
      area: a.area,
      label: a.label,
      color: a.color,
      clinicScore: a.score,
      globalScore: globalArea?.score ?? 0,
    };
  });

  const responses = staffResponses.map((r) => {
    const scores = questions.map((q) => r.answers[q.questionKey]).filter((v): v is number => v != null);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      id: r.key,
      timestamp: r.timestamp,
      name: r.respondentName || "匿名",
      avgScore: Math.round(avg * 100) / 100,
      freeText: r.freeText || null,
      questionScores: questions.map((q) => ({
        questionKey: q.questionKey,
        num: q.num,
        score: r.answers[q.questionKey] ?? null,
      })),
    };
  });

  const freeTexts = staffResponses
    .filter((r) => r.freeText && r.freeText.trim())
    .map((r) => ({
      text: r.freeText as string,
      name: r.respondentName || "匿名",
      timestamp: r.timestamp || "",
    }));

  const allClinicScores = questions.map((q) => clinicAvg.averages[q.questionKey]).filter((v): v is number => v != null);
  const clinicOverallAvg = allClinicScores.length > 0 ? allClinicScores.reduce((a, b) => a + b, 0) / allClinicScores.length : 0;

  let highestQ = { num: 0, score: 0 };
  let lowestQ = { num: 0, score: 5 };
  for (const q of questions) {
    const val = clinicAvg.averages[q.questionKey];
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
      ? questions.map((q) => ({
          id: q.questionKey,
          num: q.num,
          shortLabel: q.shortLabel,
          directorScore: directorResponse.answers[q.questionKey] ?? null,
          staffScore: clinicAvg.averages[q.questionKey] != null
            ? Math.round((clinicAvg.averages[q.questionKey] as number) * 100) / 100
            : null,
        }))
      : null,
  });
}
