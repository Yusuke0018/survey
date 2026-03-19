import { createClient, type Client, type InArgs, type ResultSet } from "@libsql/client";
import path from "path";
import fs from "fs";

const LOCAL_DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), "data", "survey.db");
const DB_URL = process.env.TURSO_DATABASE_URL || `file:${LOCAL_DB_PATH}`;
const IS_LOCAL_FILE = DB_URL.startsWith("file:");

let client: Client | null = null;
let migrationPromise: Promise<void> | null = null;

function ensureLocalDir() {
  if (!IS_LOCAL_FILE) return;
  if (!fs.existsSync(path.dirname(LOCAL_DB_PATH))) {
    fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
  }
}

function getClient(): Client {
  if (client) return client;

  ensureLocalDir();
  client = createClient({
    url: DB_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return client;
}

async function rawExecute(sql: string, args?: InArgs): Promise<ResultSet> {
  return getClient().execute(args ? { sql, args } : sql);
}

async function rawQueryAll<T>(sql: string, args: InArgs = []): Promise<T[]> {
  const result = await rawExecute(sql, args);
  return result.rows as T[];
}

async function rawQueryOne<T>(sql: string, args: InArgs = []): Promise<T | null> {
  const rows = await rawQueryAll<T>(sql, args);
  return rows[0] ?? null;
}

async function safeAddColumn(table: string, column: string, definition: string) {
  try {
    await rawExecute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch {
    // Column already exists.
  }
}

async function migrate() {
  await getClient().executeMultiple(`
    CREATE TABLE IF NOT EXISTS surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      conducted_at DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      survey_type TEXT NOT NULL DEFAULT 'clinic',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      timestamp DATETIME,
      clinic TEXT NOT NULL,
      respondent_name TEXT,
      q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER, q5 INTEGER,
      q6 INTEGER, q7 INTEGER, q8 INTEGER, q9 INTEGER, q10 INTEGER,
      q11 INTEGER, q12 INTEGER, q13 INTEGER, q14 INTEGER, q15 INTEGER,
      free_text TEXT
    );

    CREATE TABLE IF NOT EXISTS director_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      timestamp DATETIME,
      clinic TEXT NOT NULL,
      q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER, q5 INTEGER,
      q6 INTEGER, q7 INTEGER, q8 INTEGER, q9 INTEGER, q10 INTEGER,
      q11 INTEGER, q12 INTEGER, q13 INTEGER, q14 INTEGER, q15 INTEGER,
      free_text TEXT
    );

    CREATE TABLE IF NOT EXISTS question_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      num INTEGER NOT NULL,
      staff_text TEXT NOT NULL DEFAULT '',
      director_text TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL,
      area_label TEXT NOT NULL DEFAULT '',
      respondent_type TEXT,
      text TEXT,
      short_label TEXT,
      core_id INTEGER,
      scale_type TEXT DEFAULT 'agreement',
      skip_options TEXT
    );
  `);

  await safeAddColumn("surveys", "status", "TEXT NOT NULL DEFAULT 'draft'");
  await safeAddColumn("surveys", "survey_type", "TEXT NOT NULL DEFAULT 'clinic'");
  await safeAddColumn("question_templates", "respondent_type", "TEXT");
  await safeAddColumn("question_templates", "text", "TEXT");
  await safeAddColumn("question_templates", "short_label", "TEXT");
  await safeAddColumn("question_templates", "core_id", "INTEGER");
  await safeAddColumn("question_templates", "scale_type", "TEXT DEFAULT 'agreement'");
  await safeAddColumn("question_templates", "skip_options", "TEXT");

  const hasResponsesV2 = await rawQueryOne<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type = 'table' AND name = 'responses_v2'"
  );

  if ((hasResponsesV2?.cnt ?? 0) === 0) {
    const hasResponses = await rawQueryOne<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type = 'table' AND name = 'responses'"
    );

    if ((hasResponses?.cnt ?? 0) > 0) {
      const responseColumns = await rawQueryAll<{ name: string }>("PRAGMA table_info(responses)");
      const hasEntityColumn = responseColumns.some((column) => column.name === "entity");

      await getClient().executeMultiple(`
        CREATE TABLE responses_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          clinic TEXT NOT NULL DEFAULT '',
          entity TEXT,
          respondent_name TEXT,
          owner_provider TEXT,
          owner_subject TEXT,
          owner_email TEXT,
          owner_name TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          free_text TEXT,
          session_token TEXT
        );
      `);

      if (hasEntityColumn) {
        await rawExecute(`
          INSERT INTO responses_v2 (id, survey_id, type, clinic, entity, respondent_name, timestamp, free_text, session_token)
          SELECT id, survey_id, type, clinic, entity, respondent_name, timestamp, free_text, session_token
          FROM responses
        `);
      } else {
        await rawExecute(`
          INSERT INTO responses_v2 (id, survey_id, type, clinic, entity, respondent_name, timestamp, free_text, session_token)
          SELECT id, survey_id, type, clinic, NULL, respondent_name, timestamp, free_text, session_token
          FROM responses
        `);
      }

      await getClient().executeMultiple(`
        DROP TABLE responses;
        ALTER TABLE responses_v2 RENAME TO responses;
      `);
    } else {
      await getClient().executeMultiple(`
        CREATE TABLE responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          clinic TEXT NOT NULL DEFAULT '',
          entity TEXT,
          respondent_name TEXT,
          owner_provider TEXT,
          owner_subject TEXT,
          owner_email TEXT,
          owner_name TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          free_text TEXT,
          session_token TEXT
        );
      `);
    }
  }

  await safeAddColumn("responses", "entity", "TEXT");
  await safeAddColumn("responses", "owner_provider", "TEXT");
  await safeAddColumn("responses", "owner_subject", "TEXT");
  await safeAddColumn("responses", "owner_email", "TEXT");
  await safeAddColumn("responses", "owner_name", "TEXT");

  await getClient().executeMultiple(`
    CREATE TABLE IF NOT EXISTS response_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES question_templates(id) ON DELETE CASCADE,
      score INTEGER,
      skip_reason TEXT
    );
  `);

  await safeAddColumn("response_answers", "skip_reason", "TEXT");

  await getClient().executeMultiple(`
    CREATE INDEX IF NOT EXISTS idx_responses_survey ON responses(survey_id);
    CREATE INDEX IF NOT EXISTS idx_responses_type ON responses(survey_id, type);
    CREATE INDEX IF NOT EXISTS idx_responses_owner_subject ON responses(owner_subject);
    CREATE INDEX IF NOT EXISTS idx_response_answers_response ON response_answers(response_id);
    CREATE INDEX IF NOT EXISTS idx_question_templates_survey ON question_templates(survey_id);
  `);
}

async function ensureMigrated() {
  if (!migrationPromise) {
    migrationPromise = migrate();
  }
  await migrationPromise;
}

export async function queryAll<T>(sql: string, args: InArgs = []): Promise<T[]> {
  await ensureMigrated();
  return rawQueryAll<T>(sql, args);
}

export async function queryOne<T>(sql: string, args: InArgs = []): Promise<T | null> {
  await ensureMigrated();
  return rawQueryOne<T>(sql, args);
}

export async function execute(sql: string, args?: InArgs): Promise<ResultSet> {
  await ensureMigrated();
  return rawExecute(sql, args);
}

export async function withTransaction<T>(fn: (tx: Awaited<ReturnType<Client["transaction"]>>) => Promise<T>): Promise<T> {
  await ensureMigrated();
  const tx = await getClient().transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export type SurveyType = "clinic" | "jigyotai";

export interface QuestionTemplate {
  id: number;
  survey_id: number;
  num: number;
  staff_text: string;
  director_text: string;
  area: string;
  area_label: string;
  respondent_type: string | null;
  text: string | null;
  short_label: string | null;
  core_id: number | null;
  scale_type: string;
  skip_options: string | null;
}

export interface ResponseRow {
  survey_id: number;
  timestamp: string | null;
  clinic: string;
  respondent_name?: string | null;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  q5: number | null;
  q6: number | null;
  q7: number | null;
  q8: number | null;
  q9: number | null;
  q10: number | null;
  q11: number | null;
  q12: number | null;
  q13: number | null;
  q14: number | null;
  q15: number | null;
  free_text: string | null;
}

export async function getAllSurveys() {
  return queryAll<{
    id: number;
    name: string;
    conducted_at: string;
    created_at: string;
    status: string;
    survey_type: SurveyType;
    legacy_staff_count: number;
    legacy_director_count: number;
    new_staff_count: number;
    new_director_count: number;
    new_manager_count: number;
    new_corporate_count: number;
    question_count: number;
  }>(`
    SELECT s.*,
      (SELECT COUNT(*) FROM staff_responses WHERE survey_id = s.id) as legacy_staff_count,
      (SELECT COUNT(*) FROM director_responses WHERE survey_id = s.id) as legacy_director_count,
      (SELECT COUNT(*) FROM responses WHERE survey_id = s.id AND type = 'staff') as new_staff_count,
      (SELECT COUNT(*) FROM responses WHERE survey_id = s.id AND type = 'director') as new_director_count,
      (SELECT COUNT(*) FROM responses WHERE survey_id = s.id AND type = 'manager') as new_manager_count,
      (SELECT COUNT(*) FROM responses WHERE survey_id = s.id AND type = 'corporate') as new_corporate_count,
      (SELECT COUNT(*) FROM question_templates WHERE survey_id = s.id) as question_count
    FROM surveys s
    ORDER BY s.conducted_at DESC
  `);
}

export async function getSurvey(id: number) {
  return queryOne<{
    id: number;
    name: string;
    conducted_at: string;
    created_at: string;
    status: string;
    survey_type: SurveyType;
  }>("SELECT * FROM surveys WHERE id = ?", [id]);
}

export async function createSurvey(name: string, conductedAt: string, surveyType: SurveyType = "clinic") {
  const result = await execute(
    "INSERT INTO surveys (name, conducted_at, status, survey_type) VALUES (?, ?, 'draft', ?)",
    [name, conductedAt, surveyType]
  );
  return Number(result.lastInsertRowid);
}

export async function updateSurveyStatus(id: number, status: string) {
  await execute("UPDATE surveys SET status = ? WHERE id = ?", [status, id]);
}

export async function deleteSurvey(id: number) {
  await withTransaction(async (tx) => {
    await tx.execute({
      sql: "DELETE FROM response_answers WHERE response_id IN (SELECT id FROM responses WHERE survey_id = ?)",
      args: [id],
    });
    await tx.execute({ sql: "DELETE FROM responses WHERE survey_id = ?", args: [id] });
    await tx.execute({ sql: "DELETE FROM question_templates WHERE survey_id = ?", args: [id] });
    await tx.execute({ sql: "DELETE FROM staff_responses WHERE survey_id = ?", args: [id] });
    await tx.execute({ sql: "DELETE FROM director_responses WHERE survey_id = ?", args: [id] });
    await tx.execute({ sql: "DELETE FROM surveys WHERE id = ?", args: [id] });
  });
}

export async function getQuestionTemplates(surveyId: number, respondentType?: string): Promise<QuestionTemplate[]> {
  if (respondentType) {
    return queryAll<QuestionTemplate>(
      "SELECT * FROM question_templates WHERE survey_id = ? AND respondent_type = ? ORDER BY num",
      [surveyId, respondentType]
    );
  }

  return queryAll<QuestionTemplate>(
    "SELECT * FROM question_templates WHERE survey_id = ? ORDER BY respondent_type, num",
    [surveyId]
  );
}

export async function upsertQuestionTemplates(
  surveyId: number,
  questions: Omit<QuestionTemplate, "id" | "survey_id">[]
) {
  await withTransaction(async (tx) => {
    await tx.execute({ sql: "DELETE FROM question_templates WHERE survey_id = ?", args: [surveyId] });
    for (const question of questions) {
      await tx.execute({
        sql: `
          INSERT INTO question_templates (
            survey_id, num, staff_text, director_text, area, area_label,
            respondent_type, text, short_label, core_id, scale_type, skip_options
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          surveyId,
          question.num,
          question.staff_text || "",
          question.director_text || "",
          question.area,
          question.area_label || "",
          question.respondent_type || null,
          question.text || null,
          question.short_label || null,
          question.core_id || null,
          question.scale_type || "agreement",
          question.skip_options || null,
        ],
      });
    }
  });
}

export async function upsertJigyotaiQuestions(
  surveyId: number,
  respondentType: string,
  questions: Array<{
    num: number;
    text: string;
    area: string;
    short_label: string;
    core_id?: number | null;
    scale_type?: string;
    skip_options?: string | null;
  }>
) {
  await withTransaction(async (tx) => {
    await tx.execute({
      sql: "DELETE FROM question_templates WHERE survey_id = ? AND respondent_type = ?",
      args: [surveyId, respondentType],
    });

    for (const question of questions) {
      await tx.execute({
        sql: `
          INSERT INTO question_templates (
            survey_id, num, staff_text, director_text, area, area_label,
            respondent_type, text, short_label, core_id, scale_type, skip_options
          )
          VALUES (?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          surveyId,
          question.num,
          question.area,
          question.area,
          respondentType,
          question.text,
          question.short_label,
          question.core_id || null,
          question.scale_type || "agreement",
          question.skip_options || null,
        ],
      });
    }
  });
}

export async function submitResponse(data: {
  surveyId: number;
  type: string;
  clinic?: string;
  entity?: string;
  respondentName?: string;
  freeText?: string;
  sessionToken?: string;
  owner?: {
    provider: string;
    subject: string;
    email: string;
    name?: string | null;
  };
  answers: Array<{ questionId: number; score: number | null; skipReason?: string | null }>;
}) {
  return withTransaction(async (tx) => {
    const insertResponse = await tx.execute({
      sql: `
        INSERT INTO responses (
          survey_id, type, clinic, entity, respondent_name,
          owner_provider, owner_subject, owner_email, owner_name,
          free_text, session_token
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        data.surveyId,
        data.type,
        data.clinic || "",
        data.entity || null,
        data.respondentName || null,
        data.owner?.provider || null,
        data.owner?.subject || null,
        data.owner?.email || null,
        data.owner?.name || null,
        data.freeText || null,
        data.sessionToken || null,
      ],
    });

    const responseId = Number(insertResponse.lastInsertRowid);
    for (const answer of data.answers) {
      await tx.execute({
        sql: `
          INSERT INTO response_answers (response_id, question_id, score, skip_reason)
          VALUES (?, ?, ?, ?)
        `,
        args: [responseId, answer.questionId, answer.score, answer.skipReason || null],
      });
    }

    return responseId;
  });
}

export async function hasSubmitted(surveyId: number, sessionToken: string, entity?: string): Promise<boolean> {
  if (entity) {
    const row = await queryOne<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM responses WHERE survey_id = ? AND session_token = ? AND entity = ?",
      [surveyId, sessionToken, entity]
    );
    return (row?.cnt ?? 0) > 0;
  }

  const row = await queryOne<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM responses WHERE survey_id = ? AND session_token = ?",
    [surveyId, sessionToken]
  );
  return (row?.cnt ?? 0) > 0;
}

export async function hasSubmittedByOwner(
  surveyId: number,
  ownerSubject: string,
  type: string,
  entity?: string
): Promise<boolean> {
  if (entity) {
    const row = await queryOne<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM responses WHERE survey_id = ? AND owner_subject = ? AND type = ? AND entity = ?",
      [surveyId, ownerSubject, type, entity]
    );
    return (row?.cnt ?? 0) > 0;
  }

  const row = await queryOne<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM responses WHERE survey_id = ? AND owner_subject = ? AND type = ?",
    [surveyId, ownerSubject, type]
  );
  return (row?.cnt ?? 0) > 0;
}

export interface OwnedResponseSummary {
  response_id: number;
  survey_id: number;
  survey_name: string;
  survey_type: SurveyType;
  conducted_at: string;
  respondent_type: string;
  org_unit: string;
  timestamp: string | null;
  avg_score: number | null;
  free_text: string | null;
  question_count: number;
}

export interface OwnedResponseDetail {
  response_id: number;
  survey_id: number;
  survey_name: string;
  survey_type: SurveyType;
  conducted_at: string;
  respondent_type: string;
  org_unit: string;
  timestamp: string | null;
  free_text: string | null;
  avg_score: number | null;
  questions: Array<{
    question_id: number;
    num: number;
    text: string;
    area: string;
    area_label: string;
    score: number | null;
    skip_reason: string | null;
  }>;
}

export async function getOwnedResponseSummaries(ownerSubject: string) {
  return queryAll<OwnedResponseSummary>(
    `
      SELECT
        r.id as response_id,
        s.id as survey_id,
        s.name as survey_name,
        s.survey_type,
        s.conducted_at,
        r.type as respondent_type,
        CASE
          WHEN r.entity IS NOT NULL AND r.entity != '' THEN r.entity
          ELSE r.clinic
        END as org_unit,
        r.timestamp,
        AVG(ra.score) as avg_score,
        r.free_text,
        COUNT(ra.id) as question_count
      FROM responses r
      JOIN surveys s ON s.id = r.survey_id
      LEFT JOIN response_answers ra ON ra.response_id = r.id
      WHERE r.owner_subject = ?
      GROUP BY
        r.id, s.id, s.name, s.survey_type, s.conducted_at,
        r.type, r.entity, r.clinic, r.timestamp, r.free_text
      ORDER BY COALESCE(r.timestamp, s.conducted_at) DESC, r.id DESC
    `,
    [ownerSubject]
  );
}

export async function getOwnedResponseDetail(responseId: number, ownerSubject: string) {
  const response = await queryOne<{
    response_id: number;
    survey_id: number;
    survey_name: string;
    survey_type: SurveyType;
    conducted_at: string;
    respondent_type: string;
    org_unit: string;
    timestamp: string | null;
    free_text: string | null;
    avg_score: number | null;
  }>(
    `
      SELECT
        r.id as response_id,
        s.id as survey_id,
        s.name as survey_name,
        s.survey_type,
        s.conducted_at,
        r.type as respondent_type,
        CASE
          WHEN r.entity IS NOT NULL AND r.entity != '' THEN r.entity
          ELSE r.clinic
        END as org_unit,
        r.timestamp,
        r.free_text,
        AVG(ra.score) as avg_score
      FROM responses r
      JOIN surveys s ON s.id = r.survey_id
      LEFT JOIN response_answers ra ON ra.response_id = r.id
      WHERE r.id = ? AND r.owner_subject = ?
      GROUP BY
        r.id, s.id, s.name, s.survey_type, s.conducted_at,
        r.type, r.entity, r.clinic, r.timestamp, r.free_text
    `,
    [responseId, ownerSubject]
  );

  if (!response) return null;

  const questions = await queryAll<{
    question_id: number;
    num: number;
    text: string;
    area: string;
    area_label: string;
    score: number | null;
    skip_reason: string | null;
  }>(
    `
      SELECT
        qt.id as question_id,
        qt.num,
        CASE
          WHEN qt.text IS NOT NULL AND qt.text != '' THEN qt.text
          WHEN r.type = 'director' THEN qt.director_text
          ELSE qt.staff_text
        END as text,
        qt.area,
        qt.area_label,
        ra.score,
        ra.skip_reason
      FROM response_answers ra
      JOIN responses r ON r.id = ra.response_id
      JOIN question_templates qt ON qt.id = ra.question_id
      WHERE ra.response_id = ? AND r.owner_subject = ?
      ORDER BY qt.num
    `,
    [responseId, ownerSubject]
  );

  return {
    ...response,
    questions,
  } satisfies OwnedResponseDetail;
}

export async function getNewScoreAverages(surveyId: number, type: string, clinicOrEntity?: string) {
  let sql = `
    SELECT
      qt.id as question_id,
      qt.num,
      qt.staff_text,
      qt.director_text,
      qt.area,
      qt.area_label,
      qt.respondent_type,
      qt.text as q_text,
      qt.short_label,
      qt.core_id,
      AVG(ra.score) as avg_score,
      COUNT(ra.score) as answer_count,
      SUM(CASE WHEN ra.skip_reason IS NOT NULL THEN 1 ELSE 0 END) as skip_count
    FROM question_templates qt
    LEFT JOIN response_answers ra ON ra.question_id = qt.id
    LEFT JOIN responses r ON ra.response_id = r.id AND r.type = ?
    WHERE qt.survey_id = ?
  `;
  const args: Array<string | number | null> = [type, surveyId];

  if (type === "manager" || type === "corporate") {
    sql += " AND (qt.respondent_type = ? OR qt.respondent_type IS NULL)";
    args.push(type);
  } else if (type === "staff") {
    sql += " AND (qt.respondent_type = 'staff' OR qt.respondent_type IS NULL)";
  }

  if (clinicOrEntity) {
    sql += " AND (r.clinic = ? OR r.entity = ? OR r.id IS NULL)";
    args.push(clinicOrEntity, clinicOrEntity);
  }

  sql += " GROUP BY qt.id ORDER BY qt.num";

  return queryAll<{
    question_id: number;
    num: number;
    staff_text: string;
    director_text: string;
    area: string;
    area_label: string;
    respondent_type: string | null;
    q_text: string | null;
    short_label: string | null;
    core_id: number | null;
    avg_score: number | null;
    answer_count: number;
    skip_count: number;
  }>(sql, args);
}

export async function insertStaffResponses(
  rows: ResponseRow[],
  options?: { replaceExisting?: boolean }
) {
  await withTransaction(async (tx) => {
    if (options?.replaceExisting && rows[0]?.survey_id != null) {
      await tx.execute({
        sql: "DELETE FROM staff_responses WHERE survey_id = ?",
        args: [rows[0].survey_id],
      });
    }

    for (const row of rows) {
      await tx.execute({
        sql: `
          INSERT INTO staff_responses (
            survey_id, timestamp, clinic, respondent_name,
            q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, free_text
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          row.survey_id,
          row.timestamp,
          row.clinic,
          row.respondent_name || null,
          row.q1, row.q2, row.q3, row.q4, row.q5,
          row.q6, row.q7, row.q8, row.q9, row.q10,
          row.q11, row.q12, row.q13, row.q14, row.q15,
          row.free_text,
        ],
      });
    }
  });

  return rows.length;
}

export async function insertDirectorResponses(
  rows: ResponseRow[],
  options?: { replaceExisting?: boolean }
) {
  await withTransaction(async (tx) => {
    if (options?.replaceExisting && rows[0]?.survey_id != null) {
      await tx.execute({
        sql: "DELETE FROM director_responses WHERE survey_id = ?",
        args: [rows[0].survey_id],
      });
    }

    for (const row of rows) {
      await tx.execute({
        sql: `
          INSERT INTO director_responses (
            survey_id, timestamp, clinic,
            q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, free_text
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          row.survey_id,
          row.timestamp,
          row.clinic,
          row.q1, row.q2, row.q3, row.q4, row.q5,
          row.q6, row.q7, row.q8, row.q9, row.q10,
          row.q11, row.q12, row.q13, row.q14, row.q15,
          row.free_text,
        ],
      });
    }
  });

  return rows.length;
}

export async function getActiveSurveys(surveyType?: SurveyType) {
  if (surveyType) {
    return queryAll<{
      id: number;
      name: string;
      conducted_at: string;
      status: string;
      survey_type: SurveyType;
      question_count: number;
    }>(
      `
        SELECT s.*, (SELECT COUNT(*) FROM question_templates WHERE survey_id = s.id) as question_count
        FROM surveys s
        WHERE s.status = 'active' AND s.survey_type = ?
        ORDER BY s.conducted_at DESC
      `,
      [surveyType]
    );
  }

  return queryAll<{
    id: number;
    name: string;
    conducted_at: string;
    status: string;
    survey_type: SurveyType;
    question_count: number;
  }>(`
    SELECT s.*, (SELECT COUNT(*) FROM question_templates WHERE survey_id = s.id) as question_count
    FROM surveys s
    WHERE s.status = 'active'
    ORDER BY s.conducted_at DESC
  `);
}
