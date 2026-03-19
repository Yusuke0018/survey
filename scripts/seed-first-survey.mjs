#!/usr/bin/env node

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DEFAULT_QUESTIONS = [
  { num: 1, area: "safety", areaLabel: "心理的安全性", staffText: "業務上の疑問や気づきを、気軽に口に出せる雰囲気がある", directorText: "スタッフが業務上の疑問や気づきを、気軽に口に出せる雰囲気を作れていると思う" },
  { num: 2, area: "safety", areaLabel: "心理的安全性", staffText: "ミスや失敗を報告したとき、責められるのではなく一緒に対策を考えてもらえる", directorText: "スタッフがミスや失敗を報告したとき、責めるのではなく一緒に対策を考える対応ができていると思う" },
  { num: 3, area: "safety", areaLabel: "心理的安全性", staffText: "「こうした方がいいのでは」という改善提案をしやすい環境だと感じる", directorText: "スタッフが「こうした方がいいのでは」と改善提案をしやすい環境を作れていると思う" },
  { num: 4, area: "safety", areaLabel: "心理的安全性", staffText: "職場で、自分の考えや判断が尊重されていると感じる", directorText: "スタッフの考えや判断を尊重できていると思う" },
  { num: 5, area: "director", areaLabel: "院長との関係性", staffText: "業務の指示や方針について、理由や背景の説明が十分にある", directorText: "業務の指示や方針を伝えるとき、理由や背景を十分に説明できていると思う" },
  { num: 6, area: "director", areaLabel: "院長との関係性", staffText: "自分の業務の進め方について、ある程度の裁量が認められている", directorText: "スタッフの業務の進め方について、ある程度の裁量を認められていると思う" },
  { num: 7, area: "director", areaLabel: "院長との関係性", staffText: "困ったことや悩みがあるとき、院長に相談しやすいと感じる", directorText: "スタッフが困ったことや悩みがあるとき、自分に相談しやすい状態を作れていると思う" },
  { num: 8, area: "director", areaLabel: "院長との関係性", staffText: "院長は、スタッフ一人ひとりの強みや事情を理解しようとしてくれている", directorText: "スタッフ一人ひとりの強みや事情を理解しようと努められていると思う" },
  { num: 9, area: "teamwork", areaLabel: "チームワーク", staffText: "職種の違いに関わらず、お互いの仕事に敬意を持って接している", directorText: "職種の違いに関わらず、お互いの仕事に敬意を持って接する文化が自分のチームにあると思う" },
  { num: 10, area: "teamwork", areaLabel: "チームワーク", staffText: "チーム内で情報共有が十分に行われていると感じる", directorText: "チーム内の情報共有は十分にできていると思う" },
  { num: 11, area: "teamwork", areaLabel: "チームワーク", staffText: "忙しいときや困ったとき、同僚同士で自然に助け合える関係がある", directorText: "忙しいときや困ったとき、スタッフ同士で自然に助け合える関係が築けていると思う" },
  { num: 12, area: "growth", areaLabel: "働きがい・成長", staffText: "今の仕事にやりがいを感じている", directorText: "スタッフが今の仕事にやりがいを感じられる環境を作れていると思う" },
  { num: 13, area: "growth", areaLabel: "働きがい・成長", staffText: "この職場で、自分が成長できていると感じる", directorText: "スタッフがこの職場で成長できていると感じられる環境を作れていると思う" },
  { num: 14, area: "trust", areaLabel: "組織への信頼", staffText: "このクリニック（グループ全体）の理念や方向性に共感できる", directorText: "クリニックグループ全体の理念や方向性を、スタッフに十分に伝えられていると思う" },
  { num: 15, area: "trust", areaLabel: "組織への信頼", staffText: "総合的に見て、今の職場で働き続けたいと思う", directorText: "総合的に見て、スタッフがこの職場で働き続けたいと思える環境を作れていると思う" },
];

function printHelp() {
  console.log(`Usage:
  npm run seed:first-survey -- --name "第1回スタッフサーベイ" --conducted-at 2025-01-01 --staff-csv /abs/path/staff.csv [options]

Required:
  --name            サーベイ名
  --conducted-at    実施日 (YYYY-MM-DD)
  --staff-csv       スタッフ回答CSV

Optional:
  --director-csv    院長回答CSV
  --db-path         DBファイルパス（省略時は ./data/survey.db）
  --replace         同名・同実施日のサーベイがあれば質問・回答を削除して再投入
  --activate        seed後に active にする
  --help            このヘルプを表示
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getDb(dbPath) {
  ensureDir(path.dirname(dbPath));
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

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

    CREATE TABLE IF NOT EXISTS responses (
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

    CREATE TABLE IF NOT EXISTS response_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES question_templates(id) ON DELETE CASCADE,
      score INTEGER,
      skip_reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_responses_survey ON responses(survey_id);
    CREATE INDEX IF NOT EXISTS idx_responses_type ON responses(survey_id, type);
    CREATE INDEX IF NOT EXISTS idx_response_answers_response ON response_answers(response_id);
    CREATE INDEX IF NOT EXISTS idx_question_templates_survey ON question_templates(survey_id);
  `);

  return db;
}

