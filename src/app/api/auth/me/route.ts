import { NextResponse } from "next/server";
import { getCurrentGoogleUser, getSessionProvider, getSessionRole } from "@/lib/auth";

export async function GET() {
  const role = await getSessionRole();
  const provider = await getSessionProvider();
  const googleUser = await getCurrentGoogleUser();

  return NextResponse.json({
    authenticated: role != null,
    role,
    provider,
    user: googleUser,
  });
}
