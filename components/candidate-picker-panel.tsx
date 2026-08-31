"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";
import { nullBallotNumber, selectionPickerLabel, selectionRemoveLabel, type OfficeSelection, type SpecialVoteKind } from "@/lib/ballot-selections";
import type { Office } from "@/lib/offices";
import { fetchTicketSlateForOffice } from "@/lib/ticket-mate-fetch";
import { hasTicketSlate, slateMateRoleLabel } from "@/lib/ticket-mates";
import type { CandidateSummary } from "@/lib/types";
import { UrnaBrancoLabel } from "@/components/urna-branco-label";
import { UrnaConfirmaLabel } from "@/components/urna-confirma-label";
import { UrnaCorrigeLabel } from "@/components/urna-corrige-label";
import { UrnaNuloLabel } from "@/components/urna-nulo-label";

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

function useOfficeTicketSlate(office: Office, candidate: CandidateSummary | null) {
  const [mates, setMates] = useState<CandidateSummary[]>([]);

  useEffect(() => {
    if (!candidate || !hasTicketSlate(candidate.officeCode)) {
      setMates([]);
      return;
    }

    const controller = new AbortController();
    void fetchTicketSlateForOffice(office, candidate, controller.signal)
      .then((slate) => {
        if (!controller.signal.aborted) setMates(slate);
      })
      .catch(() => {
        if (!controller.signal.aborted) setMates([]);
      });

    return () => controller.abort();
  }, [office, candidate]);

  return mates;
}

function PickerTicketMateRow({
  headOfficeCode,
  mate,
  onInspect,
}: {
  headOfficeCode: number;
  mate: CandidateSummary;
  onInspect?: () => void;
}) {
  const content = (
    <>
      <PickerPhoto candidate={mate} />
      <div className="picker-ticket-mate-copy">
        <span>{slateMateRoleLabel(headOfficeCode, mate.officeCode)}</span>
        <strong>{mate.ballotName}</strong>
        <small>{mate.partyAcronym ?? "Partido não informado"}</small>
      </div>
      {onInspect && <span className="picker-selection-info">Ver info</span>}
    </>
  );

  if (!onInspect) {
    return <div className="picker-ticket-mate">{content}</div>;
  }

  return (
    <button
      type="button"
      className="picker-ticket-mate picker-ticket-mate-button"
      onClick={onInspect}
      aria-label={`Ver informações de ${mate.ballotName}`}
    >
      {content}
    </button>
  );
}

function PickerCandidatePreview({
  kicker,
  candidate,
  headOfficeCode,
  mates,
  label,
  number,
  special,
  hideLabel = false,
  onInspect,
  onInspectMate,
}: {
  kicker: string;
  candidate: CandidateSummary | null;
  headOfficeCode?: number;
  mates: CandidateSummary[];
  label: string;
  number?: string;
  special?: ReactNode;
  hideLabel?: boolean;
  onInspect?: () => void;
  onInspectMate?: (mate: CandidateSummary) => void;
}) {
  const main = (
    <div className="picker-selection-main">
      {candidate && <PickerPhoto candidate={candidate} />}
      <div className="picker-selection-copy">
        <span className="picker-selection-kicker">{kicker}</span>
        {!hideLabel && <strong>{label}</strong>}
        {candidate && (
          <small>{candidate.partyAcronym ?? "Partido não informado"}</small>
        )}
        {special}
      </div>
      {(number || onInspect) && (
        <div className="picker-selection-side">
          {number && <b>{number}</b>}
          {onInspect && <span className="picker-selection-info">Ver info</span>}
        </div>
      )}
    </div>
  );

  return (
    <>
      {candidate && onInspect ? (
        <button
          type="button"
          className="picker-selection-button"
          onClick={onInspect}
          aria-label={`Ver informações de ${label}`}
        >
          {main}
        </button>
      ) : main}
      {candidate && headOfficeCode && mates.map((mate) => (
        <PickerTicketMateRow
          key={mate.id}
          headOfficeCode={headOfficeCode}
          mate={mate}
          onInspect={onInspectMate ? () => onInspectMate(mate) : undefined}
        />
      ))}
    </>
  );
}

