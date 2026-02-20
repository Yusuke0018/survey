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
  db.exec(`
    CREATE TABLE IF NOT EXISTS surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      conducted_at DATE NOT NULL,
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
}

// Survey CRUD
export function getAllSurveys() {
  const db = getDb();
  return db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM staff_responses WHERE survey_id = s.id) as staff_count,
      (SELECT COUNT(*) FROM director_responses WHERE survey_id = s.id) as director_count
    FROM surveys s ORDER BY s.conducted_at DESC
  `).all() as Array<{
    id: number; name: string; conducted_at: string; created_at: string;
    staff_count: number; director_count: number;
  }>;
}

export function getSurvey(id: number) {
  const db = getDb();
  return db.prepare("SELECT * FROM surveys WHERE id = ?").get(id) as {
    id: number; name: string; conducted_at: string; created_at: string;
  } | undefined;
}

export function createSurvey(name: string, conductedAt: string) {
  const db = getDb();
  const result = db.prepare("INSERT INTO surveys (name, conducted_at) VALUES (?, ?)").run(name, conductedAt);
  return result.lastInsertRowid as number;
}

export function deleteSurvey(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM staff_responses WHERE survey_id = ?").run(id);
  db.prepare("DELETE FROM director_responses WHERE survey_id = ?").run(id);
  db.prepare("DELETE FROM surveys WHERE id = ?").run(id);
}

// Response insertion
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
  // 同拠点の既存回答を削除（最新のみ使用）
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

// Query helpers
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
