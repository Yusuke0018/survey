import { NextResponse } from "next/server";
import { getCurrentGoogleUser } from "@/lib/auth";
import { getOwnedResponseSummaries } from "@/lib/db";

export async function GET() {
  const user = await getCurrentGoogleUser();
  if (!user) {
    return NextResponse.json({ error: "Googleログインが必要です" }, { status: 401 });
  }

  const responses = await getOwnedResponseSummaries(user.sub);
  return NextResponse.json(responses);
}
