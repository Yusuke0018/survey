import { QUESTIONS } from "./questions";
import type { ResponseRow } from "./db";

interface ParseResult {
  rows: ResponseRow[];
  matchedQuestions: number;
  totalRows: number;
  errors: string[];
}

function matchQuestionColumn(header: string): number | null {
  const trimmed = header.trim();
  for (const q of QUESTIONS) {
    // 先頭20文字の部分一致
    const staffPrefix = q.staffText.substring(0, 20);
    const directorPrefix = q.directorText.substring(0, 20);
    if (trimmed.includes(staffPrefix) || trimmed.includes(directorPrefix)) {
      return q.num;
    }
  }
  return null;
}

function extractScore(value: string): number | null {
  if (!value || value.trim() === "") return null;
  // Handle "4：ややそう思う" format - extract leading digit
  const match = value.trim().match(/^(\d)/);
  if (match) return parseInt(match[1], 10);
  const num = parseInt(value.trim(), 10);
  if (!isNaN(num) && num >= 1 && num <= 5) return num;
  return null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
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

// Handle multi-line CSV (quoted fields with newlines)
function splitCSVLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i++; // skip \n after \r
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

function cleanCSVText(text: string): string {
  // Remove BOM (UTF-8, UTF-16 LE/BE)
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.substring(1);
  }
  // Remove zero-width characters
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
  return text;
}

export function parseStaffCSV(csvText: string, surveyId: number): ParseResult {
  csvText = cleanCSVText(csvText);
  const lines = splitCSVLines(csvText);
  if (lines.length < 2) {
    return { rows: [], matchedQuestions: 0, totalRows: 0, errors: ["CSVが空またはヘッダーのみです"] };
  }

  const headers = parseCSVLine(lines[0]);

  // Map columns to question numbers
  const columnMap: Record<number, number> = {}; // colIndex -> qNum
  let timestampCol = -1;
  let clinicCol = -1;
  let nameCol = -1;
  let freeTextCol = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim();

    if (h.includes("タイムスタンプ") || h.toLowerCase().includes("timestamp")) {
      timestampCol = i;
      continue;
    }

    if (h.includes("所属") || h.includes("クリニック") || h.includes("拠点")) {
      clinicCol = i;
      continue;
    }

    if (h.includes("氏名") || h.includes("名前") || h.includes("お名前")) {
      nameCol = i;
      continue;
    }

    if (h.includes("自由") || h.includes("コメント") || h.includes("ご意見") || h.includes("その他") || h.includes("ご自身の") || h.includes("職場環境")) {
      freeTextCol = i;
      continue;
    }

    const qNum = matchQuestionColumn(h);
    if (qNum !== null) {
      columnMap[i] = qNum;
    }
  }

  const matchedQuestions = Object.keys(columnMap).length;
  const errors: string[] = [];

  if (matchedQuestions < 15) {
    errors.push(`15問中${matchedQuestions}問のみマッチしました。CSVのヘッダーを確認してください。`);
  }

  if (clinicCol === -1) {
    // Debug: output first few headers for troubleshooting
    const headerSample = headers.slice(0, 5).map((h, i) => `[${i}]"${h.trim().substring(0, 20)}"`).join(", ");
    errors.push(`所属拠点のカラムが見つかりません（ヘッダー先頭: ${headerSample}）`);
    return { rows: [], matchedQuestions, totalRows: 0, errors };
  }

  const rows: ResponseRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    const clinic = cols[clinicCol]?.trim();
    if (!clinic) continue;

    const row: ResponseRow = {
      survey_id: surveyId,
      timestamp: timestampCol >= 0 ? cols[timestampCol]?.trim() || null : null,
      clinic,
      respondent_name: nameCol >= 0 ? cols[nameCol]?.trim() || null : null,
      q1: null, q2: null, q3: null, q4: null, q5: null,
      q6: null, q7: null, q8: null, q9: null, q10: null,
      q11: null, q12: null, q13: null, q14: null, q15: null,
      free_text: freeTextCol >= 0 ? cols[freeTextCol]?.trim() || null : null,
    };

    for (const [colIdx, qNum] of Object.entries(columnMap)) {
      const val = cols[parseInt(colIdx)]?.trim();
      const score = extractScore(val || "");
      const key = `q${qNum}` as keyof ResponseRow;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row as any)[key] = score;
    }

    rows.push(row);
  }

  return { rows, matchedQuestions, totalRows: rows.length, errors };
}

export function parseDirectorCSV(csvText: string, surveyId: number): ParseResult {
  // Director CSV uses same format, just without name column
  const result = parseStaffCSV(csvText, surveyId);
  // Remove respondent_name from director responses
  for (const row of result.rows) {
    delete (row as Partial<ResponseRow>).respondent_name;
  }
  return result;
}
