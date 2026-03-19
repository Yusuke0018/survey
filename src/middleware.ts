import { NextRequest, NextResponse } from "next/server";
import { getMiddlewareSession } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const { valid, role } = getMiddlewareSession(request);

  // Redirect to login if no session
  if (!valid) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes
  if (
    (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) &&
    role !== "admin"
  ) {
    const respondUrl = new URL("/respond", request.url);
    return NextResponse.redirect(respondUrl);
  }

  // Staff trying to access admin API
  if (pathname.startsWith("/api/surveys") && role !== "admin") {
    // Allow GET for active surveys listing for staff respond pages
    if (request.method === "GET" && (pathname === "/api/surveys/active" || pathname.match(/^\/api\/surveys\/\d+\/questions$/))) {
      return NextResponse.next();
    }
    // Allow POST for submitting responses
    if (request.method === "POST" && pathname.match(/^\/api\/surveys\/\d+\/respond$/)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (pathname.startsWith("/api/trends") && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Add role to headers for API routes
  const response = NextResponse.next();
  response.headers.set("x-user-role", role || "");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
