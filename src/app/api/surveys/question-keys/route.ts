import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { queryAll } from "@/lib/db";

export async function GET(_request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const rows = await queryAll<{ question_key: string }>(
    "SELECT DISTINCT question_key FROM question_templates WHERE question_key IS NOT NULL AND question_key != '' ORDER BY question_key"
  );

  return NextResponse.json(rows.map((r) => r.question_key));
}
