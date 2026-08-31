import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateProposals } from "@/lib/candidate-proposals";
import { proposalDownloadFileName, tseProposalDocumentUrl } from "@/lib/divulga-proposals";
import { getCandidateById, getTicketChapaForCandidate, getTicketSlateForHead, listPartiesForOffice, searchCandidates } from "@/lib/candidates";

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

const ticketMateSchema = z.object({
  headOffice: z.coerce.number().int().positive(),
  ballot: z.string().trim().min(1).max(10),
  uf: z.string().trim().transform((value) => (value === "BRASIL" ? "BR" : value)).pipe(z.enum(["SP", "BR"])),
  year: z.coerce.number().int().min(2026).max(2030).default(2026),
});

const ticketChapaSchema = z.object({
  office: z.coerce.number().int().positive(),
  candidateId: z.string().trim().min(1),
  ballot: z.string().trim().min(1).max(10),
  uf: z.string().trim().transform((value) => (value === "BRASIL" ? "BR" : value)).pipe(z.enum(["SP", "BR"])),
  year: z.coerce.number().int().min(2026).max(2030).default(2026),
});

const proposalsSchema = z.object({
  sqCandidate: z.string().trim().min(1).max(20),
  uf: z.string().trim().transform((value) => (value === "BRASIL" ? "BR" : value)).pipe(z.enum(["SP", "BR"])),
  office: z.coerce.number().int().positive(),
});

const proposalPdfSchema = z.object({
  fileId: z.string().trim().regex(/^\d+$/),
  download: z.enum(["1"]).optional(),
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

    if (request.nextUrl.searchParams.get("proposals") === "1") {
      const params = proposalsSchema.safeParse({
        sqCandidate: request.nextUrl.searchParams.get("sqCandidate"),
        uf: request.nextUrl.searchParams.get("uf"),
        office: request.nextUrl.searchParams.get("office"),
      });
      if (!params.success) {
        return NextResponse.json({ error: "Invalid proposal lookup." }, { status: 400 });
      }
      const proposals = await getCandidateProposals({
        sqCandidate: params.data.sqCandidate,
        uf: params.data.uf,
        officeCode: params.data.office,
      });
      return NextResponse.json({ proposals }, { headers: { "Cache-Control": "public, max-age=3600" } });
    }

    if (request.nextUrl.searchParams.get("proposalPdf") === "1") {
      const params = proposalPdfSchema.safeParse({
        fileId: request.nextUrl.searchParams.get("fileId"),
        download: request.nextUrl.searchParams.get("download") === "1" ? "1" : undefined,
      });
      if (!params.success) {
        return NextResponse.json({ error: "Invalid proposal PDF lookup." }, { status: 400 });
      }

      const sourceUrl = tseProposalDocumentUrl(params.data.fileId);
      const response = await fetch(sourceUrl, {
        headers: { Accept: "application/pdf", "User-Agent": "ColinhaDigital/1.0" },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!response.ok) {
        return NextResponse.json({ error: "Unable to load proposal PDF." }, { status: 502 });
      }

      const bytes = await response.arrayBuffer();
      const fileName = proposalDownloadFileName(`proposta-${params.data.fileId}`);
      const disposition = params.data.download
        ? `attachment; filename="${fileName}"`
        : `inline; filename="${fileName}"`;

      return new NextResponse(bytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": disposition,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (request.nextUrl.searchParams.get("ticketChapa") === "1") {
      const params = ticketChapaSchema.safeParse({
        office: request.nextUrl.searchParams.get("office"),
        candidateId: request.nextUrl.searchParams.get("candidateId"),
        ballot: request.nextUrl.searchParams.get("ballot"),
        uf: request.nextUrl.searchParams.get("uf"),
        year: request.nextUrl.searchParams.get("year") ?? 2026,
      });
      if (!params.success) {
        return NextResponse.json({ error: "Invalid ticket chapa lookup." }, { status: 400 });
      }
      const slate = await getTicketChapaForCandidate({
        officeCode: params.data.office,
        candidateId: params.data.candidateId,
        ballotNumber: params.data.ballot,
        uf: params.data.uf,
        year: params.data.year,
      });
      return NextResponse.json({ slate }, { headers: { "Cache-Control": "no-store" } });
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
      const slate = await getTicketSlateForHead({
        headOfficeCode: params.data.headOffice,
        ballotNumber: params.data.ballot,
        uf: params.data.uf,
        year: params.data.year,
      });
      return NextResponse.json({ ticketMate: slate[0] ?? null, slate }, { headers: { "Cache-Control": "no-store" } });
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
