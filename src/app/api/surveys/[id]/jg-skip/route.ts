import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { queryAll } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const surveyId = parseInt(id);

  // Get all skip-eligible questions (those with skip_options set)
  const questions = await queryAll<{
    id: number;
    num: number;
    text: string;
    short_label: string;
    area: string;
    respondent_type: string;
    skip_options: string;
  }>(`
    SELECT id, num, text, short_label, area, respondent_type, skip_options
    FROM question_templates
    WHERE survey_id = ? AND skip_options IS NOT NULL AND skip_options != ''
    ORDER BY respondent_type, num
  `, [surveyId]);

  // Get entities
  const entities = await queryAll<{ entity: string }>(`
    SELECT DISTINCT entity FROM responses
    WHERE survey_id = ? AND entity IS NOT NULL
    ORDER BY entity
  `, [surveyId]);

  // Get skip counts per entity per question
  const skipData = await queryAll<{
    entity: string;
    question_id: number;
    skip_reason: string;
    count: number;
  }>(`
    SELECT r.entity, ra.question_id, ra.skip_reason, COUNT(*) as count
    FROM response_answers ra
    JOIN responses r ON ra.response_id = r.id
    WHERE r.survey_id = ? AND ra.skip_reason IS NOT NULL AND r.entity IS NOT NULL
    GROUP BY r.entity, ra.question_id, ra.skip_reason
  `, [surveyId]);

  // Get total response counts per entity per respondent type
  const responseCounts = await queryAll<{ entity: string; type: string; count: number }>(`
    SELECT entity, type, COUNT(*) as count FROM responses
    WHERE survey_id = ? AND entity IS NOT NULL
    GROUP BY entity, type
  `, [surveyId]);

  // Build skip map: entity -> question_id -> { reason: count }
  const skipMap: Record<string, Record<number, Record<string, number>>> = {};
  for (const s of skipData) {
    if (!skipMap[s.entity]) skipMap[s.entity] = {};
    if (!skipMap[s.entity][s.question_id]) skipMap[s.entity][s.question_id] = {};
    skipMap[s.entity][s.question_id][s.skip_reason] = s.count;
  }

  // Build response count map
  const responseCountMap: Record<string, Record<string, number>> = {};
  for (const rc of responseCounts) {
    if (!responseCountMap[rc.entity]) responseCountMap[rc.entity] = {};
    responseCountMap[rc.entity][rc.type] = rc.count;
  }

  // Build result
  const rows = questions.map((q) => {
    const entityData: Record<string, {
      skipCount: number;
      totalResponses: number;
      skipRate: number;
      reasons: Record<string, number>;
    }> = {};

    for (const e of entities) {
      const skips = skipMap[e.entity]?.[q.id] || {};
      const totalSkips = Object.values(skips).reduce((sum, c) => sum + c, 0);
      const totalResponses = responseCountMap[e.entity]?.[q.respondent_type] || 0;
      entityData[e.entity] = {
        skipCount: totalSkips,
        totalResponses,
        skipRate: totalResponses > 0 ? Math.round((totalSkips / totalResponses) * 100) : 0,
        reasons: skips,
      };
    }

    return {
      questionId: q.id,
      num: q.num,
      text: q.text,
      shortLabel: q.short_label,
      area: q.area,
      respondentType: q.respondent_type,
      skipOptions: q.skip_options,
      entities: entityData,
    };
  });

  return NextResponse.json({
    entities: entities.map((e) => e.entity),
    rows,
  });
}
