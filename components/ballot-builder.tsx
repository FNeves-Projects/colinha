"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  ArrowLeftRight,
  Check,
  ExternalLink,
  Info,
  LockKeyhole,
  Search,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { OFFICES, TERESINHA, type Office } from "@/lib/offices";
import {
  nullBallotNumber,
  normalizeSelections,
  selectionCandidate,
  selectionNotice,
  selectionPickerLabel,
  selectionRemoveLabel,
  selectionShareLine,
  type OfficeSelection,
  type Selections,
  type SpecialVoteKind,
} from "@/lib/ballot-selections";
import { partyLogoUrl, partyBadgeFallback } from "@/lib/party-logos";
import { previewOfficeLabel } from "@/lib/party-styles";
import { hasTicketMate, ticketMateRoleLabel } from "@/lib/ticket-mates";
import { normalizeSocialLinks } from "@/lib/social-links";
import { tseCandidateUrl } from "@/lib/tse-urls";
import type { Candidate, CandidateSummary } from "@/lib/types";
import { CandidatePickerPanel } from "@/components/candidate-picker-panel";
import { SocialNetworkIcon } from "@/components/social-network-icon";

const STORAGE_KEY = "colinha-digital-2026-v1";
const EMPTY_TSE_VALUES = new Set(["#NULO#", "#NE", "-1"]);

function initialSelections(): Selections {
  return Object.fromEntries(
    OFFICES.map((office) => [
      office.id,
      office.fixed
        ? { type: "candidate", candidate: sanitizeCandidateSummary(TERESINHA) }
        : null,
    ]),
  );
}

function candidateInitials(candidate: CandidateSummary) {
  return candidate.ballotName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
}

function cleanCandidateText(value: string | null | undefined) {
  const clean = value?.trim();
  return clean && !EMPTY_TSE_VALUES.has(clean.toUpperCase()) ? clean : null;
}

function sanitizeCandidateSummary(candidate: CandidateSummary): CandidateSummary {
  return {
    ...candidate,
    partyAcronym: cleanCandidateText(candidate.partyAcronym),
    status: cleanCandidateText(candidate.status),
    photoUrl: cleanCandidateText(candidate.photoUrl),
  };
}

function sanitizeSelections(selections: Selections): Selections {
  return Object.fromEntries(
    OFFICES.map((office) => {
      const selection = selections[office.id] ?? null;
      if (office.fixed) {
        return [office.id, { type: "candidate", candidate: sanitizeCandidateSummary(TERESINHA) } satisfies OfficeSelection];
      }
      if (selection?.type === "candidate") {
        return [office.id, { type: "candidate", candidate: sanitizeCandidateSummary(selection.candidate) }];
      }
      if (selection?.type === "special") {
        return [office.id, selection];
      }
      return [office.id, null];
    }),
  );
}

function CandidatePhoto({
  candidate,
  size = 58,
  className = "candidate-photo",
}: {
  candidate: CandidateSummary;
  size?: number;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [candidate.photoUrl]);

  if (candidate.photoUrl && !imageFailed) {
    return (
      <Image
        className={className}
        src={candidate.photoUrl}
        alt={`Foto de ${candidate.ballotName}`}
        width={size}
        height={size}
        sizes={`${size}px`}
        unoptimized={candidate.photoUrl.startsWith("http")}
        crossOrigin={candidate.photoUrl.startsWith("http") ? "anonymous" : undefined}
        onError={() => setImageFailed(true)}
      />
    );
  }
  return (
    <span className={`${className} candidate-initials`} role="img" aria-label={`Iniciais de ${candidate.ballotName}`}>
      {candidateInitials(candidate)}
    </span>
  );
}

function NumberBoxes({ number, digits }: { number?: string; digits: number }) {
  const values = Array.from({ length: digits }, (_, index) => number?.[index] ?? "");
  return (
    <span className="number-boxes" role="img" aria-label={number ? `Número ${number}` : "Sem candidato"}>
      {values.map((value, index) => (
        <span className={value ? "number-box filled" : "number-box"} key={index}>
          {value || "·"}
        </span>
      ))}
    </span>
  );
}

