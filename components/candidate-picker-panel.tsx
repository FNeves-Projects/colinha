"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { nullBallotNumber, type SpecialVoteKind } from "@/lib/ballot-selections";
import type { Office } from "@/lib/offices";
import type { CandidateSummary } from "@/lib/types";

function candidateInitials(candidate: CandidateSummary) {
  return candidate.ballotName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
}

function PickerPhoto({ candidate }: { candidate: CandidateSummary }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [candidate.photoUrl]);

  if (candidate.photoUrl && !imageFailed) {
    return (
      <Image
        className="candidate-photo"
        src={candidate.photoUrl}
        alt=""
        width={48}
        height={48}
        sizes="48px"
        unoptimized={candidate.photoUrl.startsWith("http")}
        crossOrigin={candidate.photoUrl.startsWith("http") ? "anonymous" : undefined}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span className="candidate-photo candidate-initials" aria-hidden="true">
      {candidateInitials(candidate)}
    </span>
  );
}

function PickerNumberBoxes({ number, digits }: { number?: string; digits: number }) {
  const values = Array.from({ length: digits }, (_, index) => number?.[index] ?? "");
  return (
    <span className="number-boxes" aria-hidden="true">
      {values.map((value, index) => (
        <span className={value ? "number-box filled" : "number-box"} key={index}>
          {value || "·"}
        </span>
      ))}
    </span>
  );
}

function VoteOptionButtons({
  office,
  onSelect,
}: {
  office: Office;
  onSelect: (vote: SpecialVoteKind) => void;
}) {
  return (
    <div className="vote-options picker-vote-options">
      <button type="button" className="vote-option vote-option-null" onClick={() => onSelect("nulo")}>
        <span className="vote-option-label">Votar nulo</span>
        <PickerNumberBoxes number={nullBallotNumber(office.digits)} digits={office.digits} />
        <span className="vote-option-tip">
          Número que não existe. Anula o voto naquele cargo. Fonte: TSE.
        </span>
      </button>
      <button type="button" className="vote-option vote-option-blank" onClick={() => onSelect("branco")}>
        <span className="vote-option-label">Votar em branco</span>
        <span className="ballot-blank-pill ballot-blank-pill-compact">BRANCO</span>
        <span className="vote-option-tip">
          Aperte BRANCO na urna. Não escolhe ninguém para o cargo. Fonte: TSE.
        </span>
      </button>
    </div>
  );
}

export function CandidatePickerPanel({
  office,
  presentation,
  onClose,
  onSelect,
  onSelectSpecial,
}: {
  office: Office;
  presentation: "inline" | "modal";
  onClose: () => void;
  onSelect: (candidate: CandidateSummary) => void;
  onSelectSpecial: (vote: SpecialVoteKind) => void;
}) {
  const partyFilterId = useId();
  const [query, setQuery] = useState("");
  const [party, setParty] = useState("");
  const [parties, setParties] = useState<string[]>([]);
  const [results, setResults] = useState<CandidateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/api/candidates?parties=1&office=${office.code}&uf=${office.jurisdiction}&year=2026`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then((response) => response.json())
      .then((data) => setParties(Array.isArray(data.parties) ? data.parties : []))
      .catch(() => setParties([]));

    return () => controller.abort();
  }, [office]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length > 0 && trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          office: String(office.code),
          uf: office.jurisdiction,
          year: "2026",
        });
        if (trimmed) params.set("q", trimmed);
        if (party) params.set("party", party);

        const response = await fetch(`/api/candidates?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Falha na busca");
        setResults(data.candidates ?? []);
        setSearched(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, trimmed ? 320 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [office, party, query]);

  useEffect(() => {
    if (presentation !== "modal") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [presentation]);

  const panel = (
    <section
      className={`picker-panel picker-panel-${presentation}`}
      role={presentation === "modal" ? "dialog" : "region"}
      aria-modal={presentation === "modal" ? true : undefined}
      aria-label={`Buscar candidato: ${office.label}`}
      onMouseDown={presentation === "modal" ? (event) => event.stopPropagation() : undefined}
    >
      <div className="picker-drawer-head">
        <div>
          <p className="picker-kicker">Eleição 2026 · {office.jurisdiction === "BR" ? "Brasil" : "São Paulo"}</p>
          <h2>{office.label}</h2>
        </div>
        <button className="picker-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
      </div>

      <div className="picker-toolbar">
        <div className="search-field picker-search">
          <Search size={17} />
          <input
            value={query}
            inputMode="search"
            autoComplete="off"
            placeholder="Busque candidato por nome ou número"
            onChange={(event) => setQuery(event.target.value)}
          />
          {loading && <span className="search-spinner" aria-label="Buscando" />}
        </div>
        <label className="picker-party-filter" htmlFor={partyFilterId}>
          <Filter size={15} />
          <select
            id={partyFilterId}
            value={party}
            onChange={(event) => setParty(event.target.value)}
          >
            <option value="">Todos os partidos</option>
            {parties.map((acronym) => (
              <option key={acronym} value={acronym}>{acronym}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="picker-results" role="listbox" aria-label={`Resultados para ${office.label}`}>
        {results.map((candidate) => (
          <button
            type="button"
            className="picker-result-main"
            key={candidate.id}
            onClick={() => onSelect(candidate)}
          >
            <PickerPhoto candidate={candidate} />
            <span>
              <strong>{candidate.ballotName}</strong>
              <small>{candidate.partyAcronym ?? "Partido não informado"}</small>
            </span>
            <b>{candidate.ballotNumber}</b>
          </button>
        ))}
        {searched && !loading && results.length === 0 && (
          <p className="picker-empty">Nenhum candidato encontrado nesse cargo.</p>
        )}
        {!searched && loading && (
          <p className="picker-empty">Carregando candidatos…</p>
        )}
      </div>

      {!office.fixed && <VoteOptionButtons office={office} onSelect={onSelectSpecial} />}
    </section>
  );

  if (presentation === "modal") {
    return (
      <div className="drawer-backdrop picker-backdrop" role="presentation" onMouseDown={onClose}>
        {panel}
      </div>
    );
  }

  return panel;
}
