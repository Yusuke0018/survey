import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb, getNewScoreAverages } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);
  const db = getDb();

  // Get all entities with staff responses
  const entities = db.prepare(`
    SELECT entity, COUNT(*) as staff_count FROM responses
    WHERE survey_id = ? AND type = 'staff' AND entity IS NOT NULL
    GROUP BY entity ORDER BY entity
  `).all(surveyId) as Array<{ entity: string; staff_count: number }>;

  // Check for manager/corporate responses per entity
  const managerCounts = db.prepare(`
    SELECT entity, COUNT(*) as count FROM responses
    WHERE survey_id = ? AND type = 'manager' AND entity IS NOT NULL
    GROUP BY entity
  `).all(surveyId) as Array<{ entity: string; count: number }>;
  const managerMap = new Map(managerCounts.map((m) => [m.entity, m.count]));

  const result = entities.map((e) => {
    const scores = getNewScoreAverages(surveyId, "staff", e.entity);
    const validScores = scores.filter((s) => s.avg_score != null);
    const overallAvg = validScores.length > 0
      ? validScores.reduce((sum, s) => sum + (s.avg_score || 0), 0) / validScores.length
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

    // Alert items (score < 3.0)
    const alertItems = validScores
      .filter((s) => (s.avg_score || 0) < 3.0)
      .map((s) => ({
        num: s.num,
        score: Math.round((s.avg_score || 0) * 100) / 100,
        label: s.short_label || "",
      }));

    return {
      entity: e.entity,
      staffCount: e.staff_count,
      hasManager: (managerMap.get(e.entity) || 0) > 0,
      overallAvg: Math.round(overallAvg * 100) / 100,
      areaAverages,
      alertItems,
    };
  });

  return NextResponse.json(result);
}
