import { QUESTIONS, getShortLabel } from "@/lib/questions";
import { getSurvey, queryAll, queryOne, type SurveyType } from "@/lib/db";

type ClinicResponseType = "staff" | "director";
type JigyotaiResponseType = "staff" | "manager" | "corporate";
export type SurveyResponseType = ClinicResponseType | JigyotaiResponseType;
type ClinicAnswerKey = (typeof QUESTIONS)[number]["id"];

interface ClinicLegacyRow extends Record<string, unknown> {
  id: number;
  clinic: string;
  respondent_name?: string | null;
  timestamp?: string | null;
  free_text?: string | null;
}

interface ClinicNewAnswerRow {
  response_id: number;
  type: ClinicResponseType;
  clinic: string;
  respondent_name: string | null;
  timestamp: string | null;
  free_text: string | null;
  num: number;
  score: number | null;
  skip_reason: string | null;
}

export interface ClinicNormalizedResponse {
  key: string;
  source: "legacy" | "new";
  rawId: number;
  type: ClinicResponseType;
  clinic: string;
  respondentName: string | null;
  timestamp: string | null;
  freeText: string | null;
  answers: Record<ClinicAnswerKey, number | null>;
  skipReasons: Record<ClinicAnswerKey, string | null>;
}

export interface SurveyResponseSummary {
  key: string;
  respondentType: SurveyResponseType;
  respondentTypeLabel: string;
  orgUnit: string;
  orgUnitLabel: string;
  name: string;
  timestamp: string | null;
  avgScore: number;
  lowestQuestion: string | null;
  lowestScore: number | null;
  hasFreeText: boolean;
}

export interface SurveyResponseDetail {
  key: string;
  respondentType: SurveyResponseType;
  respondentTypeLabel: string;
  orgUnit: string;
  orgUnitLabel: string;
  name: string;
  timestamp: string | null;
  avgScore: number;
  freeText: string | null;
  questions: Array<{
    id: string;
    num: number;
    text: string;
    shortLabel: string;
    area: string;
    areaLabel: string;
    value: number | null;
    skipReason: string | null;
    benchmark: number | null;
    diff: number | null;
  }>;
}

export interface SurveyFreeTextItem {
  key: string;
  respondentType: SurveyResponseType;
  respondentTypeLabel: string;
  orgUnit: string;
  orgUnitLabel: string;
  name: string;
  timestamp: string | null;
  text: string;
}

export interface RetentionPoint {
  unit: string;
  xScore: number;
  yScore: number;
  overallAvg: number;
  count: number;
  label: string;
  level: "critical" | "warning-manager" | "warning-other" | "good";
}

export type ClinicAverageScores = Record<ClinicAnswerKey, number | null> & { count: number };
export type ClinicAveragesByClinicRow = Record<ClinicAnswerKey, number | null> & {
  clinic: string;
  count: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function createClinicAnswerMap<T>(value: T): Record<ClinicAnswerKey, T> {
  return Object.fromEntries(QUESTIONS.map((question) => [question.id, value])) as Record<ClinicAnswerKey, T>;
}

function sortTimestampDesc(a: { timestamp: string | null; rawId?: number }, b: { timestamp: string | null; rawId?: number }) {
  const aTime = a.timestamp ? Date.parse(a.timestamp) : Number.NaN;
  const bTime = b.timestamp ? Date.parse(b.timestamp) : Number.NaN;

  if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
    return bTime - aTime;
  }
  if (!Number.isNaN(aTime) && Number.isNaN(bTime)) return -1;
  if (Number.isNaN(aTime) && !Number.isNaN(bTime)) return 1;
  return (b.rawId ?? 0) - (a.rawId ?? 0);
}

