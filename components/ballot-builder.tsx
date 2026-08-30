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
  selectionShareLine,
  type OfficeSelection,
  type Selections,
  type SpecialVoteKind,
} from "@/lib/ballot-selections";
import { partyStyleForAcronym, previewOfficeLabel } from "@/lib/party-styles";
import { normalizeSocialLinks } from "@/lib/social-links";
import { tseCandidateUrl } from "@/lib/tse-urls";
import type { Candidate, CandidateSummary } from "@/lib/types";
import { CandidatePickerDrawer } from "@/components/candidate-picker-drawer";
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

function CandidatePhoto({ candidate, size = 58 }: { candidate: CandidateSummary; size?: number }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [candidate.photoUrl]);

  if (candidate.photoUrl && !imageFailed) {
    return (
      <Image
        className="candidate-photo"
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
    <span className="candidate-photo candidate-initials" role="img" aria-label={`Iniciais de ${candidate.ballotName}`}>
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
  const style = partyStyleForAcronym(acronym);
  return (
    <div className="party-badge">
      <span className="party-badge-mark" style={{ background: style.background, color: style.color }}>
        {acronym}
      </span>
      <span className="party-badge-label">{acronym}</span>
    </div>
  );
}

function BallotPreviewRow({ office, selection }: { office: Office; selection: OfficeSelection }) {
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
  return (
    <div className="ballot-row">
      <div className="ballot-row-photo">
        <CandidatePhoto candidate={candidate} size={68} />
      </div>
      <div className="ballot-row-main">
        <span className="ballot-row-office">{officeLabel}</span>
        <NumberBoxes number={candidate.ballotNumber} digits={office.digits} />
        <strong className="ballot-row-name">{candidate.ballotName}</strong>
      </div>
      <div className="ballot-row-party">
        <PartyBadge acronym={candidate.partyAcronym} />
      </div>
    </div>
  );
}

function SpecialVoteCard({
  office,
  vote,
  onSwap,
}: {
  office: Office;
  vote: SpecialVoteKind;
  onSwap: () => void;
}) {
  return (
    <article className={`office-card selected special-vote special-vote-${vote}`}>
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
        <button className="clear-button" type="button" onClick={onSwap} aria-label={`Trocar ${office.label}`}>
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
}: {
  office: Office;
  candidate: CandidateSummary;
  onInspect?: (candidate: CandidateSummary) => void;
  onSwap?: () => void;
}) {
  return (
    <article className={`office-card selected${office.fixed ? " fixed" : ""}`}>
      <CandidatePhoto candidate={candidate} />
      <div className="office-card-copy">
        <div className="office-card-heading">
          <span>{office.label}</span>
          {office.fixed && (
            <span className="fixed-label"><LockKeyhole size={12} /> fixo</span>
          )}
        </div>
        <strong>{candidate.ballotName}</strong>
        <small>{[candidate.partyAcronym, candidate.status].filter(Boolean).join(" · ")}</small>
        {onInspect && (
          <button className="text-button" type="button" onClick={() => onInspect(candidate)}>
            <Info size={14} /> Ver informações
          </button>
        )}
      </div>
      <div className="selected-number">
        {!office.fixed && onSwap && (
          <button className="clear-button" type="button" onClick={onSwap} aria-label={`Trocar ${office.label}`}>
            <ArrowLeftRight size={16} strokeWidth={2.2} />
          </button>
        )}
        <NumberBoxes number={candidate.ballotNumber} digits={office.digits} />
      </div>
    </article>
  );
}

function EmptyOfficeSlot({ office, onOpen }: { office: Office; onOpen: () => void }) {
  return (
    <article className="office-card empty-slot">
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
  onSelect,
  onSelectSpecial,
  onInspect,
}: {
  office: Office;
  selected: OfficeSelection;
  onSelect: (candidate: CandidateSummary) => void;
  onSelectSpecial: (vote: SpecialVoteKind) => void;
  onInspect: (candidate: CandidateSummary) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleSelect(candidate: CandidateSummary) {
    onSelect(candidate);
    setDrawerOpen(false);
  }

  function handleSelectSpecial(vote: SpecialVoteKind) {
    onSelectSpecial(vote);
    setDrawerOpen(false);
  }

  return (
    <>
      {selected?.type === "candidate" ? (
        <SelectedOfficeCard
          office={office}
          candidate={selected.candidate}
          onInspect={onInspect}
          onSwap={office.fixed ? undefined : () => setDrawerOpen(true)}
        />
      ) : selected?.type === "special" ? (
        <SpecialVoteCard
          office={office}
          vote={selected.vote}
          onSwap={() => setDrawerOpen(true)}
        />
      ) : (
        <EmptyOfficeSlot office={office} onOpen={() => setDrawerOpen(true)} />
      )}

      <CandidatePickerDrawer
        office={office}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelect={handleSelect}
        onSelectSpecial={handleSelectSpecial}
        onInspect={onInspect}
      />
    </>
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
  const ballotRef = useRef<HTMLDivElement>(null);
  const refreshedSavedSelections = useRef(false);
  const urnaSoundRef = useRef<HTMLAudioElement | null>(null);

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
    setNotice(`${candidate.ballotName} foi adicionado à sua colinha.`);
    playConfirmation();
  }

  function selectSpecialVote(office: Office, vote: SpecialVoteKind) {
    setSelections((current) => ({ ...current, [office.id]: { type: "special", vote } }));
    setNotice(selectionNotice({ type: "special", vote }));
    playConfirmation();
  }

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
      backgroundColor: "#ffffff",
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
          <a className="brand" href="#top" aria-label="Colinha 2026">
            <span className="brand-mark"><Check size={19} strokeWidth={3} /></span>
            <span>colinha<span>.2026</span></span>
          </a>
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
        <div className="hero-content" id="top">
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
                onSelect={(candidate) => selectCandidate(office, candidate)}
                onSelectSpecial={(vote) => selectSpecialVote(office, vote)}
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
        </section>

        <aside className="preview-panel">
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
          <p className="privacy-note"><LockKeyhole size={14} /> Suas escolhas ficam somente neste aparelho.</p>
          <p className="notice" aria-live="polite">{notice}</p>
        </aside>
      </div>

      <footer className="site-footer">
        <div className="footer-brand">colinha<span>.2026</span></div>
        <p>Ferramenta de campanha. Antes de votar, confirme a situação e os dados oficiais da candidatura no TSE.</p>
      </footer>

      {profile && <ProfileDrawer candidate={profile} onClose={() => setProfile(null)} />}
    </main>
  );
}