function cleanCSVText(text) {
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.substring(1);
  }
  return text.replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function splitCSVLines(text) {
  const lines = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\"") {
      if (inQuotes && i + 1 < text.length && text[i + 1] === "\"") {
        current += "\"\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        i += 1;
      }
      if (current.trim()) {
        lines.push(current);
      }
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    lines.push(current);
  }

  return lines;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && i + 1 < line.length && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function readCsvText(csvPath) {
  const buffer = fs.readFileSync(csvPath);
  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  const decoded = utf8Text.includes("\uFFFD")
    ? new TextDecoder("shift_jis").decode(buffer)
    : utf8Text;
  return cleanCSVText(decoded);
}

function matchQuestionColumn(header) {
  const trimmed = header.trim();
  for (const question of DEFAULT_QUESTIONS) {
    const staffPrefix = question.staffText.substring(0, 20);
    const directorPrefix = question.directorText.substring(0, 20);
    if (trimmed.includes(staffPrefix) || trimmed.includes(directorPrefix)) {
      return question.num;
    }
  }
  return null;
}

function extractScore(value) {
  if (!value || !value.trim()) return null;
  const match = value.trim().match(/^(\d)/);
  if (match) return Number.parseInt(match[1], 10);
  const num = Number.parseInt(value.trim(), 10);
  return Number.isNaN(num) || num < 1 || num > 5 ? null : num;
}

function parseClinicCsv(csvText, surveyId, type) {
  const lines = splitCSVLines(csvText);
  if (lines.length < 2) {
    throw new Error("CSVが空またはヘッダーのみです");
  }

  const headers = parseCSVLine(lines[0]);
  const columnMap = {};
  let timestampCol = -1;
  let clinicCol = -1;
  let nameCol = -1;
  let freeTextCol = -1;

  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i].trim();

    if (header.includes("タイムスタンプ") || header.toLowerCase().includes("timestamp")) {
      timestampCol = i;
      continue;
    }
    if (header === "所属" || header === "所属拠点" || header === "拠点" || header === "クリニック" || header === "クリニック名") {
      clinicCol = i;
      continue;
    }
    if (header.includes("氏名") || header.includes("名前") || header.includes("お名前")) {
      nameCol = i;
      continue;
    }
    if (header.includes("自由") || header.includes("コメント") || header.includes("ご意見") || header.includes("その他") || header.includes("職場環境")) {
      freeTextCol = i;
      continue;
    }

    const questionNum = matchQuestionColumn(header);
    if (questionNum !== null) {
      columnMap[i] = questionNum;
    }
  }

  if (clinicCol === -1) {
    throw new Error("所属拠点カラムを特定できませんでした");
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const columns = parseCSVLine(lines[i]);
    if (columns.length < 2) continue;
    const clinic = columns[clinicCol] ? columns[clinicCol].trim() : "";
    if (!clinic) continue;

    const row = {
      survey_id: surveyId,
      timestamp: timestampCol >= 0 ? (columns[timestampCol] || "").trim() || null : null,
      clinic,
      respondent_name: nameCol >= 0 ? (columns[nameCol] || "").trim() || null : null,
      q1: null, q2: null, q3: null, q4: null, q5: null,
      q6: null, q7: null, q8: null, q9: null, q10: null,
      q11: null, q12: null, q13: null, q14: null, q15: null,
      free_text: freeTextCol >= 0 ? (columns[freeTextCol] || "").trim() || null : null,
    };

    for (const [columnIndex, questionNum] of Object.entries(columnMap)) {
      row[`q${questionNum}`] = extractScore((columns[Number.parseInt(columnIndex, 10)] || "").trim());
    }

    if (type === "director") {
      delete row.respondent_name;
    }

    rows.push(row);
  }

  return {
    rows,
    matchedQuestions: Object.keys(columnMap).length,
  };
}

