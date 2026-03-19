import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getStorageInfo } from "@/lib/storage-mode";

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  return NextResponse.json(getStorageInfo());
}
