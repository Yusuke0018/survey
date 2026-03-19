import { QUESTIONS, getShortLabel } from "@/lib/questions";
import { getDb, getSurvey, type SurveyType } from "@/lib/db";

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

function createClinicAnswerMap<T>(value: T): Record<ClinicAnswerKey, T> {
  return Object.fromEntries(QUESTIONS.map((q) => [q.id, value])) as Record<ClinicAnswerKey, T>;
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
    for (const q of QUESTIONS) {
      answers[q.id] = (row[q.id] as number | null) ?? null;
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

function getClinicLegacyResponses(surveyId: number, type: ClinicResponseType, clinic?: string): ClinicNormalizedResponse[] {
  const db = getDb();
  const table = type === "staff" ? "staff_responses" : "director_responses";
  const rows = (clinic
    ? db.prepare(`SELECT * FROM ${table} WHERE survey_id = ? AND clinic = ?`).all(surveyId, clinic)
    : db.prepare(`SELECT * FROM ${table} WHERE survey_id = ?`).all(surveyId)) as ClinicLegacyRow[];
  return normalizeClinicLegacyRows(rows, type);
}

function getClinicNewResponses(surveyId: number, type?: ClinicResponseType, clinic?: string): ClinicNormalizedResponse[] {
  const db = getDb();

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
  const params: Array<string | number> = [surveyId];

  if (type) {
    sql += " AND r.type = ?";
    params.push(type);
  }

  if (clinic) {
    sql += " AND r.clinic = ?";
    params.push(clinic);
  }

  sql += " ORDER BY r.id, qt.num";

  const rows = db.prepare(sql).all(...params) as ClinicNewAnswerRow[];
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

    const question = QUESTIONS.find((q) => q.num === row.num);
    if (!question) continue;
    response.answers[question.id] = row.score;
    response.skipReasons[question.id] = row.skip_reason;
  }

  return [...grouped.values()];
}

export function getClinicNormalizedResponses(
  surveyId: number,
  options?: { type?: ClinicResponseType; clinic?: string }
): ClinicNormalizedResponse[] {
  const type = options?.type;
  const clinic = options?.clinic;

  const legacy = type
    ? getClinicLegacyResponses(surveyId, type, clinic)
    : [
        ...getClinicLegacyResponses(surveyId, "staff", clinic),
        ...getClinicLegacyResponses(surveyId, "director", clinic),
      ];
  const current = getClinicNewResponses(surveyId, type, clinic);

  return [...legacy, ...current].sort(sortTimestampDesc);
}

export function getClinicAverageScores(
  surveyId: number,
  type: ClinicResponseType,
  clinic?: string
): Record<ClinicAnswerKey, number | null> & { count: number } {
  const responses = getClinicNormalizedResponses(surveyId, { type, clinic });
  const totals = createClinicAnswerMap<number>(0);
  const counts = createClinicAnswerMap<number>(0);

  for (const response of responses) {
    for (const q of QUESTIONS) {
      const value = response.answers[q.id];
      if (value == null) continue;
      totals[q.id] += value;
      counts[q.id] += 1;
    }
  }

  const averages = createClinicAnswerMap<number | null>(null);
  for (const q of QUESTIONS) {
    averages[q.id] = counts[q.id] > 0 ? totals[q.id] / counts[q.id] : null;
  }

  return {
    ...averages,
    count: responses.length,
  };
}

export function getClinicStaffAveragesByClinic(surveyId: number) {
  const responses = getClinicNormalizedResponses(surveyId, { type: "staff" });
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
        for (const q of QUESTIONS) {
          const value = response.answers[q.id];
          if (value == null) continue;
          totals[q.id] += value;
          counts[q.id] += 1;
        }
      }

      const averages = createClinicAnswerMap<number | null>(null);
      for (const q of QUESTIONS) {
        averages[q.id] = counts[q.id] > 0 ? totals[q.id] / counts[q.id] : null;
      }

      return {
        clinic,
        count: clinicResponses.length,
        ...averages,
      };
    })
    .sort((a, b) => a.clinic.localeCompare(b.clinic, "ja"));
}

