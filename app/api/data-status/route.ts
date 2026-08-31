import { NextResponse } from "next/server";
import { getDataFreshness } from "@/lib/data-freshness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const freshness = await getDataFreshness();
    return NextResponse.json(
      { freshness },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    console.error("data_status_error", error);
    return NextResponse.json({ freshness: null }, { status: 500 });
  }
}
