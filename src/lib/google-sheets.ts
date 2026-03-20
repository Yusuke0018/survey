/**
 * Google Spreadsheet URL からシートIDを抽出し、CSV形式でデータを取得する
 * シートが「リンクを知っている人は閲覧可」に設定されている必要がある
 */

import type { SurveyType } from "./db";

export function extractSpreadsheetId(url: string): string | null {
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function extractGid(url: string): string | null {
  const match = url.match(/[#&?]gid=(\d+)/);
  return match ? match[1] : null;
}

interface SheetTab {
  name: string;
  gid: string;
}

/**
 * スプレッドシートのHTMLページからシート一覧（名前+gid）を取得する
 */
async function discoverSheets(spreadsheetId: string): Promise<SheetTab[]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SurveyApp/1.0)" },
  });

  if (!res.ok) return [];

  const html = await res.text();

  // HTMLソース内のシートメタデータを抽出
  // パターン1: ritz_sheets 配列から抽出
  const sheets: SheetTab[] = [];

  // Google Sheets HTML contains sheet data in various formats
  // Look for patterns like: "name":"シート名" ... "id":12345 or similar
  // Most reliable: look for the sheet tab buttons with data attributes

  // パターン: sheet-button-{gid} と対応するシート名
  const sheetButtonPattern = /sheet-button-(\d+)[^>]*>([^<]*)</g;
  let match;
  while ((match = sheetButtonPattern.exec(html)) !== null) {
    sheets.push({ gid: match[1], name: match[2].trim() });
  }

  if (sheets.length > 0) return sheets;

  // パターン2: JSON embedded data - "sheets":[{"properties":{"sheetId":0,"title":"..."}}]
  const jsonPattern = /"sheets"\s*:\s*\[([\s\S]*?)\]/;
  const jsonMatch = html.match(jsonPattern);
  if (jsonMatch) {
    const propPattern = /"sheetId"\s*:\s*(\d+)\s*,\s*"title"\s*:\s*"([^"]+)"/g;
    let propMatch;
    while ((propMatch = propPattern.exec(jsonMatch[1])) !== null) {
      sheets.push({ gid: propMatch[1], name: propMatch[2] });
    }
  }

  if (sheets.length > 0) return sheets;

  // パターン3: シートメニューのリンクから抽出
  const linkPattern = /gid=(\d+)[^"]*"[^>]*>\s*([^<]+)\s*</g;
  while ((match = linkPattern.exec(html)) !== null) {
    const name = match[2].trim();
    if (name && !sheets.some(s => s.gid === match[1])) {
      sheets.push({ gid: match[1], name });
    }
  }

  return sheets;
}

/**
 * gid指定でCSVを取得する
 */
async function fetchSheetByGid(
  spreadsheetId: string,
  gid: string
): Promise<string | null> {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

  const res = await fetch(exportUrl, {
    redirect: "follow",
    headers: { "User-Agent": "SurveyApp/1.0" },
  });

  if (!res.ok) return null;

  const text = await res.text();
  if (!text.trim()) return null;
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) return null;

  return text;
}

/** シート名 → 回答者タイプのマッピング（部分一致） */
function detectTypeFromSheetName(
  sheetName: string,
  surveyType: SurveyType
): string | null {
  const name = sheetName.trim();

  if (surveyType === "jigyotai") {
    if (/経営企画/.test(name) || /corporate/i.test(name) || /本部/.test(name)) return "corporate";
    if (/責任者/.test(name) || /manager/i.test(name)) return "manager";
    if (/スタッフ/.test(name) || /staff/i.test(name)) return "staff";
  } else {
    if (/院長/.test(name) || /director/i.test(name)) return "director";
    if (/スタッフ/.test(name) || /staff/i.test(name)) return "staff";
  }

  return null;
}

export interface SheetResult {
  type: string;
  csv: string;
  sheetName: string;
}

/**
 * シート名を指定してgviz/tqエンドポイントからCSVを取得する
 */
async function fetchSheetByName(
  spreadsheetId: string,
  sheetName: string
): Promise<string | null> {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  try {
    const res = await fetch(exportUrl, {
      redirect: "follow",
      headers: { "User-Agent": "SurveyApp/1.0" },
    });

    if (!res.ok) return null;

    const text = await res.text();
    if (!text.trim()) return null;
    if (text.trim().startsWith("google.visualization.Query.setResponse")) return null;
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) return null;

    return text;
  } catch {
    return null;
  }
}

