import { NextResponse } from "next/server";
import { isAuthenticated, getSessionRole } from "@/lib/auth";

export async function GET() {
  const authenticated = await isAuthenticated();
  const role = await getSessionRole();
  return NextResponse.json({ authenticated, role });
}
