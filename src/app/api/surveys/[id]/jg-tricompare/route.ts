import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb, getNewScoreAverages } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const db = getDb();

  // Get all entities
  const entities = db.prepare(`
    SELECT DISTINCT entity FROM responses
    WHERE survey_id = ? AND entity IS NOT NULL
    ORDER BY entity
  `).all(surveyId) as Array<{ entity: string }>;

  const result = entities.map((e) => {
    const staffScores = getNewScoreAverages(surveyId, "staff", e.entity);
    const managerScores = getNewScoreAverages(surveyId, "manager", e.entity);
    const corporateScores = getNewScoreAverages(surveyId, "corporate", e.entity);

    // Build manager score map by coreId (maps to staff question num)
    const managerByCoreId = new Map(
      managerScores.filter((s) => s.core_id != null).map((s) => [s.core_id!, s])
    );

    // Build comparison rows: for each staff question, find matching manager score via coreId
    const comparisons = staffScores.map((sq) => {
      const managerMatch = managerByCoreId.get(sq.num);
      // For corporate, approximate by position/index (no direct coreId mapping)
      // Corporate answers are per-entity, so we use entity-filtered corporate scores
      return {
        staffNum: sq.num,
        shortLabel: sq.short_label || "",
        area: sq.area,
        staffScore: sq.avg_score != null ? Math.round(sq.avg_score * 100) / 100 : null,
        managerScore: managerMatch?.avg_score != null
          ? Math.round(managerMatch.avg_score * 100) / 100
          : null,
        managerNum: managerMatch?.num || null,
        gap: (sq.avg_score != null && managerMatch?.avg_score != null)
          ? Math.round((managerMatch.avg_score - sq.avg_score) * 100) / 100
          : null,
      };
    });

    // Corporate overall average per entity
    const corpValid = corporateScores.filter((s) => s.avg_score != null);
    const corporateAvg = corpValid.length > 0
      ? Math.round((corpValid.reduce((sum, s) => sum + (s.avg_score || 0), 0) / corpValid.length) * 100) / 100
      : null;

    // Staff overall
    const staffValid = staffScores.filter((s) => s.avg_score != null);
    const staffAvg = staffValid.length > 0
      ? Math.round((staffValid.reduce((sum, s) => sum + (s.avg_score || 0), 0) / staffValid.length) * 100) / 100
      : null;

    // Manager overall
    const managerValid = managerScores.filter((s) => s.avg_score != null);
    const managerAvg = managerValid.length > 0
      ? Math.round((managerValid.reduce((sum, s) => sum + (s.avg_score || 0), 0) / managerValid.length) * 100) / 100
      : null;

    return {
      entity: e.entity,
      staffAvg,
      managerAvg,
      corporateAvg,
      comparisons,
    };
  });

  return NextResponse.json(result);
}