function normalizeClinicLegacyRows(rows: ClinicLegacyRow[], type: ClinicResponseType): ClinicNormalizedResponse[] {
  return rows.map((row) => {
    const answers = createClinicAnswerMap<number | null>(null);
    for (const question of QUESTIONS) {
      answers[question.id] = (row[question.id] as number | null) ?? null;
    }

    return {
      key: `legacy-${type}-${row.id}`,
      source: "legacy",
      rawId: row.id,
      type,
      clinic: row.clinic,
      respondentName: (row.respondent_name as string | null) ?? null,
      timestamp: (row.timestamp as string | null) ?? null,
      freeText: (row.free_text as string | null) ?? null,
      answers,
      skipReasons: createClinicAnswerMap<string | null>(null),
    };
  });
}

async function getClinicLegacyResponses(surveyId: number, type: ClinicResponseType, clinic?: string) {
  const table = type === "staff" ? "staff_responses" : "director_responses";
  const sql = clinic
    ? `SELECT * FROM ${table} WHERE survey_id = ? AND clinic = ?`
    : `SELECT * FROM ${table} WHERE survey_id = ?`;
  const args = clinic ? [surveyId, clinic] : [surveyId];
  const rows = await queryAll<ClinicLegacyRow>(sql, args);
  return normalizeClinicLegacyRows(rows, type);
}

async function getClinicNewResponses(surveyId: number, type?: ClinicResponseType, clinic?: string) {
  let sql = `
    SELECT
      r.id as response_id,
      r.type,
      r.clinic,
      r.respondent_name,
      r.timestamp,
      r.free_text,
      qt.num,
      ra.score,
      ra.skip_reason
    FROM responses r
    JOIN response_answers ra ON ra.response_id = r.id
    JOIN question_templates qt ON qt.id = ra.question_id
    WHERE r.survey_id = ?
      AND r.entity IS NULL
      AND r.type IN ('staff', 'director')
  `;
  const args: Array<string | number> = [surveyId];

  if (type) {
    sql += " AND r.type = ?";
    args.push(type);
  }

  if (clinic) {
    sql += " AND r.clinic = ?";
    args.push(clinic);
  }

  sql += " ORDER BY r.id, qt.num";

  const rows = await queryAll<ClinicNewAnswerRow>(sql, args);
  const grouped = new Map<number, ClinicNormalizedResponse>();

  for (const row of rows) {
    let response = grouped.get(row.response_id);
    if (!response) {
      response = {
        key: `new-${row.response_id}`,
        source: "new",
        rawId: row.response_id,
        type: row.type,
        clinic: row.clinic,
        respondentName: row.respondent_name,
        timestamp: row.timestamp,
        freeText: row.free_text,
        answers: createClinicAnswerMap<number | null>(null),
        skipReasons: createClinicAnswerMap<string | null>(null),
      };
      grouped.set(row.response_id, response);
    }

    const question = QUESTIONS.find((item) => item.num === row.num);
    if (!question) continue;
    response.answers[question.id] = row.score;
    response.skipReasons[question.id] = row.skip_reason;
  }

  return [...grouped.values()];
}

export async function getClinicNormalizedResponses(
  surveyId: number,
  options?: { type?: ClinicResponseType; clinic?: string }
) {
  const type = options?.type;
  const clinic = options?.clinic;

  const legacy = type
    ? await getClinicLegacyResponses(surveyId, type, clinic)
    : [
        ...(await getClinicLegacyResponses(surveyId, "staff", clinic)),
        ...(await getClinicLegacyResponses(surveyId, "director", clinic)),
      ];
  const current = await getClinicNewResponses(surveyId, type, clinic);

  return [...legacy, ...current].sort(sortTimestampDesc);
}

export async function getClinicAverageScores(
  surveyId: number,
  type: ClinicResponseType,
  clinic?: string
): Promise<ClinicAverageScores> {
  const responses = await getClinicNormalizedResponses(surveyId, { type, clinic });
  const totals = createClinicAnswerMap<number>(0);
  const counts = createClinicAnswerMap<number>(0);

  for (const response of responses) {
    for (const question of QUESTIONS) {
      const value = response.answers[question.id];
      if (value == null) continue;
      totals[question.id] += value;
      counts[question.id] += 1;
    }
  }

  const averages = createClinicAnswerMap<number | null>(null);
  for (const question of QUESTIONS) {
    averages[question.id] = counts[question.id] > 0 ? totals[question.id] / counts[question.id] : null;
  }

  return {
    ...averages,
    count: responses.length,
  };
}

