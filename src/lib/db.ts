import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "survey.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  // Legacy tables (kept for backward compatibility)
  db.exec(`
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
  `);

  // Add columns if missing (for existing DBs)
  const safeAddColumn = (table: string, col: string, def: string) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch { /* exists */ }
  };
  safeAddColumn("surveys", "status", "TEXT NOT NULL DEFAULT 'draft'");
  safeAddColumn("surveys", "survey_type", "TEXT NOT NULL DEFAULT 'clinic'");

  // Question templates with extended fields for jigyotai
  db.exec(`
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
  safeAddColumn("question_templates", "respondent_type", "TEXT");
  safeAddColumn("question_templates", "text", "TEXT");
  safeAddColumn("question_templates", "short_label", "TEXT");
  safeAddColumn("question_templates", "core_id", "INTEGER");
  safeAddColumn("question_templates", "scale_type", "TEXT DEFAULT 'agreement'");
  safeAddColumn("question_templates", "skip_options", "TEXT");

  // Responses - recreate with wider type constraint if needed
  // Check if the new table exists with the right schema
  const hasResponsesV2 = db.prepare(
    "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='responses_v2'"
  ).get() as { cnt: number };

  if (hasResponsesV2.cnt === 0) {
    // Check if old responses table exists
    const hasResponses = db.prepare(
      "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='responses'"
    ).get() as { cnt: number };

    if (hasResponses.cnt > 0) {
      // Migrate: create v2, copy data, swap
      db.exec(`
        CREATE TABLE responses_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          clinic TEXT NOT NULL DEFAULT '',
          entity TEXT,
          respondent_name TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          free_text TEXT,
          session_token TEXT
        );
        INSERT INTO responses_v2 (id, survey_id, type, clinic, respondent_name, timestamp, free_text, session_token)
          SELECT id, survey_id, type, clinic, respondent_name, timestamp, free_text, session_token FROM responses;
        DROP TABLE responses;
        ALTER TABLE responses_v2 RENAME TO responses;
      `);
    } else {
      db.exec(`
        CREATE TABLE responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          clinic TEXT NOT NULL DEFAULT '',
          entity TEXT,
          respondent_name TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          free_text TEXT,
          session_token TEXT
        );
      `);
    }
  }
  safeAddColumn("responses", "entity", "TEXT");

  // Response answers with skip support
  db.exec(`
    CREATE TABLE IF NOT EXISTS response_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES question_templates(id) ON DELETE CASCADE,
      score INTEGER,
      skip_reason TEXT
    );
  `);
  safeAddColumn("response_answers", "skip_reason", "TEXT");

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_responses_survey ON responses(survey_id);
    CREATE INDEX IF NOT EXISTS idx_responses_type ON responses(survey_id, type);
    CREATE INDEX IF NOT EXISTS idx_response_answers_response ON response_answers(response_id);
    CREATE INDEX IF NOT EXISTS idx_question_templates_survey ON question_templates(survey_id);
  `);
}

// ==================== Survey CRUD ====================

export type SurveyType = "clinic" | "jigyotai";

