import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  getGoogleOAuthConfig,
} from "@/lib/auth";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 10 * 60,
    path: "/",
  };
}

export async function GET(request: NextRequest) {
  try {
    const { clientId } = getGoogleOAuthConfig();
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/respond";
    const redirectUri = new URL("/api/auth/google/callback", request.url).toString();

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("access_type", "online");
    authUrl.searchParams.set("include_granted_scopes", "true");

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, cookieOptions());
    response.cookies.set(GOOGLE_OAUTH_NONCE_COOKIE, `${nonce}::${callbackUrl}`, cookieOptions());
    return response;
  } catch (error) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", error instanceof Error ? error.message : "Googleログインの設定が未完了です");
    return NextResponse.redirect(loginUrl);
  }
}
