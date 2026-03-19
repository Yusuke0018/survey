import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export type UserRole = "admin" | "staff";
export type SessionProvider = "admin" | "google";

const SESSION_COOKIE = "survey_session";
const ROLE_COOKIE = "survey_role";
const PROVIDER_COOKIE = "survey_provider";
const GOOGLE_SUB_COOKIE = "survey_google_sub";
const GOOGLE_EMAIL_COOKIE = "survey_google_email";
const GOOGLE_NAME_COOKIE = "survey_google_name";
export const GOOGLE_OAUTH_STATE_COOKIE = "survey_google_oauth_state";
export const GOOGLE_OAUTH_NONCE_COOKIE = "survey_google_oauth_nonce";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export interface GoogleSessionUser {
  provider: "google";
  role: "staff";
  sub: string;
  email: string;
  name: string | null;
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "liberalarts";
}

export function login(password: string): { role: UserRole } | null {
  if (password === getAdminPassword()) {
    return { role: "admin" };
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
  response.cookies.set(PROVIDER_COOKIE, "admin", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return response;
}

export function setGoogleSessionCookies(
  response: NextResponse,
  user: { sub: string; email: string; name?: string | null }
): NextResponse {
  response.cookies.set(SESSION_COOKIE, "active", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  response.cookies.set(ROLE_COOKIE, "staff", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  response.cookies.set(PROVIDER_COOKIE, "google", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  response.cookies.set(GOOGLE_SUB_COOKIE, user.sub, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  response.cookies.set(GOOGLE_EMAIL_COOKIE, user.email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  response.cookies.set(GOOGLE_NAME_COOKIE, user.name || "", {
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
  response.cookies.delete(PROVIDER_COOKIE);
  response.cookies.delete(GOOGLE_SUB_COOKIE);
  response.cookies.delete(GOOGLE_EMAIL_COOKIE);
  response.cookies.delete(GOOGLE_NAME_COOKIE);
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  response.cookies.delete(GOOGLE_OAUTH_NONCE_COOKIE);
  return response;
}

export async function getSessionProvider(): Promise<SessionProvider | null> {
  const cookieStore = await cookies();
  const provider = cookieStore.get(PROVIDER_COOKIE)?.value as SessionProvider | undefined;
  return provider || null;
}

export async function getCurrentGoogleUser(): Promise<GoogleSessionUser | null> {
  const cookieStore = await cookies();
  const role = cookieStore.get(ROLE_COOKIE)?.value;
  const provider = cookieStore.get(PROVIDER_COOKIE)?.value;
  if (role !== "staff" || provider !== "google") return null;

  const sub = cookieStore.get(GOOGLE_SUB_COOKIE)?.value;
  const email = cookieStore.get(GOOGLE_EMAIL_COOKIE)?.value;
  const name = cookieStore.get(GOOGLE_NAME_COOKIE)?.value || null;

  if (!sub || !email) return null;

  return {
    provider: "google",
    role: "staff",
    sub,
    email,
    name,
  };
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

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth の環境変数が設定されていません");
  }

  return { clientId, clientSecret };
}
