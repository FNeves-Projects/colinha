import { NextRequest, NextResponse } from "next/server";
import { syncTse } from "@/lib/tse-sync";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await syncTse()) });
  } catch (error) {
    console.error("tse_sync_error", error);
    return NextResponse.json({ error: "Failed to sync TSE data." }, { status: 500 });
  }
}
