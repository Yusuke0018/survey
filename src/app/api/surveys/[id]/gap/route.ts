import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { QUESTIONS, getShortLabel } from "@/lib/questions";
import { getClinicLatestDirectorByClinic, getClinicStaffAveragesByClinic } from "@/lib/survey-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);

  const clinicAverages = await getClinicStaffAveragesByClinic(surveyId);
  const directorByClinic = await getClinicLatestDirectorByClinic(surveyId);

  const gaps = clinicAverages
    .filter((ca) => directorByClinic.has(ca.clinic))
    .map((ca) => {
      const director = directorByClinic.get(ca.clinic)!;

      const questionGaps = QUESTIONS.map((q) => {
        const staffScore = ca[q.id] != null ? Math.round((ca[q.id] as number) * 100) / 100 : null;
        const directorScore = director.answers[q.id];
        const gap = staffScore != null && directorScore != null ? Math.round((directorScore - staffScore) * 100) / 100 : null;
        return {
          id: q.id,
          num: q.num,
          shortLabel: getShortLabel(q),
          area: q.area,
          areaLabel: q.areaLabel,
          staffScore,
          directorScore,
          gap,
        };
      });

      const staffScores = QUESTIONS.map((q) => ca[q.id] as number | null).filter((v): v is number => v != null);
      const directorScores = QUESTIONS.map((q) => director.answers[q.id]).filter((v): v is number => v != null);
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
