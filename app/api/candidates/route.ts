import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateById, getTicketMateForHead, listPartiesForOffice, searchCandidates } from "@/lib/candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const officeScopeSchema = z.object({
  office: z.coerce.number().int().positive(),
  uf: z.enum(["SP", "BR"]),
  year: z.coerce.number().int().min(2026).max(2030).default(2026),
});

const searchSchema = officeScopeSchema.extend({
  q: z.string().trim().max(80).optional(),
  party: z.string().trim().max(20).optional(),
});

const ticketMateSchema = officeScopeSchema.extend({
  headOffice: z.coerce.number().int().positive(),
  ballot: z.string().trim().min(1).max(10),
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

    if (request.nextUrl.searchParams.get("ticketMate") === "1") {
      const params = ticketMateSchema.safeParse({
        headOffice: request.nextUrl.searchParams.get("headOffice"),
        ballot: request.nextUrl.searchParams.get("ballot"),
        uf: request.nextUrl.searchParams.get("uf"),
        year: request.nextUrl.searchParams.get("year") ?? 2026,
      });
      if (!params.success) {
        return NextResponse.json({ error: "Invalid ticket mate lookup." }, { status: 400 });
      }
      const ticketMate = await getTicketMateForHead({
        headOfficeCode: params.data.headOffice,
        ballotNumber: params.data.ballot,
        uf: params.data.uf,
        year: params.data.year,
      });
      return NextResponse.json({ ticketMate }, { headers: { "Cache-Control": "no-store" } });
    }

    if (request.nextUrl.searchParams.get("parties") === "1") {
      const params = officeScopeSchema.safeParse({
        office: request.nextUrl.searchParams.get("office"),
        uf: request.nextUrl.searchParams.get("uf"),
        year: request.nextUrl.searchParams.get("year") ?? 2026,
      });
      if (!params.success) {
        return NextResponse.json({ error: "Invalid party lookup." }, { status: 400 });
      }
      const parties = await listPartiesForOffice({
        officeCode: params.data.office,
        uf: params.data.uf,
        year: params.data.year,
      });
      return NextResponse.json({ parties }, { headers: { "Cache-Control": "no-store" } });
    }

    const params = searchSchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      party: request.nextUrl.searchParams.get("party") ?? undefined,
      office: request.nextUrl.searchParams.get("office"),
      uf: request.nextUrl.searchParams.get("uf"),
      year: request.nextUrl.searchParams.get("year") ?? 2026,
    });
    if (!params.success) {
      return NextResponse.json({ error: "Invalid search." }, { status: 400 });
    }

    const query = params.data.q?.trim() ?? "";
    if (query.length > 0 && query.length < 2) {
      return NextResponse.json({ error: "Invalid search." }, { status: 400 });
    }

    const candidates = await searchCandidates({
      query: query || undefined,
      officeCode: params.data.office,
      uf: params.data.uf,
      year: params.data.year,
      party: params.data.party,
    });
    return NextResponse.json({ candidates }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("candidate_api_error", error);
    return NextResponse.json({ error: "Unable to search candidates right now." }, { status: 500 });
  }
}
