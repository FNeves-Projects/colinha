import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateById, searchCandidates } from "@/lib/candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const searchSchema = z.object({
  q: z.string().trim().min(2).max(80),
  office: z.coerce.number().int().positive(),
  uf: z.enum(["SP", "BR"]),
  year: z.coerce.number().int().min(2026).max(2030).default(2026),
});

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  try {
    if (id) {
      const candidate = await getCandidateById(id);
      return candidate
        ? NextResponse.json({ candidate })
        : NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const params = searchSchema.safeParse({
      q: request.nextUrl.searchParams.get("q"),
      office: request.nextUrl.searchParams.get("office"),
      uf: request.nextUrl.searchParams.get("uf"),
      year: request.nextUrl.searchParams.get("year") ?? 2026,
    });
    if (!params.success) {
      return NextResponse.json({ error: "Invalid search." }, { status: 400 });
    }
    const candidates = await searchCandidates({
      query: params.data.q,
      officeCode: params.data.office,
      uf: params.data.uf,
      year: params.data.year,
    });
    return NextResponse.json({ candidates }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("candidate_api_error", error);
    return NextResponse.json({ error: "Unable to search candidates right now." }, { status: 500 });
  }
}