export async function getClinicStaffAveragesByClinic(surveyId: number) {
  const responses = await getClinicNormalizedResponses(surveyId, { type: "staff" });
  const grouped = new Map<string, ClinicNormalizedResponse[]>();

  for (const response of responses) {
    const bucket = grouped.get(response.clinic) ?? [];
    bucket.push(response);
    grouped.set(response.clinic, bucket);
  }

  return [...grouped.entries()]
    .map(([clinic, clinicResponses]) => {
      const totals = createClinicAnswerMap<number>(0);
      const counts = createClinicAnswerMap<number>(0);

      for (const response of clinicResponses) {
        for (const question of QUESTIONS) {
          const value = response.answers[question.id];
          if (value == null) continue;
          totals[question.id] += value;
          counts[question.id] += 1;
        }
      }

      const averages = createClinicAnswerMap<number | null>(null);
      for (const question of QUESTIONS) {
        averages[question.id] = counts[question.id] > 0 ? totals[question.id] / counts[question.id] : null;
      }

      return {
        clinic,
        count: clinicResponses.length,
        ...averages,
      };
    })
    .sort((a, b) => a.clinic.localeCompare(b.clinic, "ja")) as ClinicAveragesByClinicRow[];
}

export async function getClinicLatestDirectorByClinic(surveyId: number) {
  const responses = await getClinicNormalizedResponses(surveyId, { type: "director" });
  const latest = new Map<string, ClinicNormalizedResponse>();

  for (const response of responses) {
    const current = latest.get(response.clinic);
    if (!current || sortTimestampDesc(response, current) < 0) {
      latest.set(response.clinic, response);
    }
  }

  return latest;
}

function getSurveyResponseTypeLabel(type: SurveyResponseType) {
  switch (type) {
    case "director":
      return "院長";
    case "manager":
      return "事業責任者/現場責任者";
    case "corporate":
      return "経営企画室";
    default:
      return "スタッフ";
  }
}

function summarizeAnswers(answers: Array<{ num: number; score: number | null }>) {
  const valid = answers.filter((answer) => answer.score != null);
  const avgScore = valid.length > 0
    ? round2(valid.reduce((sum, answer) => sum + (answer.score ?? 0), 0) / valid.length)
    : 0;

  const lowest = valid.reduce<{ num: number; score: number } | null>((min, answer) => {
    if (answer.score == null) return min;
    if (!min || answer.score < min.score) {
      return { num: answer.num, score: answer.score };
    }
    return min;
  }, null);

  return {
    avgScore,
    lowestQuestion: lowest ? `Q${lowest.num}` : null,
    lowestScore: lowest?.score ?? null,
  };
}

function buildClinicResponseSummary(response: ClinicNormalizedResponse): SurveyResponseSummary {
  const scores = QUESTIONS.map((question) => ({ num: question.num, score: response.answers[question.id] }));
  const summary = summarizeAnswers(scores);

  return {
    key: response.key,
    respondentType: response.type,
    respondentTypeLabel: getSurveyResponseTypeLabel(response.type),
    orgUnit: response.clinic,
    orgUnitLabel: "拠点",
    name: response.respondentName || "匿名",
    timestamp: response.timestamp,
    avgScore: summary.avgScore,
    lowestQuestion: summary.lowestQuestion,
    lowestScore: summary.lowestScore,
    hasFreeText: !!response.freeText?.trim(),
  };
}