function PartyBadge({ acronym }: { acronym: string | null | undefined }) {
  if (!acronym) return null;
  const logoUrl = partyLogoUrl(acronym);
  const fallback = partyBadgeFallback(acronym);
  return (
    <div className="party-badge">
      {logoUrl ? (
        <span className="party-badge-logo">
          <Image src={logoUrl} alt="" width={44} height={44} unoptimized />
        </span>
      ) : (
        <span className="party-badge-mark" style={{ background: fallback.background, color: fallback.color }}>
          {acronym}
        </span>
      )}
      <span className="party-badge-label">{acronym}</span>
    </div>
  );
}

function BallotPreviewCandidateRow({
  office,
  candidate,
  officeLabel,
  onSwap,
}: {
  office: Office;
  candidate: CandidateSummary;
  officeLabel: string;
  onSwap?: () => void;
}) {
  const [ticketMate, setTicketMate] = useState<CandidateSummary | null>(null);
  const showsTicketMate = hasTicketMate(candidate.officeCode);

  useEffect(() => {
    if (!showsTicketMate) {
      setTicketMate(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      ticketMate: "1",
      headOffice: String(candidate.officeCode),
      ballot: candidate.ballotNumber,
      uf: candidate.uf,
      year: "2026",
    });

    void fetch(`/api/candidates?${params}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setTicketMate(data.ticketMate ? sanitizeCandidateSummary(data.ticketMate as CandidateSummary) : null);
      })
      .catch(() => setTicketMate(null));

    return () => controller.abort();
  }, [candidate.ballotNumber, candidate.officeCode, candidate.uf, showsTicketMate]);

  return (
    <div className={`ballot-row ballot-row-filled${ticketMate ? " has-ticket-mate" : ""}`}>
      <div className="ballot-row-photo-stack">
        {ticketMate && (
          <div className="ballot-ticket-mate-wrap" aria-hidden="true">
            <CandidatePhoto candidate={ticketMate} className="candidate-photo ballot-ticket-mate-photo" size={56} />
          </div>
        )}
        <CandidatePhoto candidate={candidate} className="candidate-photo ballot-head-photo" size={68} />
      </div>
      <div className="ballot-row-main">
        <span className="ballot-row-office">{officeLabel}</span>
        <NumberBoxes number={candidate.ballotNumber} digits={office.digits} />
        <strong className="ballot-row-name">{candidate.ballotName}</strong>
      </div>
      <div className="ballot-row-side">
        {onSwap && (
          <button className="ballot-row-swap" type="button" onClick={onSwap} aria-label={`Trocar ${office.label}`}>
            <ArrowLeftRight size={15} strokeWidth={2.2} />
          </button>
        )}
        <PartyBadge acronym={candidate.partyAcronym} />
      </div>
    </div>
  );
}

function BallotPreviewRow({
  office,
  selection,
  onSwap,
}: {
  office: Office;
  selection: OfficeSelection;
  onSwap?: () => void;
}) {
  const officeLabel = previewOfficeLabel(office.id, office.label);

  if (!selection) {
    return (
      <div className="ballot-row ballot-row-empty ballot-row-pending">
        <div className="ballot-row-main">
          <span className="ballot-row-office">{officeLabel}</span>
          <span className="ballot-pending-mark">—</span>
        </div>
      </div>
    );
  }

  if (selection.type === "special") {
    return (
      <div className="ballot-row ballot-row-empty ballot-row-filled">
        <div className="ballot-row-main">
          <span className="ballot-row-office">{officeLabel}</span>
          {selection.vote === "branco" ? (
            <span className="ballot-blank-pill">BRANCO</span>
          ) : (
            <>
              <NumberBoxes number={nullBallotNumber(office.digits)} digits={office.digits} />
              <strong className="ballot-row-name ballot-row-special">NULO</strong>
            </>
          )}
        </div>
        {onSwap && (
          <button className="ballot-row-swap ballot-row-swap-special" type="button" onClick={onSwap} aria-label={`Trocar ${office.label}`}>
            <ArrowLeftRight size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>
    );
  }

  return (
    <BallotPreviewCandidateRow
      office={office}
      candidate={selection.candidate}
      officeLabel={officeLabel}
      onSwap={office.fixed ? undefined : onSwap}
    />
  );
}

function SpecialVoteCard({
  office,
  vote,
  onSwap,
  isActive,
}: {
  office: Office;
  vote: SpecialVoteKind;
  onSwap: () => void;
  isActive?: boolean;
}) {
  return (
    <article className={`office-card selected special-vote special-vote-${vote}${isActive ? " is-picking" : ""}`}>
      <span className="empty-photo special-vote-photo" aria-hidden="true" />
      <div className="office-card-copy">
        <div className="office-card-heading">
          <span>{office.label}</span>
        </div>
        <strong>{vote === "branco" ? "Voto em branco" : "Voto nulo"}</strong>
        <small>
          {vote === "branco"
            ? "Aperte BRANCO na urna. Não escolhe ninguém para o cargo."
            : "Digite um número inexistente na urna. Anula o voto naquele cargo."}
        </small>
      </div>
      <div className="selected-number">
        <button className="swap-button" type="button" onClick={(event) => { event.stopPropagation(); onSwap(); }} aria-label={`Trocar ${office.label}`}>
          <ArrowLeftRight size={16} strokeWidth={2.2} />
        </button>
        {vote === "branco" ? (
          <span className="ballot-blank-pill ballot-blank-pill-compact">BRANCO</span>
        ) : (
          <NumberBoxes number={nullBallotNumber(office.digits)} digits={office.digits} />
        )}
      </div>
    </article>
  );
}

function SelectedOfficeCard({
  office,
  candidate,
  onInspect,
  onSwap,
  isActive,
}: {
  office: Office;
  candidate: CandidateSummary;
  onInspect?: (candidate: CandidateSummary) => void;
  onSwap?: () => void;
  isActive?: boolean;
}) {
  const [ticketMate, setTicketMate] = useState<CandidateSummary | null>(null);
  const showsTicketMate = hasTicketMate(candidate.officeCode);

  useEffect(() => {
    if (!showsTicketMate) {
      setTicketMate(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      ticketMate: "1",
      headOffice: String(candidate.officeCode),
      ballot: candidate.ballotNumber,
      uf: candidate.uf,
      year: "2026",
    });

    void fetch(`/api/candidates?${params}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setTicketMate(data.ticketMate ? sanitizeCandidateSummary(data.ticketMate as CandidateSummary) : null);
      })
      .catch(() => setTicketMate(null));

    return () => controller.abort();
  }, [candidate.ballotNumber, candidate.officeCode, candidate.uf, showsTicketMate]);

  return (
    <article className={`office-card selected${office.fixed ? " fixed" : ""}${isActive ? " is-picking" : ""}${ticketMate ? " has-ticket-mate" : ""}`}>
      <button
        type="button"
        className="office-card-body"
        onClick={() => onInspect?.(candidate)}
        aria-label={`Ver informações de ${candidate.ballotName}`}
      >
        <div className="office-card-photo-stack">
          {ticketMate && (
            <div className="ticket-mate-photo-wrap" aria-hidden="true">
              <CandidatePhoto candidate={ticketMate} className="candidate-photo ticket-mate-photo" size={52} />
              <span className="ticket-mate-tag">{ticketMateRoleLabel(candidate.officeCode)}</span>
            </div>
          )}
          <CandidatePhoto candidate={candidate} className="candidate-photo ticket-head-photo" />
        </div>
        <div className="office-card-copy">
          <div className="office-card-heading">
            <span>{office.label}</span>
            {office.fixed && (
              <span className="fixed-label"><LockKeyhole size={12} /> fixo</span>
            )}
          </div>
          <strong>{candidate.ballotName}</strong>
          <small>{[candidate.partyAcronym, candidate.status].filter(Boolean).join(" · ")}</small>
        </div>
      </button>
      <div className="selected-number">
        {!office.fixed && onSwap && (
          <button className="swap-button" type="button" onClick={(event) => { event.stopPropagation(); onSwap(); }} aria-label={`Trocar ${office.label}`}>
            <ArrowLeftRight size={16} strokeWidth={2.2} />
          </button>
        )}
        <NumberBoxes number={candidate.ballotNumber} digits={office.digits} />
      </div>
    </article>
  );
}

