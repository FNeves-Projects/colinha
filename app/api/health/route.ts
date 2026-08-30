import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";

export function GET() {
  return NextResponse.json({ ok: true, databaseConfigured: hasDatabase() });
}
