import { NextRequest, NextResponse } from "next/server";
import { login, setSessionCookies } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const result = login(password);

  if (!result) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true, role: result.role });
  return setSessionCookies(response, result.role);
}