export function getAllSurveys() {
  const db = getDb();
  return db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM staff_responses WHERE survey_id = s.id) as legacy_staff_count,
      (SELECT COUNT(*) FROM director_responses WHERE survey_id = s.id) as legacy_director_count,
      (SELECT COUNT(*) FROM responses WHERE survey_id = s.id AND type = 'staff') as new_staff_count,
      (SELECT COUNT(*) FROM responses WHERE survey_id = s.id AND type = 'director') as new_director_count,
      (SELECT COUNT(*) FROM responses WHERE survey_id = s.id AND type = 'manager') as new_manager_count,
      (SELECT COUNT(*) FROM responses WHERE survey_id = s.id AND type = 'corporate') as new_corporate_count,
      (SELECT COUNT(*) FROM question_templates WHERE survey_id = s.id) as question_count
    FROM surveys s ORDER BY s.conducted_at DESC
  `).all() as Array<{
    id: number; name: string; conducted_at: string; created_at: string;
    status: string; survey_type: SurveyType;
    legacy_staff_count: number; legacy_director_count: number;
    new_staff_count: number; new_director_count: number;
    new_manager_count: number; new_corporate_count: number;
    question_count: number;
  }>;
}

export function getSurvey(id: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM surveys WHERE id = ?").get(id) as {
    id: number; name: string; conducted_at: string; created_at: string;
    status: string; survey_type: SurveyType;
  } | undefined;
}

export function createSurvey(name: string, conductedAt: string, surveyType: SurveyType = "clinic") {
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO surveys (name, conducted_at, status, survey_type) VALUES (?, ?, 'draft', ?)"
  ).run(name, conductedAt, surveyType);
  return result.lastInsertRowid as number;
}

export function updateSurveyStatus(id: number, status: string) {
  const db = getDb();
  db.prepare("UPDATE surveys SET status = ? WHERE id = ?").run(status, id);
}

export function deleteSurvey(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM response_answers WHERE response_id IN (SELECT id FROM responses WHERE survey_id = ?)").run(id);
  db.prepare("DELETE FROM responses WHERE survey_id = ?").run(id);
  db.prepare("DELETE FROM question_templates WHERE survey_id = ?").run(id);
  db.prepare("DELETE FROM staff_responses WHERE survey_id = ?").run(id);
  db.prepare("DELETE FROM director_responses WHERE survey_id = ?").run(id);
  db.prepare("DELETE FROM surveys WHERE id = ?").run(id);
}

// ==================== Question Templates ====================

export interface QuestionTemplate {
  id: number;
  survey_id: number;
  num: number;
  staff_text: string;
  director_text: string;
  area: string;
  area_label: string;
  // Extended fields for jigyotai
  respondent_type: string | null;
  text: string | null;
  short_label: string | null;
  core_id: number | null;
  scale_type: string;
  skip_options: string | null;
}

export function getQuestionTemplates(surveyId: number, respondentType?: string): QuestionTemplate[] {
  const db = getDb();
  if (respondentType) {
    return db.prepare(
      "SELECT * FROM question_templates WHERE survey_id = ? AND respondent_type = ? ORDER BY num"
    ).all(surveyId, respondentType) as QuestionTemplate[];
  }
  return db.prepare("SELECT * FROM question_templates WHERE survey_id = ? ORDER BY respondent_type, num").all(surveyId) as QuestionTemplate[];
}

export function upsertQuestionTemplates(surveyId: number, questions: Omit<QuestionTemplate, "id" | "survey_id">[]) {
  const db = getDb();
  db.prepare("DELETE FROM question_templates WHERE survey_id = ?").run(surveyId);
  const stmt = db.prepare(`
    INSERT INTO question_templates (survey_id, num, staff_text, director_text, area, area_label,
      respondent_type, text, short_label, core_id, scale_type, skip_options)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((qs: typeof questions) => {
    for (const q of qs) {
      stmt.run(surveyId, q.num, q.staff_text || "", q.director_text || "", q.area, q.area_label || "",
        q.respondent_type || null, q.text || null, q.short_label || null,
        q.core_id || null, q.scale_type || "agreement", q.skip_options || null);
    }
  });
  insertAll(questions);
}

export function upsertJigyotaiQuestions(
  surveyId: number,
  respondentType: string,
  questions: Array<{
    num: number; text: string; area: string; short_label: string;
    core_id?: number | null; scale_type?: string; skip_options?: string | null;
  }>
) {
  const db = getDb();
  db.prepare("DELETE FROM question_templates WHERE survey_id = ? AND respondent_type = ?").run(surveyId, respondentType);
  const stmt = db.prepare(`
    INSERT INTO question_templates (survey_id, num, staff_text, director_text, area, area_label,
      respondent_type, text, short_label, core_id, scale_type, skip_options)
    VALUES (?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((qs: typeof questions) => {
    for (const q of qs) {
      stmt.run(surveyId, q.num, q.area, q.area, respondentType, q.text, q.short_label,
        q.core_id || null, q.scale_type || "agreement", q.skip_options || null);
    }
  });
  insertAll(questions);
}

export function copyQuestionsFromSurvey(sourceSurveyId: number, targetSurveyId: number) {
  const questions = getQuestionTemplates(sourceSurveyId);
  upsertQuestionTemplates(targetSurveyId, questions.map(q => ({
    num: q.num, staff_text: q.staff_text, director_text: q.director_text,
    area: q.area, area_label: q.area_label, respondent_type: q.respondent_type,
    text: q.text, short_label: q.short_label, core_id: q.core_id,
    scale_type: q.scale_type, skip_options: q.skip_options,
  })));
}

// ==================== Response System ====================

export function submitResponse(data: {
  surveyId: number;
  type: string; // "staff" | "director" | "manager" | "corporate"
  clinic?: string;
  entity?: string;
  respondentName?: string;
  freeText?: string;
  sessionToken?: string;
  answers: Array<{ questionId: number; score: number | null; skipReason?: string | null }>;
}) {
  const db = getDb();
  const insertResponse = db.prepare(`
    INSERT INTO responses (survey_id, type, clinic, entity, respondent_name, free_text, session_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAnswer = db.prepare(`
    INSERT INTO response_answers (response_id, question_id, score, skip_reason)
    VALUES (?, ?, ?, ?)
  `);

  const run = db.transaction(() => {
    const result = insertResponse.run(
      data.surveyId, data.type, data.clinic || "", data.entity || null,
      data.respondentName || null, data.freeText || null, data.sessionToken || null
    );
    const responseId = result.lastInsertRowid as number;
    for (const a of data.answers) {
      insertAnswer.run(responseId, a.questionId, a.score, a.skipReason || null);
    }
    return responseId;
  });

  return run();
}

export function hasSubmitted(surveyId: number, sessionToken: string, entity?: string): boolean {
  const db = getDb();
  if (entity) {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM responses WHERE survey_id = ? AND session_token = ? AND entity = ?"
    ).get(surveyId, sessionToken, entity) as { cnt: number };
    return row.cnt > 0;
  }
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM responses WHERE survey_id = ? AND session_token = ?"
  ).get(surveyId, sessionToken) as { cnt: number };
  return row.cnt > 0;
}

