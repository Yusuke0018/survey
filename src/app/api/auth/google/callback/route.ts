import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  getGoogleOAuthConfig,
  setGoogleSessionCookies,
} from "@/lib/auth";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function buildLoginRedirect(request: NextRequest, message: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", message);
  return loginUrl;
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const nonceCookie = request.cookies.get(GOOGLE_OAUTH_NONCE_COOKIE)?.value;

  if (error) {
    return NextResponse.redirect(buildLoginRedirect(request, "Googleログインがキャンセルされました"));
  }

  if (!code || !state || !stateCookie || !nonceCookie || state !== stateCookie) {
    return NextResponse.redirect(buildLoginRedirect(request, "Googleログインの検証に失敗しました"));
  }

  const [expectedNonce, callbackPath] = nonceCookie.split("::");

  try {
    const { clientId, clientSecret } = getGoogleOAuthConfig();
    const redirectUri = new URL("/api/auth/google/callback", request.url).toString();

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(buildLoginRedirect(request, "Google認証トークンの取得に失敗しました"));
    }

    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) {
      return NextResponse.redirect(buildLoginRedirect(request, "Google IDトークンが返されませんでした"));
    }

    const { payload } = await jwtVerify(tokens.id_token, GOOGLE_JWKS, {
      audience: clientId,
    });

    const issuer = typeof payload.iss === "string" ? payload.iss : "";
    if (!["https://accounts.google.com", "accounts.google.com"].includes(issuer)) {
      return NextResponse.redirect(buildLoginRedirect(request, "Googleトークンの発行元が不正です"));
    }

    if (payload.nonce !== expectedNonce) {
      return NextResponse.redirect(buildLoginRedirect(request, "Googleログインの nonce 検証に失敗しました"));
    }

    if (payload.email_verified !== true || typeof payload.email !== "string" || typeof payload.sub !== "string") {
      return NextResponse.redirect(buildLoginRedirect(request, "確認済みの Google アカウントが必要です"));
    }

    const destination = callbackPath && callbackPath.startsWith("/") ? callbackPath : "/respond";
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    response.cookies.delete(GOOGLE_OAUTH_NONCE_COOKIE);

    return setGoogleSessionCookies(response, {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
    });
  } catch {
    return NextResponse.redirect(buildLoginRedirect(request, "Googleログインの処理に失敗しました"));
  }
}
