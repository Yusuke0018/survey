import { NextResponse } from "next/server";
import { getSessionToken, logout, clearSessionCookie } from "@/lib/auth";

export async function POST() {
  const token = await getSessionToken();
  if (token) logout(token);
  const response = NextResponse.json({ success: true });
  return clearSessionCookie(response);
}