async function getJigyotaiResponseSummaries(
  surveyId: number,
  options?: { type?: JigyotaiResponseType; entity?: string }
) {
  let sql = `
    SELECT
      r.id as response_id,
      r.type,
      r.entity,
      r.respondent_name,
      r.timestamp,
      r.free_text,
      qt.num,
      ra.score
    FROM responses r
    JOIN response_answers ra ON ra.response_id = r.id
    JOIN question_templates qt ON qt.id = ra.question_id
    WHERE r.survey_id = ?
      AND r.entity IS NOT NULL
  `;
  const args: Array<string | number> = [surveyId];

  if (options?.type) {
    sql += " AND r.type = ?";
    args.push(options.type);
  }

  if (options?.entity) {
    sql += " AND r.entity = ?";
    args.push(options.entity);
  }

  sql += " ORDER BY r.id, qt.num";

  const rows = await queryAll<{
    response_id: number;
    type: JigyotaiResponseType;
    entity: string;
    respondent_name: string | null;
    timestamp: string | null;
    free_text: string | null;
    num: number;
    score: number | null;
  }>(sql, args);

  const grouped = new Map<number, {
    type: JigyotaiResponseType;
    entity: string;
    respondentName: string | null;
    timestamp: string | null;
    freeText: string | null;
    scores: Array<{ num: number; score: number | null }>;
  }>();

  for (const row of rows) {
    const bucket = grouped.get(row.response_id) ?? {
      type: row.type,
      entity: row.entity,
      respondentName: row.respondent_name,
      timestamp: row.timestamp,
      freeText: row.free_text,
      scores: [],
    };
    bucket.scores.push({ num: row.num, score: row.score });
    grouped.set(row.response_id, bucket);
  }

  return [...grouped.entries()]
    .sort((a, b) => sortTimestampDesc(
      { timestamp: a[1].timestamp, rawId: a[0] },
      { timestamp: b[1].timestamp, rawId: b[0] }
    ))
    .map(([responseId, response]) => {
      const summary = summarizeAnswers(response.scores);
      return {
        key: `new-${responseId}`,
        respondentType: response.type,
        respondentTypeLabel: getSurveyResponseTypeLabel(response.type),
        orgUnit: response.entity,
        orgUnitLabel: "事業体",
        name: response.respondentName || "匿名",
        timestamp: response.timestamp,
        avgScore: summary.avgScore,
        lowestQuestion: summary.lowestQuestion,
        lowestScore: summary.lowestScore,
        hasFreeText: !!response.freeText?.trim(),
      };
    });
}

export async function getSurveyResponseSummaries(
  surveyId: number,
  options?: { type?: SurveyResponseType; orgUnit?: string }
) {
  const survey = await getSurvey(surveyId);
  if (!survey) return [];

  if (survey.survey_type === "clinic") {
    return (await getClinicNormalizedResponses(surveyId, {
      type: options?.type as ClinicResponseType | undefined,
      clinic: options?.orgUnit,
    })).map(buildClinicResponseSummary);
  }

  return getJigyotaiResponseSummaries(surveyId, {
    type: options?.type as JigyotaiResponseType | undefined,
    entity: options?.orgUnit,
  });
}

async function buildClinicDetail(response: ClinicNormalizedResponse, surveyId: number): Promise<SurveyResponseDetail> {
  const benchmark = await getClinicAverageScores(surveyId, response.type, response.clinic);
  const questions = QUESTIONS.map((question) => {
    const value = response.answers[question.id];
    const benchmarkValue = benchmark[question.id];
    return {
      id: question.id,
      num: question.num,
      text: response.type === "director" ? question.directorText : question.staffText,
      shortLabel: getShortLabel(question),
      area: question.area,
      areaLabel: question.areaLabel,
      value,
      skipReason: response.skipReasons[question.id],
      benchmark: benchmarkValue != null ? round2(benchmarkValue) : null,
      diff: value != null && benchmarkValue != null ? round2(value - benchmarkValue) : null,
    };
  });

  const summary = summarizeAnswers(questions.map((question) => ({ num: question.num, score: question.value })));

  return {
    key: response.key,
    respondentType: response.type,
    respondentTypeLabel: getSurveyResponseTypeLabel(response.type),
    orgUnit: response.clinic,
    orgUnitLabel: "拠点",
    name: response.respondentName || "匿名",
    timestamp: response.timestamp,
    avgScore: summary.avgScore,
    freeText: response.freeText,
    questions,
  };
}

