/**
 * Google Spreadsheet URL からシートIDを抽出し、CSV形式でデータを取得する
 * シートが「リンクを知っている人は閲覧可」に設定されている必要がある
 */

export function extractSpreadsheetId(url: string): string | null {
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function extractGid(url: string): string | null {
  const match = url.match(/[#&?]gid=(\d+)/);
  return match ? match[1] : null;
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
