import { NextRequest, NextResponse } from "next/server";
import { getCurrentGoogleUser } from "@/lib/auth";
import { getOwnedResponseDetail } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ responseId: string }> }
) {
  const user = await getCurrentGoogleUser();
  if (!user) {
    return NextResponse.json({ error: "Googleログインが必要です" }, { status: 401 });
  }

  const { responseId } = await params;
  const detail = await getOwnedResponseDetail(Number.parseInt(responseId, 10), user.sub);
  if (!detail) {
    return NextResponse.json({ error: "回答が見つかりません" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
