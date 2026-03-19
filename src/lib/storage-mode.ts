import { NextResponse } from "next/server";

const IS_VERCEL = !!process.env.VERCEL;

export type StorageMode = "persistent-sqlite" | "ephemeral-vercel-tmp";

export function getStorageMode(): StorageMode {
  if (process.env.TURSO_DATABASE_URL) {
    return "persistent-sqlite";
  }

  if (IS_VERCEL && !process.env.SQLITE_DB_PATH) {
    return "ephemeral-vercel-tmp";
  }
  return "persistent-sqlite";
}

export function getStorageInfo() {
  const mode = getStorageMode();
  if (mode === "ephemeral-vercel-tmp") {
    return {
      mode,
      writesEnabled: false,
      message: "このVercel環境は /tmp の一時SQLiteを使用しているため、作成・CSVアップロード・回答保存は永続化されません。永続DBの設定が必要です。",
    };
  }

  return {
    mode,
    writesEnabled: true,
    message: null,
  };
}

export function getStorageWriteGuardResponse() {
  const info = getStorageInfo();
  if (info.writesEnabled) {
    return null;
  }

  return NextResponse.json(
    {
      error: info.message,
      storageMode: info.mode,
    },
    { status: 503 }
  );
}
