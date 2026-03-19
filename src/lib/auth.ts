import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export type UserRole = "admin" | "staff";

const SESSION_COOKIE = "survey_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "liberalarts";
}

function getStaffPassword(): string {
  return process.env.STAFF_PASSWORD || "staff";
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// In-memory session store
const sessions = new Map<string, { role: UserRole; expires: number }>();

export function login(password: string): { token: string; role: UserRole } | null {
  if (password === getAdminPassword()) {
    const token = generateToken();
    sessions.set(token, { role: "admin", expires: Date.now() + SESSION_MAX_AGE * 1000 });
    return { token, role: "admin" };
  }
  if (password === getStaffPassword()) {
    const token = generateToken();
    sessions.set(token, { role: "staff", expires: Date.now() + SESSION_MAX_AGE * 1000 });
    return { token, role: "staff" };
  }
  return null;
}

export function validateSession(token: string): { valid: boolean; role: UserRole | null } {
  const session = sessions.get(token);
  if (!session) return { valid: false, role: null };
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return { valid: false, role: null };
  }
  return { valid: true, role: session.role };
}

export function logout(token: string) {
  sessions.delete(token);
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value || null;
}

export async function getSessionRole(): Promise<UserRole | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const { valid, role } = validateSession(token);
  return valid ? role : null;
}

export async function isAuthenticated(): Promise<boolean> {
  const role = await getSessionRole();
  return role !== null;
}

export async function isAdmin(): Promise<boolean> {
  const role = await getSessionRole();
  return role === "admin";
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

export async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// Middleware helper
export function getMiddlewareSession(request: NextRequest): { valid: boolean; role: UserRole | null } {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return { valid: false, role: null };
  return validateSession(token);
}
