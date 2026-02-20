import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SESSION_COOKIE = "survey_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function getAppPassword(): string {
  return process.env.APP_PASSWORD || "admin";
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Simple in-memory session store (good enough for single-server deployment)
const sessions = new Map<string, { expires: number }>();

export function login(password: string): string | null {
  if (password !== getAppPassword()) return null;
  const token = generateToken();
  sessions.set(token, { expires: Date.now() + SESSION_MAX_AGE * 1000 });
  return token;
}

export function validateSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function logout(token: string) {
  sessions.delete(token);
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value || null;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getSessionToken();
  if (!token) return false;
  return validateSession(token);
}

export function setSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export async function requireAuth(): Promise<NextResponse | null> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// Middleware helper
export function isAuthRoute(request: NextRequest): boolean {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return validateSession(token);
}