export function getNewResponses(surveyId: number, type?: string, clinicOrEntity?: string) {
  const db = getDb();
  let sql = "SELECT * FROM responses WHERE survey_id = ?";
  const params: (string | number)[] = [surveyId];
  if (type) { sql += " AND type = ?"; params.push(type); }
  if (clinicOrEntity) { sql += " AND (clinic = ? OR entity = ?)"; params.push(clinicOrEntity, clinicOrEntity); }
  sql += " ORDER BY timestamp DESC";
  return db.prepare(sql).all(...params) as Array<{
    id: number; survey_id: number; type: string; clinic: string; entity: string | null;
    respondent_name: string | null; timestamp: string; free_text: string | null;
  }>;
}

export function getResponseAnswers(responseId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT ra.*, qt.num, qt.staff_text, qt.director_text, qt.area, qt.area_label,
           qt.respondent_type, qt.text as q_text, qt.short_label
    FROM response_answers ra
    JOIN question_templates qt ON ra.question_id = qt.id
    WHERE ra.response_id = ?
    ORDER BY qt.num
  `).all(responseId) as Array<{
    id: number; response_id: number; question_id: number; score: number | null; skip_reason: string | null;
    num: number; staff_text: string; director_text: string; area: string; area_label: string;
    respondent_type: string | null; q_text: string | null; short_label: string | null;
  }>;
}

export function getNewScoreAverages(surveyId: number, type: string, clinicOrEntity?: string) {
  const db = getDb();
  let sql = `
    SELECT qt.id as question_id, qt.num, qt.staff_text, qt.director_text, qt.area, qt.area_label,
           qt.respondent_type, qt.text as q_text, qt.short_label, qt.core_id,
           AVG(ra.score) as avg_score, COUNT(ra.score) as answer_count,
           SUM(CASE WHEN ra.skip_reason IS NOT NULL THEN 1 ELSE 0 END) as skip_count
    FROM question_templates qt
    LEFT JOIN response_answers ra ON ra.question_id = qt.id
    LEFT JOIN responses r ON ra.response_id = r.id AND r.type = ?
    WHERE qt.survey_id = ?
  `;
  const params: (string | number)[] = [type, surveyId];

  // Filter by respondent_type for jigyotai questions
  if (type === "manager" || type === "corporate") {
    sql += " AND (qt.respondent_type = ? OR qt.respondent_type IS NULL)";
    params.push(type);
  } else if (type === "staff") {
    sql += " AND (qt.respondent_type = 'staff' OR qt.respondent_type IS NULL)";
  }

  if (clinicOrEntity) {
    sql += " AND (r.clinic = ? OR r.entity = ? OR r.id IS NULL)";
    params.push(clinicOrEntity, clinicOrEntity);
  }
  sql += " GROUP BY qt.id ORDER BY qt.num";
  return db.prepare(sql).all(...params) as Array<{
    question_id: number; num: number; staff_text: string; director_text: string;
    area: string; area_label: string; respondent_type: string | null;
    q_text: string | null; short_label: string | null; core_id: number | null;
    avg_score: number | null; answer_count: number; skip_count: number;
  }>;
}

// ==================== Legacy Response System (kept for CSV import) ====================

export interface ResponseRow {
  survey_id: number;
  timestamp: string | null;
  clinic: string;
  respondent_name?: string | null;
  q1: number | null; q2: number | null; q3: number | null; q4: number | null; q5: number | null;
  q6: number | null; q7: number | null; q8: number | null; q9: number | null; q10: number | null;
  q11: number | null; q12: number | null; q13: number | null; q14: number | null; q15: number | null;
  free_text: string | null;
}

export function insertStaffResponses(rows: ResponseRow[]) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO staff_responses (survey_id, timestamp, clinic, respondent_name,
      q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12,q13,q14,q15, free_text)
    VALUES (@survey_id, @timestamp, @clinic, @respondent_name,
      @q1,@q2,@q3,@q4,@q5,@q6,@q7,@q8,@q9,@q10,@q11,@q12,@q13,@q14,@q15, @free_text)
  `);
  const insertMany = db.transaction((rows: ResponseRow[]) => {
    for (const row of rows) stmt.run(row);
  });
  insertMany(rows);
  return rows.length;
}