function EmptyOfficeSlot({
  office,
  onOpen,
  isActive,
}: {
  office: Office;
  onOpen: () => void;
  isActive?: boolean;
}) {
  return (
    <article className={`office-card empty-slot${isActive ? " is-picking" : ""}`}>
      <button type="button" className="empty-slot-button" onClick={onOpen}>
        <span className="empty-photo" aria-hidden="true"><Search size={20} /></span>
        <span className="office-card-copy">
          <span className="office-card-heading">{office.label}</span>
          <strong>Escolher candidato</strong>
          <small>Busque, filtre por partido ou escolha branco/nulo</small>
        </span>
        <span className="selected-number">
          <NumberBoxes digits={office.digits} />
        </span>
      </button>
    </article>
  );
}

function CandidatePicker({
  office,
  selected,
  isActive,
  onOpen,
  onInspect,
}: {
  office: Office;
  selected: OfficeSelection;
  isActive: boolean;
  onOpen: () => void;
  onInspect: (candidate: CandidateSummary) => void;
}) {
  if (selected?.type === "candidate") {
    return (
      <SelectedOfficeCard
        office={office}
        candidate={selected.candidate}
        onInspect={onInspect}
        onSwap={office.fixed ? undefined : onOpen}
        isActive={isActive}
      />
    );
  }

  if (selected?.type === "special") {
    return (
      <SpecialVoteCard
        office={office}
        vote={selected.vote}
        onSwap={onOpen}
        isActive={isActive}
      />
    );
  }

  return (
    <EmptyOfficeSlot office={office} onOpen={onOpen} isActive={isActive} />
  );
}