async function buildJigyotaiDetail(responseId: number, surveyId: number): Promise<SurveyResponseDetail | null> {
  const response = await queryOne<{
    id: number;
    type: JigyotaiResponseType;
    entity: string;
    respondent_name: string | null;
    timestamp: string | null;
    free_text: string | null;
  }>(
    `
      SELECT id, type, entity, respondent_name, timestamp, free_text
      FROM responses
      WHERE id = ? AND survey_id = ? AND entity IS NOT NULL
    `,
    [responseId, surveyId]
  );

  if (!response) return null;

  const answers = await queryAll<{
    question_id: number;
    num: number;
    text: string | null;
    short_label: string | null;
    area: string;
    area_label: string;
    score: number | null;
    skip_reason: string | null;
  }>(
    `
      SELECT
        qt.id as question_id,
        qt.num,
        qt.text,
        qt.short_label,
        qt.area,
        qt.area_label,
        ra.score,
        ra.skip_reason
      FROM response_answers ra
      JOIN question_templates qt ON qt.id = ra.question_id
      WHERE ra.response_id = ?
      ORDER BY qt.num
    `,
    [responseId]
  );

  const benchmarkRows = await queryAll<{ num: number; avg_score: number | null }>(
    `
      SELECT qt.num, AVG(ra.score) as avg_score
      FROM response_answers ra
      JOIN responses r ON r.id = ra.response_id
      JOIN question_templates qt ON qt.id = ra.question_id
      WHERE r.survey_id = ? AND r.type = ? AND r.entity = ?
      GROUP BY qt.num
    `,
    [surveyId, response.type, response.entity]
  );
  const benchmarkMap = new Map(benchmarkRows.map((row) => [row.num, row.avg_score]));

  const questions = answers.map((answer) => {
    const benchmark = benchmarkMap.get(answer.num) ?? null;
    return {
      id: String(answer.question_id),
      num: answer.num,
      text: answer.text || "",
      shortLabel: answer.short_label || (answer.text || "").slice(0, 10),
      area: answer.area,
      areaLabel: answer.area_label || answer.area,
      value: answer.score,
      skipReason: answer.skip_reason,
      benchmark: benchmark != null ? round2(benchmark) : null,
      diff: answer.score != null && benchmark != null ? round2(answer.score - benchmark) : null,
    };
  });

  const summary = summarizeAnswers(questions.map((question) => ({ num: question.num, score: question.value })));

  return {
    key: `new-${response.id}`,
    respondentType: response.type,
    respondentTypeLabel: getSurveyResponseTypeLabel(response.type),
    orgUnit: response.entity,
    orgUnitLabel: "事業体",
    name: response.respondent_name || "匿名",
    timestamp: response.timestamp,
    avgScore: summary.avgScore,
    freeText: response.free_text,
    questions,
  };
}

export async function getSurveyResponseDetail(surveyId: number, responseKey: string) {
  const survey = await getSurvey(surveyId);
  if (!survey) return null;

  if (survey.survey_type === "clinic") {
    const response = (await getClinicNormalizedResponses(surveyId)).find((item) => item.key === responseKey);
    return response ? buildClinicDetail(response, surveyId) : null;
  }

  const match = /^new-(\d+)$/.exec(responseKey);
  if (!match) return null;
  return buildJigyotaiDetail(Number.parseInt(match[1], 10), surveyId);
}

export async function getSurveyFreeTextItems(
  surveyId: number,
  options?: { type?: SurveyResponseType; orgUnit?: string }
) {
  const summaries = await getSurveyResponseSummaries(surveyId, options);
  const results: SurveyFreeTextItem[] = [];

  for (const summary of summaries) {
    const detail = await getSurveyResponseDetail(surveyId, summary.key);
    if (!detail?.freeText?.trim()) continue;

    results.push({
      key: summary.key,
      respondentType: summary.respondentType,
      respondentTypeLabel: summary.respondentTypeLabel,
      orgUnit: summary.orgUnit,
      orgUnitLabel: summary.orgUnitLabel,
      name: summary.name,
      timestamp: summary.timestamp,
      text: detail.freeText,
    });
  }

  return results;
}