export function insertDirectorResponses(rows: ResponseRow[]) {
  const db = getDb();
  const delStmt = db.prepare("DELETE FROM director_responses WHERE survey_id = ? AND clinic = ?");
  const stmt = db.prepare(`
    INSERT INTO director_responses (survey_id, timestamp, clinic,
      q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12,q13,q14,q15, free_text)
    VALUES (@survey_id, @timestamp, @clinic,
      @q1,@q2,@q3,@q4,@q5,@q6,@q7,@q8,@q9,@q10,@q11,@q12,@q13,@q14,@q15, @free_text)
  `);
  const insertMany = db.transaction((rows: ResponseRow[]) => {
    for (const row of rows) {
      delStmt.run(row.survey_id, row.clinic);
      stmt.run(row);
    }
  });
  insertMany(rows);
  return rows.length;
}

export function getStaffResponses(surveyId: number, clinic?: string) {
  const db = getDb();
  if (clinic) {
    return db.prepare("SELECT * FROM staff_responses WHERE survey_id = ? AND clinic = ?").all(surveyId, clinic);
  }
  return db.prepare("SELECT * FROM staff_responses WHERE survey_id = ?").all(surveyId);
}

export function getDirectorResponses(surveyId: number, clinic?: string) {
  const db = getDb();
  if (clinic) {
    return db.prepare("SELECT * FROM director_responses WHERE survey_id = ? AND clinic = ?").all(surveyId, clinic);
  }
  return db.prepare("SELECT * FROM director_responses WHERE survey_id = ?").all(surveyId);
}

export function getStaffScoreAverages(surveyId: number, clinic?: string) {
  const db = getDb();
  const where = clinic ? "WHERE survey_id = ? AND clinic = ?" : "WHERE survey_id = ?";
  const params = clinic ? [surveyId, clinic] : [surveyId];
  return db.prepare(`
    SELECT
      AVG(q1) as q1, AVG(q2) as q2, AVG(q3) as q3, AVG(q4) as q4, AVG(q5) as q5,
      AVG(q6) as q6, AVG(q7) as q7, AVG(q8) as q8, AVG(q9) as q9, AVG(q10) as q10,
      AVG(q11) as q11, AVG(q12) as q12, AVG(q13) as q13, AVG(q14) as q14, AVG(q15) as q15,
      COUNT(*) as count
    FROM staff_responses ${where}
  `).get(...params) as Record<string, number | null>;
}

export function getClinicStaffAverages(surveyId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT clinic,
      AVG(q1) as q1, AVG(q2) as q2, AVG(q3) as q3, AVG(q4) as q4, AVG(q5) as q5,
      AVG(q6) as q6, AVG(q7) as q7, AVG(q8) as q8, AVG(q9) as q9, AVG(q10) as q10,
      AVG(q11) as q11, AVG(q12) as q12, AVG(q13) as q13, AVG(q14) as q14, AVG(q15) as q15,
      COUNT(*) as count
    FROM staff_responses WHERE survey_id = ?
    GROUP BY clinic
  `).all(surveyId) as Array<Record<string, number | null> & { clinic: string; count: number }>;
}

export function getActiveSurveys(surveyType?: SurveyType) {
  const db = getDb();
  if (surveyType) {
    return db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM question_templates WHERE survey_id = s.id) as question_count
      FROM surveys s WHERE s.status = 'active' AND s.survey_type = ? ORDER BY s.conducted_at DESC
    `).all(surveyType) as Array<{
      id: number; name: string; conducted_at: string; status: string;
      survey_type: SurveyType; question_count: number;
    }>;
  }
  return db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM question_templates WHERE survey_id = s.id) as question_count
    FROM surveys s WHERE s.status = 'active' ORDER BY s.conducted_at DESC
  `).all() as Array<{
    id: number; name: string; conducted_at: string; status: string;
    survey_type: SurveyType; question_count: number;
  }>;
}
