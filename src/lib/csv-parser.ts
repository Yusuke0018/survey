import { QUESTIONS } from "./questions";
import type { ResponseRow } from "./db";

interface ParseResult {
  rows: ResponseRow[];
  matchedQuestions: number;
  totalRows: number;
  errors: string[];
}

// --- Dynamic question support ---

export interface QuestionDef {
  templateId: number;
  num: number;
  staffText: string;
  directorText: string;
  text?: string;
}

export interface ParsedCSVResponse {
  timestamp: string | null;
  clinic: string;
  entity: string | null;
  respondentName: string | null;
  freeText: string | null;
  answers: Array<{ questionId: number; score: number | null }>;
}

export interface DynamicParseResult {
  responses: ParsedCSVResponse[];
  matchedQuestions: number;
  totalQuestions: number;
  totalRows: number;
  errors: string[];
}

function normalizeHeaderLabel(header: string): string {
  return header.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function normalizeQuestionTextForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/^[QＱ]\s*[0-9０-９]{1,2}\s*[\.\):：-]?\s*/u, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[「」"'”“‘’]/g, "")
    .replace(/[()（）【】［］\[\]<>＜＞]/g, " ")
    .replace(/[・,，、。．]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function extractHeaderQuestionNumber(header: string): number | null {
  const normalized = header.normalize("NFKC").trim();
  const match = normalized.match(/^[QＱ]\s*([0-9]{1,2})\s*[\.\):：-]?/u);
  if (!match) return null;
  const questionNum = parseInt(match[1], 10);
  return Number.isNaN(questionNum) ? null : questionNum;
}

function isClinicColumn(header: string): boolean {
  const normalized = normalizeHeaderLabel(header);
  return (
    normalized === "所属" ||
    normalized === "所属拠点" ||
    normalized === "拠点" ||
    normalized === "クリニック" ||
    normalized === "クリニック名" ||
    /所属.*(拠点|クリニック)/.test(normalized)
  );
}

function isEntityColumn(header: string): boolean {
  const normalized = normalizeHeaderLabel(header);
  return (
    normalized.includes("事業体") ||
    normalized.includes("事業所") ||
    normalized === "事業" ||
    normalized === "事業名" ||
    normalized === "法人" ||
    /所属.*(事業体|事業|法人|部門)/.test(normalized)
  );
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

    if (isClinicColumn(h)) {
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

// --- Dynamic question functions ---

function matchQuestionColumnDynamic(header: string, questions: QuestionDef[]): number | null {
  const questionNum = extractHeaderQuestionNumber(header);
  if (questionNum !== null) {
    const matchedByNumber = questions.find((q) => q.num === questionNum);
    if (matchedByNumber) {
      return matchedByNumber.templateId;
    }
  }

  const normalizedHeader = normalizeQuestionTextForMatch(header);
  if (!normalizedHeader) return null;

  for (const q of questions) {
    const candidates = [q.staffText, q.directorText, q.text].filter(Boolean) as string[];
    for (const fullText of candidates) {
      const normalizedCandidate = normalizeQuestionTextForMatch(fullText);
      const prefix = normalizedCandidate.substring(0, 18);
      if (!prefix) continue;

      if (
        normalizedHeader === normalizedCandidate ||
        normalizedHeader.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedHeader) ||
        (prefix.length >= 8 && normalizedHeader.includes(prefix))
      ) {
        return q.templateId;
      }
    }
  }
  return null;
}

function parseDynamicCSVInternal(
  csvText: string,
  questions: QuestionDef[],
  includeRespondentName: boolean
): DynamicParseResult {
  csvText = cleanCSVText(csvText);
  const lines = splitCSVLines(csvText);
  if (lines.length < 2) {
    return {
      responses: [],
      matchedQuestions: 0,
      totalQuestions: questions.length,
      totalRows: 0,
      errors: ["CSVが空またはヘッダーのみです"],
    };
  }

  const headers = parseCSVLine(lines[0]);

  // Map columns to template IDs
  const columnMap: Record<number, number> = {}; // colIndex -> templateId
  const matchedTemplateIds = new Set<number>();
  let timestampCol = -1;
  let clinicCol = -1;
  let entityCol = -1;
  let nameCol = -1;
  let freeTextCol = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim();

    if (h.includes("タイムスタンプ") || h.toLowerCase().includes("timestamp")) {
      timestampCol = i;
      continue;
    }

    if (isClinicColumn(h)) {
      clinicCol = i;
      continue;
    }

    if (isEntityColumn(h)) {
      entityCol = i;
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

    const templateId = matchQuestionColumnDynamic(h, questions);
    if (templateId !== null && !matchedTemplateIds.has(templateId)) {
      columnMap[i] = templateId;
      matchedTemplateIds.add(templateId);
    }
  }

  const matchedQuestions = matchedTemplateIds.size;
  const errors: string[] = [];

  if (matchedQuestions < questions.length) {
    errors.push(`${questions.length}問中${matchedQuestions}問のみマッチしました。CSVのヘッダーを確認してください。`);
  }

  // Use entity column as fallback for clinic column
  const orgCol = clinicCol >= 0 ? clinicCol : entityCol;
  if (orgCol === -1) {
    const headerSample = headers.slice(0, 5).map((h, i) => `[${i}]"${h.trim().substring(0, 20)}"`).join(", ");
    errors.push(`所属拠点/事業体のカラムが見つかりません（ヘッダー先頭: ${headerSample}）`);
    return { responses: [], matchedQuestions, totalQuestions: questions.length, totalRows: 0, errors };
  }

  const responses: ParsedCSVResponse[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    const orgValue = cols[orgCol]?.trim();
    if (!orgValue) continue;

    const answers: Array<{ questionId: number; score: number | null }> = [];
    for (const [colIdx, templateId] of Object.entries(columnMap)) {
      const val = cols[parseInt(colIdx)]?.trim();
      const score = extractScore(val || "");
      answers.push({ questionId: templateId, score });
    }

    responses.push({
      timestamp: timestampCol >= 0 ? cols[timestampCol]?.trim() || null : null,
      clinic: clinicCol >= 0 ? orgValue : "",
      entity: entityCol >= 0 ? (clinicCol >= 0 ? cols[entityCol]?.trim() || null : orgValue) : null,
      respondentName: includeRespondentName && nameCol >= 0 ? cols[nameCol]?.trim() || null : null,
      freeText: freeTextCol >= 0 ? cols[freeTextCol]?.trim() || null : null,
      answers,
    });
  }

  return { responses, matchedQuestions, totalQuestions: questions.length, totalRows: responses.length, errors };
}

export function parseStaffCSVDynamic(
  csvText: string,
  surveyId: number,
  questions: QuestionDef[]
): DynamicParseResult {
  // Fall back to legacy QUESTIONS-based matching if no templates provided
  if (questions.length === 0) {
    const fallbackQuestions: QuestionDef[] = QUESTIONS.map((q) => ({
      templateId: q.num,
      num: q.num,
      staffText: q.staffText,
      directorText: q.directorText,
    }));
    return parseDynamicCSVInternal(csvText, fallbackQuestions, true);
  }
  return parseDynamicCSVInternal(csvText, questions, true);
}

export function parseDirectorCSVDynamic(
  csvText: string,
  surveyId: number,
  questions: QuestionDef[]
): DynamicParseResult {
  // Fall back to legacy QUESTIONS-based matching if no templates provided
  if (questions.length === 0) {
    const fallbackQuestions: QuestionDef[] = QUESTIONS.map((q) => ({
      templateId: q.num,
      num: q.num,
      staffText: q.staffText,
      directorText: q.directorText,
    }));
    return parseDynamicCSVInternal(csvText, fallbackQuestions, false);
  }
  return parseDynamicCSVInternal(csvText, questions, false);
}

/**
 * CSVのヘッダーから回答者タイプを自動判定する
 * 各タイプの質問テンプレートとヘッダーのマッチ数で最も一致するタイプを返す
 */
export function detectRespondentType(
  csvText: string,
  questionsByType: Record<string, QuestionDef[]>
): { type: string; matchCount: number; totalQuestions: number } {
  const cleaned = cleanCSVText(csvText);
  const lines = splitCSVLines(cleaned);
  if (lines.length < 1) {
    return { type: "staff", matchCount: 0, totalQuestions: 0 };
  }

  const headers = parseCSVLine(lines[0]);

  let bestType = "staff";
  let bestCount = 0;
  let bestTotal = 0;

  for (const [typeName, questions] of Object.entries(questionsByType)) {
    let matchCount = 0;
    const matchedIds = new Set<number>();

    for (const h of headers) {
      const trimmed = h.trim();
      if (!trimmed) continue;
      const templateId = matchQuestionColumnDynamic(trimmed, questions);
      if (templateId !== null && !matchedIds.has(templateId)) {
        matchedIds.add(templateId);
        matchCount++;
      }
    }

    if (matchCount > bestCount) {
      bestCount = matchCount;
      bestType = typeName;
      bestTotal = questions.length;
    }
  }

  return { type: bestType, matchCount: bestCount, totalQuestions: bestTotal };
}