function classifyRetention(xScore: number, yScore: number) {
  if (xScore < 3.0 && yScore < 3.0) {
    return { label: "要緊急対応（上司関係×継続意向）", level: "critical" as const };
  }
  if (xScore < 3.0 && yScore >= 3.0) {
    return { label: "上司関係に課題あり", level: "warning-manager" as const };
  }
  if (xScore >= 3.0 && yScore < 3.0) {
    return { label: "上司以外の要因で離脱リスク", level: "warning-other" as const };
  }
  return { label: "概ね良好", level: "good" as const };
}

export async function getRetentionDataset(surveyId: number): Promise<{
  surveyType: SurveyType;
  unitLabel: string;
  xQuestionNum: number;
  yQuestionNum: number;
  xLabel: string;
  yLabel: string;
  data: RetentionPoint[];
}> {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    return {
      surveyType: "clinic",
      unitLabel: "拠点",
      xQuestionNum: 7,
      yQuestionNum: 15,
      xLabel: "院長に相談しやすい",
      yLabel: "働き続けたい",
      data: [],
    };
  }

  if (survey.survey_type === "jigyotai") {
    const entities = await queryAll<{ entity: string }>(
      `
        SELECT DISTINCT entity
        FROM responses
        WHERE survey_id = ? AND type = 'staff' AND entity IS NOT NULL
        ORDER BY entity
      `,
      [surveyId]
    );

    const data: RetentionPoint[] = [];
    for (const { entity } of entities) {
      const scores = await queryAll<{ num: number; avg_score: number | null; response_count: number }>(
        `
          SELECT qt.num, AVG(ra.score) as avg_score, COUNT(DISTINCT r.id) as response_count
          FROM response_answers ra
          JOIN responses r ON r.id = ra.response_id
          JOIN question_templates qt ON qt.id = ra.question_id
          WHERE r.survey_id = ? AND r.type = 'staff' AND r.entity = ?
          GROUP BY qt.num
        `,
        [surveyId, entity]
      );

      const scoreMap = new Map(scores.map((score) => [score.num, score.avg_score]));
      const xScore = round2((scoreMap.get(7) ?? 0) as number);
      const yScore = round2((scoreMap.get(19) ?? 0) as number);
      const valid = scores.map((score) => score.avg_score).filter((score): score is number => score != null);
      const overallAvg = valid.length > 0 ? round2(valid.reduce((sum, score) => sum + score, 0) / valid.length) : 0;
      const count = scores[0]?.response_count ?? 0;
      const classification = classifyRetention(xScore, yScore);

      data.push({
        unit: entity,
        xScore,
        yScore,
        overallAvg,
        count,
        label: classification.label,
        level: classification.level,
      });
    }

    return {
      surveyType: "jigyotai",
      unitLabel: "事業体",
      xQuestionNum: 7,
      yQuestionNum: 19,
      xLabel: "責任者に相談しやすい",
      yLabel: "今後も関わりたい",
      data,
    };
  }

  const clinicAverages = await getClinicStaffAveragesByClinic(surveyId);
  const data = clinicAverages.map((clinicAverage) => {
    const xScore = clinicAverage.q7 != null ? round2(clinicAverage.q7) : 0;
    const yScore = clinicAverage.q15 != null ? round2(clinicAverage.q15) : 0;
    const valid = QUESTIONS.map((question) => clinicAverage[question.id]).filter((score): score is number => score != null);
    const overallAvg = valid.length > 0 ? round2(valid.reduce((sum, score) => sum + score, 0) / valid.length) : 0;
    const classification = classifyRetention(xScore, yScore);

    return {
      unit: clinicAverage.clinic,
      xScore,
      yScore,
      overallAvg,
      count: clinicAverage.count,
      label: classification.label,
      level: classification.level,
    };
  });

  return {
    surveyType: "clinic",
    unitLabel: "拠点",
    xQuestionNum: 7,
    yQuestionNum: 15,
    xLabel: "院長に相談しやすい",
    yLabel: "働き続けたい",
    data,
  };
}
