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
  Moon,
  Printer,
  Save,
  Search,
  Share,
  Sun,
  Users,
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
import { partyStyleForAcronym, previewOfficeLabel } from "@/lib/party-styles";
import { fetchTicketChapaForCandidate } from "@/lib/ticket-mate-fetch";
import { isTicketChapaMember, slateMemberRoleLabel, slateMateRoleLabel, ticketHeadOfficeCodeFor } from "@/lib/ticket-mates";
import { normalizeSocialLinks } from "@/lib/social-links";
import { tseCandidateUrl } from "@/lib/tse-urls";
import type { Candidate, CandidateSummary } from "@/lib/types";
import { CandidatePickerPanel } from "@/components/candidate-picker-panel";
import { SocialNetworkIcon } from "@/components/social-network-icon";
import { useTicketSlates } from "@/hooks/use-ticket-mates";

const STORAGE_KEY = "colinha-digital-2026-v1";
const PREVIEW_THEME_KEY = "colinha-preview-theme-v1";
const PREVIEW_VICE_KEY = "colinha-preview-vice-v1";
const BALLOT_META_LABEL = "Eleições 2026 - São Paulo - SP";
const PREVIEW_VICE_OFFICE_CODES = new Set([1, 3]);
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

function PartyBadge({ acronym, variant = "live" }: { acronym: string | null | undefined; variant?: "live" | "share" }) {
  if (!acronym) return null;
  const logoUrl = partyLogoUrl(acronym);
  const fallback = partyBadgeFallback(acronym);
  return (
    <div className={`party-badge${variant === "share" ? " party-badge-share" : ""}`}>
      {logoUrl ? (
        <span className="party-badge-logo">
          <Image src={logoUrl} alt="" width={52} height={52} unoptimized />
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

function previewViceCandidate(office: Office, slate?: CandidateSummary[]) {
  if (!PREVIEW_VICE_OFFICE_CODES.has(office.code) || !slate?.length) return null;
  return slate[0];
}

function fixedSlotRowProps(partyAcronym: string | null | undefined) {
  const style = partyStyleForAcronym(partyAcronym);
  return {
    className: " is-fixed-slot",
    style: {
      ["--fixed-accent" as string]: style.background,
      ["--fixed-accent-fg" as string]: style.color,
    } as React.CSSProperties,
  };
}

function BallotPreviewRow({
  office,
  selection,
  showViceOnBallot,
  slate,
}: {
  office: Office;
  selection: OfficeSelection;
  showViceOnBallot: boolean;
  slate?: CandidateSummary[];
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
      <div className="ballot-row ballot-row-empty">
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
      </div>
    );
  }

  const candidate = selection.candidate;
  const vice = showViceOnBallot ? previewViceCandidate(office, slate) : null;
  const fixedProps = office.fixed ? fixedSlotRowProps(candidate.partyAcronym) : null;
  return (
    <div className={`ballot-row${fixedProps?.className ?? ""}`} style={fixedProps?.style}>
      <div className={`ballot-row-photo${vice ? " is-duo" : ""}`}>
        <div className="ballot-row-photo-main">
          <CandidatePhoto candidate={candidate} size={68} />
        </div>
        {vice ? (
          <CandidatePhoto candidate={vice} className="candidate-photo ballot-vice-photo" size={52} />
        ) : null}
      </div>
      <div className="ballot-row-main">
        <div className="ballot-row-heading">
          <span className="ballot-row-office">{officeLabel}</span>
        </div>
        <NumberBoxes number={candidate.ballotNumber} digits={office.digits} />
        <div className="ballot-row-names">
          <strong className="ballot-row-name">{candidate.ballotName}</strong>
          {vice ? (
            <>
              <span className="ballot-row-names-divider" aria-hidden="true" />
              <span className="ballot-row-vice-name">{vice.ballotName}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="ballot-row-party">
        <PartyBadge acronym={candidate.partyAcronym} variant="live" />
      </div>
    </div>
  );
}

function fanCardStyle(rank: number, total: number): React.CSSProperties {
  return {
    ["--fan-i" as string]: rank - (total - 1) / 2,
    ["--fan-r" as string]: rank,
    zIndex: total - rank,
  };
}

function OfficeCardFace({
  office,
  candidate,
  headingLabel,
  ballotNumber,
  fixed,
  onInspect,
  onSwap,
  interactive = true,
}: {
  office: Office;
  candidate: CandidateSummary;
  headingLabel: string;
  ballotNumber: string;
  fixed?: boolean;
  onInspect?: (candidate: CandidateSummary) => void;
  onSwap?: () => void;
  interactive?: boolean;
}) {
  const body = (
    <>
      <CandidatePhoto candidate={candidate} />
      <div className="office-card-copy">
        <div className="office-card-heading">
          <span>{headingLabel}</span>
          {fixed && (
            <span className="fixed-label"><LockKeyhole size={12} /> fixo</span>
          )}
        </div>
        <strong>{candidate.ballotName}</strong>
        <small>{[candidate.partyAcronym, candidate.status].filter(Boolean).join(" · ")}</small>
      </div>
    </>
  );

  return (
    <>
      {interactive && onInspect ? (
        <button
          type="button"
          className="office-card-body"
          onClick={() => onInspect(candidate)}
          aria-label={`Ver informações de ${candidate.ballotName}`}
        >
          {body}
        </button>
      ) : (
        <div className="office-card-body office-card-body-static" aria-hidden={!interactive ? true : undefined}>
          {body}
        </div>
      )}
      <div className={`selected-number${!fixed && onSwap ? " has-swap-action" : ""}`}>
        {!fixed && onSwap && (
          <button
            className="swap-button swap-button-rail"
            type="button"
            onClick={(event) => { event.stopPropagation(); onSwap(); }}
            aria-label={`Trocar ${office.label}`}
          >
            <ArrowLeftRight size={16} strokeWidth={2.2} />
          </button>
        )}
        <NumberBoxes number={ballotNumber} digits={office.digits} />
      </div>
    </>
  );
}

function WhatsAppIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
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
      <div className="selected-number has-swap-action">
        <button className="swap-button swap-button-rail" type="button" onClick={(event) => { event.stopPropagation(); onSwap(); }} aria-label={`Trocar ${office.label}`}>
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
  slate,
  onInspect,
  onSwap,
  isActive,
}: {
  office: Office;
  candidate: CandidateSummary;
  slate?: CandidateSummary[];
  onInspect?: (candidate: CandidateSummary) => void;
  onSwap?: () => void;
  isActive?: boolean;
}) {
  const members = slate ?? [];
  const totalCards = members.length + 1;
  const roster = useMemo(
    () => [
      { person: candidate, label: office.label },
      ...members.map((member) => ({
        person: member,
        label: slateMateRoleLabel(candidate.officeCode, member.officeCode),
      })),
    ],
    [candidate, members, office.label],
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [candidate.id, members.map((member) => member.id).join(",")]);

  const cardClass = (extra = "") =>
    `office-card selected${office.fixed ? " fixed" : ""}${isActive ? " is-picking" : ""}${extra}`;

  function focusPerson(index: number) {
    setActiveIndex(index);
    onInspect?.(roster[index].person);
  }

  if (!members.length) {
    return (
      <article className={cardClass()}>
        <OfficeCardFace
          office={office}
          candidate={candidate}
          headingLabel={office.label}
          ballotNumber={candidate.ballotNumber}
          fixed={office.fixed}
          onInspect={onInspect}
          onSwap={office.fixed ? undefined : onSwap}
        />
      </article>
    );
  }

  const orderedIndices = [
    activeIndex,
    ...roster.map((_, index) => index).filter((index) => index !== activeIndex),
  ];

  return (
    <div className={`office-card-fan office-card-fan--deck${isActive ? " is-picking" : ""}`}>
      {orderedIndices.map((personIndex, rank) => {
        const entry = roster[personIndex];
        const isFront = rank === 0;

        return (
          <article
            key={entry.person.id}
            className={`${cardClass(" office-card-fan__card")}${isFront && onSwap ? " has-swap" : ""}${!isFront ? " office-card-fan__mate" : ""}`}
            data-rank={rank}
            style={fanCardStyle(rank, totalCards)}
          >
            <OfficeCardFace
              office={office}
              candidate={entry.person}
              headingLabel={entry.label}
              ballotNumber={candidate.ballotNumber}
              fixed={office.fixed}
              onInspect={isFront ? onInspect : undefined}
              onSwap={isFront && !office.fixed ? onSwap : undefined}
            />
            {!isFront && (
              <button
                type="button"
                className="office-card-fan__pick"
                onClick={(event) => {
                  event.stopPropagation();
                  focusPerson(personIndex);
                }}
                aria-label={`Ver ${entry.label} de ${candidate.ballotName}`}
              />
            )}
          </article>
        );
      })}
    </div>
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
      <button
        type="button"
        className="empty-slot-button"
        onClick={onOpen}
        aria-label={`Escolher candidato para ${office.label}`}
      >
        <span className="empty-photo" aria-hidden="true"><Search size={20} /></span>
        <span className="office-card-copy">
          <span className="office-card-heading">{office.label}</span>
          <strong className="empty-slot-cta">Escolher candidato</strong>
          <small className="empty-slot-hint">
            Busque, filtre por partido ou escolha branco/nulo
          </small>
        </span>
        <span className="selected-number empty-slot-numbers">
          <NumberBoxes digits={office.digits} />
        </span>
      </button>
    </article>
  );
}

function CandidatePicker({
  office,
  selected,
  slate,
  isActive,
  onOpen,
  onInspect,
}: {
  office: Office;
  selected: OfficeSelection;
  slate?: CandidateSummary[];
  isActive: boolean;
  onOpen: () => void;
  onInspect: (candidate: CandidateSummary) => void;
}) {
  if (selected?.type === "candidate") {
    return (
      <SelectedOfficeCard
        office={office}
        candidate={selected.candidate}
        slate={slate}
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

function ProfileContent({
  candidate,
  onInspectMate,
}: {
  candidate: Candidate;
  onInspectMate?: (candidate: CandidateSummary) => void;
}) {
  const [ticketSlate, setTicketSlate] = useState<CandidateSummary[]>([]);
  const age = candidate.birthDate
    ? new Date(2026, 9, 4).getFullYear() - new Date(candidate.birthDate).getFullYear()
    : null;
  const socials = normalizeSocialLinks(candidate.socials ?? []);
  const tseHref = candidate.tseUrl
    || (candidate.sqCandidate
      ? tseCandidateUrl(candidate.uf === "BRASIL" ? "BR" : candidate.uf, candidate.sqCandidate)
      : null);

  useEffect(() => {
    if (!isTicketChapaMember(candidate.officeCode)) {
      setTicketSlate([]);
      return;
    }

    const controller = new AbortController();
    void fetchTicketChapaForCandidate(candidate, controller.signal)
      .then(setTicketSlate)
      .catch(() => {
        if (!controller.signal.aborted) setTicketSlate([]);
      });

    return () => controller.abort();
  }, [candidate.id, candidate.officeCode, candidate.ballotNumber, candidate.uf]);

  const ticketHeadOfficeCode = ticketHeadOfficeCodeFor(candidate.officeCode);

  return (
    <>
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
        {ticketSlate.length > 0 && ticketHeadOfficeCode !== null && (
          <div className="profile-slate-block">
            <h4>Chapa</h4>
            <ul className="profile-slate-list">
              {ticketSlate.map((mate) => (
                <li key={mate.id}>
                  <button
                    type="button"
                    className="profile-slate-card"
                    onClick={() => onInspectMate?.(mate)}
                    aria-label={`Ver informações de ${mate.ballotName}`}
                  >
                    <CandidatePhoto candidate={mate} size={52} />
                    <div className="profile-slate-copy">
                      <span>{slateMemberRoleLabel(ticketHeadOfficeCode, mate.officeCode)}</span>
                      <strong>{mate.ballotName}</strong>
                    </div>
                    <span className="profile-slate-action">Ver info</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
    </>
  );
}

function CandidateProfile({
  candidate,
  presentation,
  onClose,
  onInspectMate,
}: {
  candidate: Candidate;
  presentation: "inline" | "modal";
  onClose: () => void;
  onInspectMate?: (candidate: CandidateSummary) => void;
}) {
  if (presentation === "modal") {
    return (
      <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
        <aside
          className="profile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={`Informações de ${candidate.ballotName}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button className="drawer-close" type="button" onClick={onClose} aria-label="Fechar informações">
            <X size={21} />
          </button>
          <ProfileContent candidate={candidate} onInspectMate={onInspectMate} />
        </aside>
      </div>
    );
  }

  return (
    <section
      className="profile-panel profile-panel-inline"
      role="region"
      aria-label={`Informações de ${candidate.ballotName}`}
    >
      <button className="profile-panel-close" type="button" onClick={onClose} aria-label="Fechar informações">
        <X size={20} />
      </button>
      <ProfileContent candidate={candidate} onInspectMate={onInspectMate} />
    </section>
  );
}

export function BallotBuilder() {
  const [selections, setSelections] = useState<Selections>(initialSelections);
  const [hydrated, setHydrated] = useState(false);
  const [muted, setMuted] = useState(false);
  const [profile, setProfile] = useState<Candidate | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [showViceOnBallot, setShowViceOnBallot] = useState(false);
  const [working, setWorking] = useState<"save" | "share" | "whatsapp" | "print" | null>(null);
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
        previewTheme?: "light" | "dark";
      };
      if (saved.selections) {
        setSelections(sanitizeSelections({
          ...initialSelections(),
          ...normalizeSelections(saved.selections as Record<string, unknown>),
        }));
      }
      setMuted(Boolean(saved.muted));
      const storedTheme = localStorage.getItem(PREVIEW_THEME_KEY);
      if (storedTheme === "light" || storedTheme === "dark") {
        setPreviewTheme(storedTheme);
      } else if (saved.previewTheme === "light" || saved.previewTheme === "dark") {
        setPreviewTheme(saved.previewTheme);
      }
      const storedVice = localStorage.getItem(PREVIEW_VICE_KEY);
      if (storedVice === "1") setShowViceOnBallot(true);
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
    localStorage.setItem(PREVIEW_THEME_KEY, previewTheme);
    localStorage.setItem(PREVIEW_VICE_KEY, showViceOnBallot ? "1" : "0");
  }, [hydrated, muted, previewTheme, showViceOnBallot, selections]);

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
    setProfile(null);
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
  const ticketSlates = useTicketSlates(selections);

  const pickerOffice = OFFICES.find((office) => office.id === pickerOfficeId) ?? null;
  const showInlinePicker = Boolean(pickerOffice && !mobilePicker);
  const showModalPicker = Boolean(pickerOffice && mobilePicker);
  const showInlineProfile = Boolean(profile && !mobilePicker && !showInlinePicker);

  useEffect(() => {
    if (!profile || !mobilePicker) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [profile, mobilePicker]);

  async function inspectCandidate(candidate: CandidateSummary) {
    setPickerOfficeId(null);
    setProfileLoading(true);
    try {
      const lookupId = candidate.id === TERESINHA.id || candidate.sqCandidate === TERESINHA.sqCandidate
        ? TERESINHA.id
        : candidate.id;
      const response = await fetch(`/api/candidates?id=${encodeURIComponent(lookupId)}`, { cache: "no-store" });
      const data = await response.json() as { candidate?: Candidate };
      if (response.ok && data.candidate) setProfile(data.candidate);
    } finally {
      setProfileLoading(false);
    }
  }

  async function captureBallotImage() {
    const captureNode = ballotRef.current;
    if (!captureNode) throw new Error("Colinha indisponível");
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return toPng(captureNode, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: previewTheme === "dark" ? "#0d0f14" : "#ffffff",
    });
  }

  function pngFileName() {
    return `minha-colinha-2026-${new Date().toISOString().slice(0, 10)}.png`;
  }

  function pdfFileName() {
    return `minha-colinha-2026-${new Date().toISOString().slice(0, 10)}.pdf`;
  }

  function downloadPng(dataUrl: string) {
    const link = document.createElement("a");
    link.download = pngFileName();
    link.href = dataUrl;
    link.click();
  }

  async function createPngFile(dataUrl: string) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], pngFileName(), { type: "image/png" });
  }

  async function buildPdfFromImage(image: string) {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const properties = pdf.getImageProperties(image);
    const pageWidth = 190;
    const height = (properties.height * pageWidth) / properties.width;
    pdf.addImage(image, "PNG", 10, 10, pageWidth, Math.min(height, 277));
    return pdf;
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

  async function createPdfFile() {
    const image = await captureBallotImage();
    const pdf = await buildPdfFromImage(image);
    return {
      pdf,
      file: new File([pdf.output("blob")], pdfFileName(), { type: "application/pdf" }),
    };
  }

  async function sharePngFile(shareText: string) {
    const dataUrl = await captureBallotImage();
    const file = await createPngFile(dataUrl);
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Minha colinha 2026",
        text: shareText,
      });
      return "shared" as const;
    }
    downloadPng(dataUrl);
    return "saved" as const;
  }

  function openWhatsAppShare(text: string) {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.location.href = url;
  }

  async function saveBallot() {
    setWorking("save");
    try {
      const dataUrl = await captureBallotImage();
      downloadPng(dataUrl);
      setNotice("Sua colinha foi salva em PNG.");
    } catch {
      setNotice("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setWorking(null);
    }
  }

  async function shareBallot() {
    setWorking("share");
    try {
      const result = await sharePngFile(buildBallotShareText());
      setNotice(result === "shared" ? "Colinha compartilhada." : "PNG salvo. Anexe o arquivo para enviar.");
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setNotice("Não foi possível compartilhar agora. Tente salvar o PNG.");
      }
    } finally {
      setWorking(null);
    }
  }

  async function shareBallotOnWhatsApp() {
    setWorking("whatsapp");
    try {
      const result = await sharePngFile("Minha colinha 2026 — São Paulo");
      if (result === "shared") {
        setNotice("Escolha WhatsApp para enviar a imagem.");
      } else {
        setNotice("PNG salvo. Abra o WhatsApp e anexe a imagem baixada.");
        openWhatsAppShare("Minha colinha 2026 — anexe a imagem que acabei de salvar.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setNotice("Não foi possível compartilhar a imagem agora. Tente salvar a colinha.");
      }
    } finally {
      setWorking(null);
    }
  }

  async function printBallot() {
    setWorking("print");
    try {
      const { pdf } = await createPdfFile();
      pdf.autoPrint();
      const printWindow = window.open(pdf.output("bloburl"), "_blank");
      if (!printWindow) {
        pdf.save(pdfFileName());
        setNotice("PDF salvo. Abra o arquivo para imprimir.");
        return;
      }
      setNotice("PDF aberto para impressão.");
    } catch {
      setNotice("Não foi possível imprimir agora. Tente novamente.");
    } finally {
      setWorking(null);
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
                slate={ticketSlates[office.id]}
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
          {profileLoading && mobilePicker && <p className="loading-profile">Carregando informações do candidato…</p>}
          <p className="notice builder-notice" aria-live="polite">{notice}</p>
        </section>

        <aside className={`preview-panel${showInlinePicker ? " is-picking" : ""}${showInlineProfile ? " is-profile" : ""}`}>
          {showInlineProfile && profile ? (
            <CandidateProfile
              candidate={profile}
              presentation="inline"
              onClose={() => setProfile(null)}
              onInspectMate={inspectCandidate}
            />
          ) : showInlinePicker && pickerOffice ? (
            <CandidatePickerPanel
              office={pickerOffice}
              presentation="inline"
              currentSelection={selections[pickerOffice.id]}
              onClose={() => setPickerOfficeId(null)}
              onSelect={(candidate) => selectCandidate(pickerOffice, candidate)}
              onSelectSpecial={(vote) => selectSpecialVote(pickerOffice, vote)}
              onClearCurrent={() => clearOffice(pickerOffice.id)}
            />
          ) : profileLoading && !mobilePicker ? (
            <p className="profile-panel-loading">Carregando informações do candidato…</p>
          ) : (
            <>
              <div className="section-heading preview-heading">
                <div><span className="step">02</span><h2>Sua colinha</h2></div>
                <p>Atualiza conforme você escolhe.</p>
              </div>
              <div className={`ballot-frame${previewTheme === "dark" ? " ballot-frame--dark" : ""}`}>
                <div
                  className={`ballot-paper ballot-sheet${previewTheme === "dark" ? " ballot-preview-dark" : ""}`}
                  ref={ballotRef}
                  id="ballot-card"
                >
                  <p className="ballot-sheet-meta">{BALLOT_META_LABEL}</p>
                  <div className="ballot-sheet-rows">
                    {OFFICES.map((office) => (
                      <BallotPreviewRow
                        key={office.id}
                        office={office}
                        selection={selections[office.id]}
                        showViceOnBallot={showViceOnBallot}
                        slate={ticketSlates[office.id]}
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

              <div className="preview-options" role="group" aria-label="Opções da colinha">
                <button
                  type="button"
                  className={`preview-option-btn${previewTheme === "dark" ? " is-active" : ""}`}
                  aria-pressed={previewTheme === "dark"}
                  onClick={() => setPreviewTheme((theme) => (theme === "light" ? "dark" : "light"))}
                  aria-label={previewTheme === "light" ? "Tema escuro da imagem" : "Tema claro da imagem"}
                >
                  {previewTheme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                  <span>{previewTheme === "light" ? "Tema escuro" : "Tema claro"}</span>
                </button>
                <button
                  type="button"
                  className={`preview-option-btn${showViceOnBallot ? " is-active" : ""}`}
                  aria-pressed={showViceOnBallot}
                  onClick={() => setShowViceOnBallot((value) => !value)}
                  aria-label={showViceOnBallot ? "Ocultar vice na colinha" : "Incluir vice na colinha"}
                >
                  <Users size={18} />
                  <span>{showViceOnBallot ? "Sem vice" : "Com vice"}</span>
                </button>
              </div>

              <div className="action-buttons">
                <button className="save-button" type="button" onClick={saveBallot} disabled={working !== null}>
                  {working === "save" ? <span className="button-spinner" /> : <Save size={18} strokeWidth={2.2} />}
                  Salvar arquivo
                </button>
                <button className="share-button" type="button" onClick={shareBallot} disabled={working !== null}>
                  {working === "share" ? <span className="button-spinner" /> : <Share size={18} strokeWidth={2.2} />}
                  Compartilhar
                </button>
                <button
                  className="whatsapp-link"
                  type="button"
                  onClick={shareBallotOnWhatsApp}
                  disabled={working !== null}
                  aria-label="Compartilhar no WhatsApp"
                >
                  {working === "whatsapp" ? <span className="button-spinner" /> : <WhatsAppIcon size={26} />}
                </button>
              </div>
              <button
                className="print-button"
                type="button"
                onClick={printBallot}
                disabled={working !== null}
              >
                {working === "print" ? <span className="button-spinner" /> : <Printer size={18} strokeWidth={2.2} />}
                Imprimir
              </button>
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

      {profile && mobilePicker && (
        <CandidateProfile
          candidate={profile}
          presentation="modal"
          onClose={() => setProfile(null)}
          onInspectMate={inspectCandidate}
        />
      )}

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