export function getClinicLatestDirectorByClinic(surveyId: number) {
  const responses = getClinicNormalizedResponses(surveyId, { type: "director" });
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

function summarizeAnswers(
  answers: Array<{ num: number; score: number | null }>
): { avgScore: number; lowestQuestion: string | null; lowestScore: number | null } {
  const valid = answers.filter((answer) => answer.score != null);
  const avgScore = valid.length > 0
    ? Math.round((valid.reduce((sum, answer) => sum + (answer.score ?? 0), 0) / valid.length) * 100) / 100
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
  const scores = QUESTIONS.map((q) => ({ num: q.num, score: response.answers[q.id] }));
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

function getJigyotaiResponseSummaries(
  surveyId: number,
  options?: { type?: JigyotaiResponseType; entity?: string }
): SurveyResponseSummary[] {
  const db = getDb();

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
  const params: Array<string | number> = [surveyId];

  if (options?.type) {
    sql += " AND r.type = ?";
    params.push(options.type);
  }

  if (options?.entity) {
    sql += " AND r.entity = ?";
    params.push(options.entity);
  }

  sql += " ORDER BY r.id, qt.num";

  const rows = db.prepare(sql).all(...params) as Array<{
    response_id: number;
    type: JigyotaiResponseType;
    entity: string;
    respondent_name: string | null;
    timestamp: string | null;
    free_text: string | null;
    num: number;
    score: number | null;
  }>;

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

export function getSurveyResponseSummaries(
  surveyId: number,
  options?: { type?: SurveyResponseType; orgUnit?: string }
): SurveyResponseSummary[] {
  const survey = getSurvey(surveyId);
  if (!survey) return [];

  if (survey.survey_type === "clinic") {
    const clinicType = options?.type as ClinicResponseType | undefined;
    return getClinicNormalizedResponses(surveyId, {
      type: clinicType,
      clinic: options?.orgUnit,
    }).map(buildClinicResponseSummary);
  }

  return getJigyotaiResponseSummaries(surveyId, {
    type: options?.type as JigyotaiResponseType | undefined,
    entity: options?.orgUnit,
  });
}

function buildClinicDetail(response: ClinicNormalizedResponse, surveyId: number): SurveyResponseDetail {
  const benchmark = getClinicAverageScores(surveyId, response.type, response.clinic);
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
      benchmark: benchmarkValue != null ? Math.round(benchmarkValue * 100) / 100 : null,
      diff: value != null && benchmarkValue != null ? Math.round((value - benchmarkValue) * 100) / 100 : null,
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

function buildJigyotaiDetail(responseId: number, surveyId: number): SurveyResponseDetail | null {
  const db = getDb();
  const response = db.prepare(`
    SELECT id, type, entity, respondent_name, timestamp, free_text
    FROM responses
    WHERE id = ? AND survey_id = ? AND entity IS NOT NULL
  `).get(responseId, surveyId) as {
    id: number;
    type: JigyotaiResponseType;
    entity: string;
    respondent_name: string | null;
    timestamp: string | null;
    free_text: string | null;
  } | undefined;

  if (!response) return null;

  const answers = db.prepare(`
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
  `).all(responseId) as Array<{
    question_id: number;
    num: number;
    text: string | null;
    short_label: string | null;
    area: string;
    area_label: string;
    score: number | null;
    skip_reason: string | null;
  }>;

  const benchmarkRows = db.prepare(`
    SELECT qt.num, AVG(ra.score) as avg_score
    FROM response_answers ra
    JOIN responses r ON r.id = ra.response_id
    JOIN question_templates qt ON qt.id = ra.question_id
    WHERE r.survey_id = ? AND r.type = ? AND r.entity = ?
    GROUP BY qt.num
  `).all(surveyId, response.type, response.entity) as Array<{ num: number; avg_score: number | null }>;
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
      benchmark: benchmark != null ? Math.round(benchmark * 100) / 100 : null,
      diff: answer.score != null && benchmark != null ? Math.round((answer.score - benchmark) * 100) / 100 : null,
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

export function getSurveyResponseDetail(surveyId: number, responseKey: string): SurveyResponseDetail | null {
  const survey = getSurvey(surveyId);
  if (!survey) return null;

  if (survey.survey_type === "clinic") {
    const response = getClinicNormalizedResponses(surveyId).find((item) => item.key === responseKey);
    return response ? buildClinicDetail(response, surveyId) : null;
  }

  const match = /^new-(\d+)$/.exec(responseKey);
  if (!match) return null;
  return buildJigyotaiDetail(parseInt(match[1], 10), surveyId);
}

export function getSurveyFreeTextItems(
  surveyId: number,
  options?: { type?: SurveyResponseType; orgUnit?: string }
): SurveyFreeTextItem[] {
  return getSurveyResponseSummaries(surveyId, options)
    .map((summary) => {
      const detail = getSurveyResponseDetail(surveyId, summary.key);
      if (!detail?.freeText?.trim()) return null;
      return {
        key: summary.key,
        respondentType: summary.respondentType,
        respondentTypeLabel: summary.respondentTypeLabel,
        orgUnit: summary.orgUnit,
        orgUnitLabel: summary.orgUnitLabel,
        name: summary.name,
        timestamp: summary.timestamp,
        text: detail.freeText,
      };
    })
    .filter((item): item is SurveyFreeTextItem => item !== null);
}

function classifyRetention(xScore: number, yScore: number) {
  if (xScore < 3.0 && yScore < 3.0) {
    return {
      label: "要緊急対応（上司関係×継続意向）",
      level: "critical" as const,
    };
  }

  if (xScore < 3.0 && yScore >= 3.0) {
    return {
      label: "上司関係に課題あり",
      level: "warning-manager" as const,
    };
  }

  if (xScore >= 3.0 && yScore < 3.0) {
    return {
      label: "上司以外の要因で離脱リスク",
      level: "warning-other" as const,
    };
  }

  return {
    label: "概ね良好",
    level: "good" as const,
  };
}

export function getRetentionDataset(surveyId: number): {
  surveyType: SurveyType;
  unitLabel: string;
  xQuestionNum: number;
  yQuestionNum: number;
  xLabel: string;
  yLabel: string;
  data: RetentionPoint[];
} {
  const survey = getSurvey(surveyId);
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
    const db = getDb();
    const entities = db.prepare(`
      SELECT DISTINCT entity FROM responses
      WHERE survey_id = ? AND type = 'staff' AND entity IS NOT NULL
      ORDER BY entity
    `).all(surveyId) as Array<{ entity: string }>;

    const data = entities.map(({ entity }) => {
      const scores = db.prepare(`
        SELECT qt.num, AVG(ra.score) as avg_score, COUNT(DISTINCT r.id) as response_count
        FROM response_answers ra
        JOIN responses r ON r.id = ra.response_id
        JOIN question_templates qt ON qt.id = ra.question_id
        WHERE r.survey_id = ? AND r.type = 'staff' AND r.entity = ?
        GROUP BY qt.num
      `).all(surveyId, entity) as Array<{ num: number; avg_score: number | null; response_count: number }>;

      const scoreMap = new Map(scores.map((score) => [score.num, score.avg_score]));
      const xScore = Math.round(((scoreMap.get(7) ?? 0) as number) * 100) / 100;
      const yScore = Math.round(((scoreMap.get(19) ?? 0) as number) * 100) / 100;
      const valid = scores.map((score) => score.avg_score).filter((score): score is number => score != null);
      const overallAvg = valid.length > 0
        ? Math.round((valid.reduce((sum, score) => sum + score, 0) / valid.length) * 100) / 100
        : 0;
      const count = scores[0]?.response_count ?? 0;
      const classification = classifyRetention(xScore, yScore);

      return {
        unit: entity,
        xScore,
        yScore,
        overallAvg,
        count,
        label: classification.label,
        level: classification.level,
      };
    });

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

  const clinicAverages = getClinicStaffAveragesByClinic(surveyId) as Array<Record<string, number | null> & {
    clinic: string;
    count: number;
  }>;
  const data = clinicAverages.map((clinicAverage) => {
    const xScore = clinicAverage.q7 != null ? Math.round(clinicAverage.q7 * 100) / 100 : 0;
    const yScore = clinicAverage.q15 != null ? Math.round(clinicAverage.q15 * 100) / 100 : 0;
    const valid = QUESTIONS.map((question) => clinicAverage[question.id]).filter((score): score is number => score != null);
    const overallAvg = valid.length > 0
      ? Math.round((valid.reduce((sum, score) => sum + score, 0) / valid.length) * 100) / 100
      : 0;
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
