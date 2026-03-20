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

/**
 * シート名からCSVを取得する（gviz/tq エンドポイント使用）
 * シートが存在しない場合は null を返す
 */
async function fetchSheetByName(
  spreadsheetId: string,
  sheetName: string
): Promise<string | null> {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const res = await fetch(exportUrl, {
    redirect: "follow",
    headers: { "User-Agent": "SurveyApp/1.0" },
  });

  if (!res.ok) return null;

  const text = await res.text();
  if (!text.trim()) return null;

  // gviz がエラーを返した場合（シート名が存在しない等）
  if (text.trim().startsWith("google.visualization.Query.setResponse")) {
    return null;
  }

  // HTMLが返った場合（アクセス不可）
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    return null;
  }

  return text;
}

/** シート名 → 回答者タイプのマッピング */
const JIGYOTAI_SHEET_NAMES: Record<string, string[]> = {
  staff: ["スタッフ", "staff", "Staff", "スタッフ回答"],
  manager: ["責任者", "事業責任者", "現場責任者", "manager", "Manager", "責任者回答"],
  corporate: ["経営企画室", "corporate", "Corporate", "本部", "経営企画室回答"],
};

const CLINIC_SHEET_NAMES: Record<string, string[]> = {
  staff: ["スタッフ", "staff", "Staff", "スタッフ回答"],
  director: ["院長", "director", "Director", "院長回答"],
};

export interface SheetResult {
  type: string;
  csv: string;
  sheetName: string;
}

/**
 * スプレッドシートから全シートをタイプ別に取得する
 * シート名で回答者タイプを自動判定し、見つかったシートを全て返す
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

  const nameMap = surveyType === "jigyotai" ? JIGYOTAI_SHEET_NAMES : CLINIC_SHEET_NAMES;
  const results: SheetResult[] = [];

  for (const [type, names] of Object.entries(nameMap)) {
    for (const name of names) {
      const csv = await fetchSheetByName(spreadsheetId, name);
      if (csv) {
        results.push({ type, csv, sheetName: name });
        break; // このタイプは見つかったので次のタイプへ
      }
    }
  }

  // シート名で見つからなかった場合、デフォルトシート（1枚目）をフォールバック取得
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
