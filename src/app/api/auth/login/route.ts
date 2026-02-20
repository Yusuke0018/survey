import { NextRequest, NextResponse } from "next/server";
import { login, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const token = login(password);

  if (!token) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  return setSessionCookie(response, token);
}