/** サーベイタイプに応じて試すシート名のリスト */
const JIGYOTAI_SHEET_CANDIDATES: Array<{ type: string; names: string[] }> = [
  { type: "staff", names: ["スタッフ", "staff", "Staff", "スタッフ回答"] },
  { type: "manager", names: ["責任者", "事業責任者", "現場責任者", "manager", "Manager", "責任者回答"] },
  { type: "corporate", names: ["経営企画室", "corporate", "Corporate", "本部", "経営企画室回答"] },
];

const CLINIC_SHEET_CANDIDATES: Array<{ type: string; names: string[] }> = [
  { type: "staff", names: ["スタッフ", "staff", "Staff", "スタッフ回答"] },
  { type: "director", names: ["院長", "director", "Director", "院長回答"] },
];

/**
 * スプレッドシートから全シートをタイプ別に取得する
 * 方法1: HTMLからシート一覧を発見してgidで取得
 * 方法2: gviz/tqでシート名を直接指定して取得
 * 方法3: フォールバックでデフォルトシートを取得
 */
export async function fetchAllSheets(
  spreadsheetUrl: string,
  surveyType: SurveyType
): Promise<SheetResult[]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    throw new Error(
      "スプレッドシートのURLが正しくありません。Google SpreadsheetのURLを貼り付けてください。"
    );
  }

  const results: SheetResult[] = [];
  const importedTypes = new Set<string>();

  // 方法1: HTMLからシート一覧を取得してgidで取得
  const tabs = await discoverSheets(spreadsheetId);
  if (tabs.length > 0) {
    for (const tab of tabs) {
      const type = detectTypeFromSheetName(tab.name, surveyType);
      if (!type) continue;
      if (importedTypes.has(type)) continue;

      const csv = await fetchSheetByGid(spreadsheetId, tab.gid);
      if (csv) {
        results.push({ type, csv, sheetName: tab.name });
        importedTypes.add(type);
      }
    }
  }

  // 方法2: 方法1で見つからなかったタイプをgviz/tqでシート名指定して取得
  const candidates = surveyType === "jigyotai" ? JIGYOTAI_SHEET_CANDIDATES : CLINIC_SHEET_CANDIDATES;
  for (const candidate of candidates) {
    if (importedTypes.has(candidate.type)) continue; // 方法1で見つかったらスキップ

    for (const name of candidate.names) {
      const csv = await fetchSheetByName(spreadsheetId, name);
      if (csv) {
        results.push({ type: candidate.type, csv, sheetName: name });
        importedTypes.add(candidate.type);
        break;
      }
    }
  }

  // 方法3: 何も見つからなかった場合、デフォルトシートをフォールバック取得
  if (results.length === 0) {
    const { csv } = await fetchSheetAsCSV(spreadsheetUrl);
    results.push({ type: "auto", csv, sheetName: "default" });
  }

  return results;
}

export async function fetchSheetAsCSV(
  spreadsheetUrl: string
): Promise<{ csv: string; sheetName: string | null }> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    throw new Error(
      "スプレッドシートのURLが正しくありません。Google SpreadsheetのURLを貼り付けてください。"
    );
  }

  const gid = extractGid(spreadsheetUrl);

  // Google Sheets CSV export URL
  let exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
  if (gid) {
    exportUrl += `&gid=${gid}`;
  }

  const res = await fetch(exportUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "SurveyApp/1.0",
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("スプレッドシートが見つかりません。URLを確認してください。");
    }
    if (res.status === 403 || res.status === 401) {
      throw new Error(
        "スプレッドシートにアクセスできません。共有設定を「リンクを知っている全員が閲覧可」に変更してください。"
      );
    }
    throw new Error(`スプレッドシートの取得に失敗しました (HTTP ${res.status})`);
  }

  const csv = await res.text();

  if (!csv.trim()) {
    throw new Error("スプレッドシートが空です。");
  }

  // Check if we got an HTML response (login page redirect)
  if (csv.trim().startsWith("<!DOCTYPE") || csv.trim().startsWith("<html")) {
    throw new Error(
      "スプレッドシートにアクセスできません。共有設定を「リンクを知っている全員が閲覧可」に変更してください。"
    );
  }

  return { csv, sheetName: null };
}
