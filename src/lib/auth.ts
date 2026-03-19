import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export type UserRole = "admin" | "staff";

const SESSION_COOKIE = "survey_session";
const ROLE_COOKIE = "survey_role";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "liberalarts";
}

function getStaffPassword(): string {
  return process.env.STAFF_PASSWORD || "staff";
}

export function login(password: string): { role: UserRole } | null {
  if (password === getAdminPassword()) {
    return { role: "admin" };
  }
  if (password === getStaffPassword()) {
    return { role: "staff" };
  }
  return null;
}

export async function getSessionRole(): Promise<UserRole | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;
  const role = cookieStore.get(ROLE_COOKIE)?.value as UserRole | undefined;
  return role || null;
}

export async function isAuthenticated(): Promise<boolean> {
  const role = await getSessionRole();
  return role !== null;
}

export async function isAdmin(): Promise<boolean> {
  const role = await getSessionRole();
  return role === "admin";
}

export function setSessionCookies(response: NextResponse, role: UserRole): NextResponse {
  response.cookies.set(SESSION_COOKIE, "active", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  response.cookies.set(ROLE_COOKIE, role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return response;
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(ROLE_COOKIE);
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

// Middleware helper - reads directly from cookies (no in-memory store needed)
export function getMiddlewareSession(request: NextRequest): { valid: boolean; role: UserRole | null } {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return { valid: false, role: null };
  const role = request.cookies.get(ROLE_COOKIE)?.value as UserRole | undefined;
  if (!role) return { valid: false, role: null };
  return { valid: true, role };
}