function VoteOptionButtons({
  pendingSelection,
  onPickSpecial,
  onConfirm,
  onRemoveFromColinha,
  currentSelection = null,
}: {
  pendingSelection: OfficeSelection;
  onPickSpecial: (vote: SpecialVoteKind) => void;
  onConfirm: () => void;
  onRemoveFromColinha?: () => void;
  currentSelection?: OfficeSelection;
}) {
  const canConfirm = Boolean(pendingSelection);
  const hasColinhaSelection = Boolean(onRemoveFromColinha && currentSelection && selectionPickerLabel(currentSelection));
  const canCorrige = hasColinhaSelection;
  const canPickSpecial = !hasColinhaSelection;

  return (
    <div className="vote-options picker-vote-options">
      <button
        type="button"
        className={`vote-option vote-option-null vote-option-null-urna${pendingSelection?.type === "special" && pendingSelection.vote === "nulo" ? " is-pending" : ""}`}
        onClick={() => onPickSpecial("nulo")}
        disabled={!canPickSpecial}
        aria-label="Votar nulo"
        aria-pressed={pendingSelection?.type === "special" && pendingSelection.vote === "nulo"}
      >
        <UrnaNuloLabel interactive />
      </button>
      <button
        type="button"
        className={`vote-option vote-option-blank vote-option-blank-urna${pendingSelection?.type === "special" && pendingSelection.vote === "branco" ? " is-pending" : ""}`}
        onClick={() => onPickSpecial("branco")}
        disabled={!canPickSpecial}
        aria-label="Votar em branco"
        aria-pressed={pendingSelection?.type === "special" && pendingSelection.vote === "branco"}
      >
        <UrnaBrancoLabel interactive />
      </button>
      <button
        type="button"
        className="vote-option vote-option-corrige vote-option-corrige-urna"
        onClick={() => onRemoveFromColinha?.()}
        disabled={!canCorrige}
        aria-label={canCorrige ? selectionRemoveLabel(currentSelection ?? null) : "Corrige"}
      >
        <UrnaCorrigeLabel interactive />
      </button>
      <button
        type="button"
        className="vote-option vote-option-confirma vote-option-confirma-urna"
        onClick={onConfirm}
        disabled={!canConfirm}
        aria-label="Confirmar seleção"
      >
        <UrnaConfirmaLabel interactive />
      </button>
    </div>
  );
}