function ProfileDrawer({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const age = candidate.birthDate
    ? new Date(2026, 9, 4).getFullYear() - new Date(candidate.birthDate).getFullYear()
    : null;
  const socials = normalizeSocialLinks(candidate.socials);
  const tseHref = candidate.tseUrl
    || (candidate.sqCandidate
      ? tseCandidateUrl(candidate.uf === "BRASIL" ? "BR" : candidate.uf, candidate.sqCandidate)
      : null);

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="profile-drawer" role="dialog" aria-modal="true" aria-label={`Informações de ${candidate.ballotName}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="drawer-close" type="button" onClick={onClose} aria-label="Fechar informações">
          <X size={21} />
        </button>
        <div className="profile-kicker">{candidate.officeName} · {candidate.uf} · Eleição 2026</div>
        <div className="profile-head">
          <CandidatePhoto candidate={candidate} size={92} />
          <div>
            <h2>{candidate.ballotName}</h2>
            <p>{candidate.fullName}{age ? ` · ${age} anos` : ""}</p>
            <span className="party-pill">{candidate.partyAcronym ?? "Partido não informado"}</span>
          </div>
        </div>
        <div className="profile-number"><NumberBoxes number={candidate.ballotNumber} digits={candidate.ballotNumber.length} /></div>

        <section className="profile-section">
          <h3>Candidatura</h3>
          <div className="facts-grid">
            <div><span>Situação</span><strong>{candidate.status ?? "Não informada"}</strong></div>
            <div><span>Ocupação</span><strong>{candidate.occupation ?? "Não informada"}</strong></div>
            <div><span>Escolaridade</span><strong>{candidate.education ?? "Não informada"}</strong></div>
            <div><span>Fonte</span><strong>{candidate.source}</strong></div>
          </div>
        </section>

        {socials.length > 0 && (
          <section className="profile-section">
            <h3>Redes e site</h3>
            <p className="source-note">Links declarados à Justiça Eleitoral.</p>
            <div className="social-links">
              {socials.map((social) => (
                <a href={social.url} target="_blank" rel="noopener noreferrer" key={social.url}>
                  <SocialNetworkIcon platform={social.platform} /> {social.label} <ExternalLink size={13} />
                </a>
              ))}
            </div>
          </section>
        )}

        {tseHref && (
          <a className="tse-link" href={tseHref} target="_blank" rel="noopener noreferrer">
            Ver candidato no site do TSE <ExternalLink size={15} />
          </a>
        )}
      </aside>
    </div>
  );
}

export function BallotBuilder() {
  const [selections, setSelections] = useState<Selections>(initialSelections);
  const [hydrated, setHydrated] = useState(false);
  const [muted, setMuted] = useState(false);
  const [profile, setProfile] = useState<Candidate | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [working, setWorking] = useState<"save" | "share" | "whatsapp" | null>(null);
  const [notice, setNotice] = useState("");
  const [pickerOfficeId, setPickerOfficeId] = useState<string | null>(null);
  const [mobilePicker, setMobilePicker] = useState(false);
  const ballotRef = useRef<HTMLDivElement>(null);
  const refreshedSavedSelections = useRef(false);
  const urnaSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const sync = () => setMobilePicker(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
        selections?: Selections;
        muted?: boolean;
      };
      if (saved.selections) {
        setSelections(sanitizeSelections({
          ...initialSelections(),
          ...normalizeSelections(saved.selections as Record<string, unknown>),
        }));
      }
      setMuted(Boolean(saved.muted));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || refreshedSavedSelections.current) return;
    refreshedSavedSelections.current = true;

    const refreshableOffices = OFFICES.filter((office) => selectionCandidate(selections[office.id]));
    if (!refreshableOffices.length) return;

    let cancelled = false;
    void Promise.all(
      refreshableOffices.map(async (office) => {
        const savedCandidate = selectionCandidate(selections[office.id]);
        if (!savedCandidate) return null;

        try {
          const lookupId = office.fixed || savedCandidate.id === TERESINHA.id
            ? TERESINHA.id
            : savedCandidate.id;
          const response = await fetch(`/api/candidates?id=${encodeURIComponent(lookupId)}`, {
            cache: "no-store",
          });
          const data = await response.json();
          if (!response.ok || !data.candidate) return null;

          return {
            officeId: office.id,
            savedCandidateId: savedCandidate.id,
            allowReplace: Boolean(office.fixed),
            candidate: sanitizeCandidateSummary(data.candidate as CandidateSummary),
          };
        } catch {
          return null;
        }
      }),
    ).then((updates) => {
      if (cancelled) return;

      setSelections((current) => {
        let changed = false;
        const next = { ...current };

        for (const update of updates) {
          if (!update) continue;
          if (!update.allowReplace && selectionCandidate(current[update.officeId])?.id !== update.savedCandidateId) continue;
          next[update.officeId] = { type: "candidate", candidate: update.candidate };
          changed = true;
        }

        return changed ? next : current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated, selections]);

  useEffect(() => {
    const audio = new Audio("/sounds/urna-confirma.wav");
    audio.preload = "auto";
    urnaSoundRef.current = audio;
    return () => {
      audio.pause();
      urnaSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ selections, muted }));
  }, [hydrated, muted, selections]);

  const duplicateSenator = useMemo(() => {
    const first = selections.senador1;
    const second = selections.senador2;
    if (first?.type !== "candidate" || second?.type !== "candidate") return false;
    return first.candidate.ballotNumber === second.candidate.ballotNumber;
  }, [selections]);

  function playUrnaSound() {
    const audio = urnaSoundRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }

  function playConfirmation() {
    if (muted) return;
    playUrnaSound();
  }

  function selectCandidate(office: Office, candidate: CandidateSummary) {
    const cleanCandidate = sanitizeCandidateSummary(candidate);
    setSelections((current) => ({
      ...current,
      [office.id]: { type: "candidate", candidate: cleanCandidate },
    }));
    setPickerOfficeId(null);
    setNotice(`${candidate.ballotName} foi adicionado à sua colinha.`);
    playConfirmation();
  }

  function selectSpecialVote(office: Office, vote: SpecialVoteKind) {
    setSelections((current) => ({ ...current, [office.id]: { type: "special", vote } }));
    setPickerOfficeId(null);
    setNotice(selectionNotice({ type: "special", vote }));
    playConfirmation();
  }

  function openPicker(officeId: string) {
    setPickerOfficeId(officeId);
  }

  function clearOffice(officeId: string) {
    const office = OFFICES.find((item) => item.id === officeId);
    if (!office || office.fixed) return;
    setSelections((current) => ({ ...current, [officeId]: null }));
    setPickerOfficeId(null);
    setNotice("Escolha removida da colinha.");
  }

  function clearBallot() {
    setSelections(initialSelections());
    setPickerOfficeId(null);
    setNotice("Colinha esvaziada. Deputada Federal mantida.");
  }

  const hasClearableSelections = useMemo(
    () => OFFICES.some((office) => !office.fixed && selections[office.id] !== null),
    [selections],
  );

  const pickerOffice = OFFICES.find((office) => office.id === pickerOfficeId) ?? null;
  const showInlinePicker = Boolean(pickerOffice && !mobilePicker);
  const showModalPicker = Boolean(pickerOffice && mobilePicker);

  async function inspectCandidate(candidate: CandidateSummary) {
    setProfileLoading(true);
    try {
      const lookupId = candidate.id === TERESINHA.id || candidate.sqCandidate === TERESINHA.sqCandidate
        ? TERESINHA.id
        : candidate.id;
      const response = await fetch(`/api/candidates?id=${encodeURIComponent(lookupId)}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setProfile(data.candidate);
    } finally {
      setProfileLoading(false);
    }
  }

  async function buildPdf() {
    if (!ballotRef.current) throw new Error("Colinha indisponível");
    const image = await toPng(ballotRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#0d0f14",
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const properties = pdf.getImageProperties(image);
    const pageWidth = 190;
    const height = (properties.height * pageWidth) / properties.width;
    pdf.addImage(image, "PNG", 10, 10, pageWidth, Math.min(height, 277));
    return pdf;
  }

  function fileName() {
    return `minha-colinha-2026-${new Date().toISOString().slice(0, 10)}.pdf`;
  }

  function buildBallotShareText() {
    const lines = OFFICES.map((office) => selectionShareLine(office.label, selections[office.id], office.digits));

    return [
      "Minha colinha 2026 — São Paulo",
      "",
      ...lines,
      "",
      "Confira número e foto antes de apertar CONFIRMA.",
      window.location.origin,
    ].join("\n");
  }

  function openWhatsAppShare(text: string) {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.location.href = url;
  }

  async function saveBallot() {
    setWorking("save");
    try {
      const pdf = await buildPdf();
      pdf.save(fileName());
      setNotice("Sua colinha foi salva em PDF.");
    } catch {
      setNotice("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setWorking(null);
    }
  }

  async function shareBallot() {
    setWorking("share");
    try {
      const pdf = await buildPdf();
      const file = new File([pdf.output("blob")], fileName(), { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Minha colinha 2026",
          text: buildBallotShareText(),
        });
        setNotice("Colinha compartilhada.");
      } else {
        pdf.save(fileName());
        setNotice("PDF salvo. Use WhatsApp para enviar a colinha em texto ou anexe o arquivo.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setNotice("Não foi possível compartilhar agora. Tente salvar o PDF.");
      }
    } finally {
      setWorking(null);
    }
  }

  function shareBallotOnWhatsApp() {
    setWorking("whatsapp");
    try {
      openWhatsAppShare(buildBallotShareText());
      setNotice("Abrindo WhatsApp…");
    } catch {
      setNotice("Não foi possível abrir o WhatsApp agora.");
    } finally {
      window.setTimeout(() => setWorking(null), 400);
    }
  }

  return (
    <main>
      <header className="hero">
        <nav className="hero-nav">
          <div className="brand" aria-label="Colinha 2026">
            <span className="brand-mark"><Check size={19} strokeWidth={3} /></span>
            <span>colinha<span>.2026</span></span>
          </div>
          <button
            className="sound-toggle"
            type="button"
            onClick={() => {
              if (muted) playUrnaSound();
              setMuted((value) => !value);
            }}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            {muted ? "Som desligado" : "Som ligado"}
          </button>
        </nav>
        <div className="hero-content">
          <p className="eyebrow">Eleição 2026 · São Paulo</p>
          <h1>Sua escolha, na<br />ordem certa.</h1>
          <p className="hero-lead">
            Busque seus candidatos, confira os dados e leve sua colinha com você no dia da votação.
          </p>
          <div className="trust-row">
            <span><Check size={15} /> Dados do TSE</span>
            <span><Check size={15} /> Salvo no seu aparelho</span>
          </div>
        </div>
      </header>

      <div className="app-shell">
        <section className="builder-panel" aria-labelledby="builder-title">
          <div className="section-heading">
            <div>
              <span className="step">01</span>
              <h2 id="builder-title">Monte sua colinha</h2>
            </div>
            <p>Busque pelo nome ou número do candidato.</p>
          </div>

          <div className="office-list">
            {OFFICES.map((office) => (
              <CandidatePicker
                office={office}
                key={office.id}
                selected={selections[office.id]}
                isActive={pickerOfficeId === office.id}
                onOpen={() => openPicker(office.id)}
                onInspect={inspectCandidate}
              />
            ))}
          </div>

          {duplicateSenator && (
            <div className="warning" role="alert">
              <Info size={18} />
              <span><strong>Atenção:</strong> os dois votos para senador precisam ser diferentes. Se repetir o número, o segundo voto será anulado.</span>
            </div>
          )}
          {profileLoading && <p className="loading-profile">Carregando informações do candidato…</p>}
          <p className="notice builder-notice" aria-live="polite">{notice}</p>
        </section>

        <aside className={`preview-panel${showInlinePicker ? " is-picking" : ""}`}>
          {showInlinePicker && pickerOffice ? (
            <CandidatePickerPanel
              office={pickerOffice}
              presentation="inline"
              currentSelection={selections[pickerOffice.id]}
              onClose={() => setPickerOfficeId(null)}
              onSelect={(candidate) => selectCandidate(pickerOffice, candidate)}
              onSelectSpecial={(vote) => selectSpecialVote(pickerOffice, vote)}
              onClearCurrent={() => clearOffice(pickerOffice.id)}
            />
          ) : (
            <>
              <div className="section-heading preview-heading">
                <div><span className="step">02</span><h2>Sua colinha</h2></div>
                <p>Atualiza conforme você escolhe.</p>
              </div>
              <div className="ballot-frame">
                <div className="ballot-paper ballot-sheet" ref={ballotRef} id="ballot-card">
                  <p className="ballot-sheet-meta">São Paulo · SP</p>
                  <div className="ballot-sheet-rows">
                    {OFFICES.map((office) => (
                      <BallotPreviewRow
                        key={office.id}
                        office={office}
                        selection={selections[office.id]}
                        onSwap={office.fixed ? undefined : () => openPicker(office.id)}
                      />
                    ))}
                  </div>
                  {duplicateSenator && (
                    <p className="paper-warning">Atenção: escolha números diferentes para as duas vagas de senador.</p>
                  )}
                  <p className="ballot-sheet-footer">
                    Monte a sua em <strong>colinha.2026</strong>
                  </p>
                </div>
              </div>

              <div className="action-buttons">
                <button className="save-button" type="button" onClick={saveBallot} disabled={working !== null}>
                  {working === "save" ? <span className="button-spinner" /> : <Check size={19} />}
                  Salvar colinha
                </button>
                <button className="share-button" type="button" onClick={shareBallot} disabled={working !== null}>
                  {working === "share" ? <span className="button-spinner" /> : "Compartilhar"}
                </button>
                <button className="whatsapp-button" type="button" onClick={shareBallotOnWhatsApp} disabled={working !== null}>
                  {working === "whatsapp" ? <span className="button-spinner" /> : "WhatsApp"}
                </button>
              </div>
              <button
                className="clear-ballot-button"
                type="button"
                onClick={clearBallot}
                disabled={!hasClearableSelections}
              >
                Esvaziar colinha
              </button>
              <p className="privacy-note"><LockKeyhole size={14} /> Suas escolhas ficam somente neste aparelho.</p>
            </>
          )}
        </aside>
      </div>

      <footer className="site-footer">
        <div className="footer-brand">colinha<span>.2026</span></div>
        <p>Ferramenta de campanha. Antes de votar, confirme a situação e os dados oficiais da candidatura no TSE.</p>
      </footer>

      {profile && <ProfileDrawer candidate={profile} onClose={() => setProfile(null)} />}
      {showModalPicker && pickerOffice && (
        <CandidatePickerPanel
          office={pickerOffice}
          presentation="modal"
          currentSelection={selections[pickerOffice.id]}
          onClose={() => setPickerOfficeId(null)}
          onSelect={(candidate) => selectCandidate(pickerOffice, candidate)}
          onSelectSpecial={(vote) => selectSpecialVote(pickerOffice, vote)}
          onClearCurrent={() => clearOffice(pickerOffice.id)}
        />
      )}
    </main>
  );
}
