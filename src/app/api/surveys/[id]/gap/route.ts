import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClinicLatestDirectorByClinic, getClinicStaffAveragesByClinic } from "@/lib/survey-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);

  const clinicData = await getClinicStaffAveragesByClinic(surveyId);
  const directorByClinic = await getClinicLatestDirectorByClinic(surveyId);
  const questions = clinicData.questions;

  const gaps = clinicData.rows
    .filter((ca) => directorByClinic.has(ca.clinic))
    .map((ca) => {
      const director = directorByClinic.get(ca.clinic)!;

      const questionGaps = questions.map((q) => {
        const staffScore = ca.averages[q.questionKey] != null
          ? Math.round((ca.averages[q.questionKey] as number) * 100) / 100
          : null;
        const directorScore = director.answers[q.questionKey] ?? null;
        const gap = staffScore != null && directorScore != null
          ? Math.round((directorScore - staffScore) * 100) / 100
          : null;
        return {
          id: q.questionKey,
          num: q.num,
          shortLabel: q.shortLabel,
          area: q.area,
          areaLabel: q.areaLabel,
          staffScore,
          directorScore,
          gap,
        };
      });

      const staffScores = questions.map((q) => ca.averages[q.questionKey]).filter((v): v is number => v != null);
      const directorScores = questions.map((q) => director.answers[q.questionKey]).filter((v): v is number => v != null);
      const staffAvg = staffScores.length > 0 ? staffScores.reduce((a, b) => a + b, 0) / staffScores.length : 0;
      const directorAvg = directorScores.length > 0 ? directorScores.reduce((a, b) => a + b, 0) / directorScores.length : 0;

      const maxGap = questionGaps.reduce(
        (max, g) => (g.gap != null && Math.abs(g.gap) > Math.abs(max.gap || 0) ? g : max),
        questionGaps[0]
      );

      return {
        clinic: ca.clinic,
        staffAvg: Math.round(staffAvg * 100) / 100,
        directorAvg: Math.round(directorAvg * 100) / 100,
        gapAvg: Math.round((directorAvg - staffAvg) * 100) / 100,
        maxGap: {
          num: maxGap.num,
          gap: maxGap.gap,
          shortLabel: maxGap.shortLabel,
        },
        questionGaps,
      };
    });

  return NextResponse.json(gaps);
}
