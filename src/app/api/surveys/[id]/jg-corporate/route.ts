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

  // Get entities that have corporate responses
  const entities = db.prepare(`
    SELECT DISTINCT entity FROM responses
    WHERE survey_id = ? AND type = 'corporate' AND entity IS NOT NULL
    ORDER BY entity
  `).all(surveyId) as Array<{ entity: string }>;

  // Overall corporate averages (all entities)
  const overallScores = getNewScoreAverages(surveyId, "corporate");
  const overallValid = overallScores.filter((s) => s.avg_score != null);
  const overallAvg = overallValid.length > 0
    ? Math.round((overallValid.reduce((sum, s) => sum + (s.avg_score || 0), 0) / overallValid.length) * 100) / 100
    : 0;

  // Per-entity corporate scores
  const entityData = entities.map((e) => {
    const scores = getNewScoreAverages(surveyId, "corporate", e.entity);
    const validScores = scores.filter((s) => s.avg_score != null);
    const avg = validScores.length > 0
      ? Math.round((validScores.reduce((sum, s) => sum + (s.avg_score || 0), 0) / validScores.length) * 100) / 100
      : 0;

    // Area averages
    const areaMap: Record<string, number[]> = {};
    for (const s of scores) {
      if (!areaMap[s.area]) areaMap[s.area] = [];
      if (s.avg_score != null) areaMap[s.area].push(s.avg_score);
    }
    const areaAverages = Object.entries(areaMap).map(([area, vals]) => ({
      area,
      score: vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        : 0,
    }));

    // Get free text comments
    const comments = db.prepare(`
      SELECT free_text FROM responses
      WHERE survey_id = ? AND type = 'corporate' AND entity = ? AND free_text IS NOT NULL AND free_text != ''
    `).all(surveyId, e.entity) as Array<{ free_text: string }>;

    return {
      entity: e.entity,
      overallAvg: avg,
      areaAverages,
      scores: validScores.map((s) => ({
        num: s.num,
        shortLabel: s.short_label || "",
        area: s.area,
        score: s.avg_score != null ? Math.round(s.avg_score * 100) / 100 : null,
      })),
      comments: comments.map((c) => c.free_text),
    };
  });

  // All corporate free text
  const allComments = db.prepare(`
    SELECT r.entity, r.free_text FROM responses r
    WHERE r.survey_id = ? AND r.type = 'corporate' AND r.free_text IS NOT NULL AND r.free_text != ''
    ORDER BY r.entity
  `).all(surveyId) as Array<{ entity: string; free_text: string }>;

  return NextResponse.json({
    overallAvg,
    overallScores: overallScores.map((s) => ({
      num: s.num,
      shortLabel: s.short_label || "",
      area: s.area,
      score: s.avg_score != null ? Math.round(s.avg_score * 100) / 100 : null,
    })),
    entities: entityData,
    allComments,
  });
}