function upsertClinicQuestions(db, surveyId) {
  db.prepare("DELETE FROM question_templates WHERE survey_id = ?").run(surveyId);
  const insert = db.prepare(`
    INSERT INTO question_templates (
      survey_id, num, staff_text, director_text, area, area_label,
      respondent_type, text, short_label, core_id, scale_type, skip_options
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 'agreement', NULL)
  `);

  const tx = db.transaction(() => {
    for (const question of DEFAULT_QUESTIONS) {
      insert.run(
        surveyId,
        question.num,
        question.staffText,
        question.directorText,
        question.area,
        question.areaLabel
      );
    }
  });

  tx();
}

function clearSurveyData(db, surveyId) {
  db.prepare("DELETE FROM response_answers WHERE response_id IN (SELECT id FROM responses WHERE survey_id = ?)").run(surveyId);
  db.prepare("DELETE FROM responses WHERE survey_id = ?").run(surveyId);
  db.prepare("DELETE FROM question_templates WHERE survey_id = ?").run(surveyId);
  db.prepare("DELETE FROM staff_responses WHERE survey_id = ?").run(surveyId);
  db.prepare("DELETE FROM director_responses WHERE survey_id = ?").run(surveyId);
}

function insertRows(db, table, rows) {
  if (rows.length === 0) return;

  const insertStaff = db.prepare(`
    INSERT INTO staff_responses (
      survey_id, timestamp, clinic, respondent_name,
      q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12,q13,q14,q15, free_text
    ) VALUES (
      @survey_id, @timestamp, @clinic, @respondent_name,
      @q1,@q2,@q3,@q4,@q5,@q6,@q7,@q8,@q9,@q10,@q11,@q12,@q13,@q14,@q15, @free_text
    )
  `);

  const insertDirector = db.prepare(`
    INSERT INTO director_responses (
      survey_id, timestamp, clinic,
      q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12,q13,q14,q15, free_text
    ) VALUES (
      @survey_id, @timestamp, @clinic,
      @q1,@q2,@q3,@q4,@q5,@q6,@q7,@q8,@q9,@q10,@q11,@q12,@q13,@q14,@q15, @free_text
    )
  `);

  const tx = db.transaction(() => {
    for (const row of rows) {
      if (table === "staff_responses") {
        insertStaff.run(row);
      } else {
        insertDirector.run(row);
      }
    }
  });

  tx();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const name = args.name;
  const conductedAt = args["conducted-at"];
  const staffCsv = args["staff-csv"];
  const directorCsv = args["director-csv"];
  const replace = Boolean(args.replace);
  const activate = Boolean(args.activate);
  const dbPath = path.resolve(args["db-path"] || path.join(process.cwd(), "data", "survey.db"));

  if (!name || !conductedAt || !staffCsv) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(staffCsv)) {
    throw new Error(`スタッフCSVが見つかりません: ${staffCsv}`);
  }
  if (directorCsv && !fs.existsSync(directorCsv)) {
    throw new Error(`院長CSVが見つかりません: ${directorCsv}`);
  }

  const db = getDb(dbPath);

  const existing = db.prepare(`
    SELECT id, status, survey_type
    FROM surveys
    WHERE name = ? AND conducted_at = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(name, conductedAt);

  let surveyId;
  if (existing) {
    if (!replace) {
      throw new Error(`同名・同日のサーベイが既に存在します (id=${existing.id})。再投入する場合は --replace を付けてください`);
    }
    surveyId = existing.id;
    clearSurveyData(db, surveyId);
    db.prepare("UPDATE surveys SET survey_type = 'clinic', status = ? WHERE id = ?").run(activate ? "active" : "draft", surveyId);
  } else {
    const result = db.prepare(`
      INSERT INTO surveys (name, conducted_at, status, survey_type)
      VALUES (?, ?, ?, 'clinic')
    `).run(name, conductedAt, activate ? "active" : "draft");
    surveyId = Number(result.lastInsertRowid);
  }

  upsertClinicQuestions(db, surveyId);

  const staffResult = parseClinicCsv(readCsvText(staffCsv), surveyId, "staff");
  insertRows(db, "staff_responses", staffResult.rows);

  let directorCount = 0;
  let directorMatchedQuestions = 0;
  if (directorCsv) {
    const directorResult = parseClinicCsv(readCsvText(directorCsv), surveyId, "director");
    db.prepare("DELETE FROM director_responses WHERE survey_id = ?").run(surveyId);
    insertRows(db, "director_responses", directorResult.rows);
    directorCount = directorResult.rows.length;
    directorMatchedQuestions = directorResult.matchedQuestions;
  }

  console.log(JSON.stringify({
    success: true,
    surveyId,
    name,
    conductedAt,
    status: activate ? "active" : "draft",
    dbPath,
    staffCount: staffResult.rows.length,
    staffMatchedQuestions: staffResult.matchedQuestions,
    directorCount,
    directorMatchedQuestions,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`[seed:first-survey] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