export function CandidatePickerPanel({
  office,
  presentation,
  currentSelection = null,
  onClose,
  onSelect,
  onSelectSpecial,
  onClearCurrent,
  onPrefetch,
  onInspectCandidate,
}: {
  office: Office;
  presentation: "inline" | "modal";
  currentSelection?: OfficeSelection;
  onClose: () => void;
  onSelect: (candidate: CandidateSummary) => void;
  onSelectSpecial: (vote: SpecialVoteKind) => void;
  onClearCurrent?: () => void;
  onPrefetch?: (candidate: CandidateSummary) => void;
  onInspectCandidate?: (candidate: CandidateSummary, mode?: "pending" | "saved") => void;
}) {
  const partyFilterId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [party, setParty] = useState("");
  const [parties, setParties] = useState<string[]>([]);
  const [results, setResults] = useState<CandidateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<OfficeSelection>(null);
  const pendingCandidate = pendingSelection?.type === "candidate" ? pendingSelection.candidate : null;
  const currentCandidate = currentSelection?.type === "candidate" ? currentSelection.candidate : null;
  const pendingMates = useOfficeTicketSlate(office, pendingCandidate);
  const currentMates = useOfficeTicketSlate(office, currentCandidate);

  useEffect(() => {
    setPendingSelection(null);
  }, [office]);

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

  const currentLabel = selectionPickerLabel(currentSelection);
  const pendingLabel = selectionPickerLabel(pendingSelection);
  const pendingIsSpecial = pendingSelection?.type === "special";
  const currentIsSpecial = currentSelection?.type === "special";

  function handleClearCurrent() {
    onClearCurrent?.();
    setPendingSelection(null);
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }

  function handlePickCandidate(candidate: CandidateSummary) {
    setPendingSelection({ type: "candidate", candidate });
  }

  function handlePickSpecial(vote: SpecialVoteKind) {
    setPendingSelection({ type: "special", vote });
  }

  function handleConfirm() {
    if (!pendingSelection) return;
    if (pendingSelection.type === "candidate") {
      onSelect(pendingSelection.candidate);
      setPendingSelection(null);
      return;
    }
    onSelectSpecial(pendingSelection.vote);
    setPendingSelection(null);
  }

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
        <button className="btn-glass btn-glass--icon-sm picker-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
      </div>

      {pendingLabel && (
        <div className="picker-pending">
          <PickerCandidatePreview
            kicker="Selecionado"
            candidate={pendingCandidate}
            headOfficeCode={pendingCandidate?.officeCode}
            mates={pendingMates}
            label={pendingLabel ?? ""}
            hideLabel={pendingIsSpecial}
            number={pendingCandidate?.ballotNumber}
            onInspect={pendingCandidate && onInspectCandidate
              ? () => onInspectCandidate(pendingCandidate, "pending")
              : undefined}
            onInspectMate={onInspectCandidate ? (mate) => onInspectCandidate(mate) : undefined}
            special={(
              <>
                {pendingSelection?.type === "special" && pendingSelection.vote === "nulo" && (
                  <PickerNumberBoxes number={nullBallotNumber(office.digits)} digits={office.digits} />
                )}
                {pendingSelection?.type === "special" && pendingSelection.vote === "branco" && (
                  <UrnaBrancoLabel compact />
                )}
              </>
            )}
          />
        </div>
      )}

      {currentLabel && onClearCurrent && !office.fixed && !pendingLabel && (
        <div className="picker-current">
          <PickerCandidatePreview
            kicker="Escolha atual"
            candidate={currentCandidate}
            headOfficeCode={currentCandidate?.officeCode}
            mates={currentMates}
            label={currentLabel ?? ""}
            hideLabel={currentIsSpecial}
            number={currentCandidate?.ballotNumber}
            onInspect={currentCandidate && onInspectCandidate
              ? () => onInspectCandidate(currentCandidate, "saved")
              : undefined}
            onInspectMate={onInspectCandidate ? (mate) => onInspectCandidate(mate) : undefined}
            special={(
              <>
                {currentSelection?.type === "special" && currentSelection.vote === "nulo" && (
                  <PickerNumberBoxes number={nullBallotNumber(office.digits)} digits={office.digits} />
                )}
                {currentSelection?.type === "special" && currentSelection.vote === "branco" && (
                  <UrnaBrancoLabel compact />
                )}
              </>
            )}
          />
        </div>
      )}

      <div className="picker-toolbar">
        <div className="search-field picker-search">
          <Search size={17} />
          <input
            ref={searchRef}
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
            <option value="">Partidos</option>
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
            className={`btn-glass btn-glass--list picker-result-main${pendingCandidate?.id === candidate.id ? " is-pending" : ""}${currentCandidate?.id === candidate.id ? " is-current" : ""}`}
            key={candidate.id}
            onPointerEnter={() => onPrefetch?.(candidate)}
            onFocus={() => onPrefetch?.(candidate)}
            onTouchStart={() => onPrefetch?.(candidate)}
            onClick={() => handlePickCandidate(candidate)}
            aria-pressed={pendingCandidate?.id === candidate.id}
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

      {!office.fixed && (
        <VoteOptionButtons
          pendingSelection={pendingSelection}
          onPickSpecial={handlePickSpecial}
          onConfirm={handleConfirm}
          onRemoveFromColinha={onClearCurrent ? handleClearCurrent : undefined}
          currentSelection={currentSelection}
        />
      )}
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
