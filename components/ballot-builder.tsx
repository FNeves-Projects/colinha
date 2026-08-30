"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  Check,
  ExternalLink,
  Info,
  LockKeyhole,
  Search,
  Share2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { OFFICES, TERESINHA, type Office } from "@/lib/offices";
import { normalizeSocialLinks } from "@/lib/social-links";
import { tseCandidateUrl } from "@/lib/tse-urls";
import type { Candidate, CandidateSummary } from "@/lib/types";
import { SocialNetworkIcon } from "@/components/social-network-icon";

const STORAGE_KEY = "colinha-digital-2026-v1";
type Selections = Record<string, CandidateSummary | null>;
const EMPTY_TSE_VALUES = new Set(["#NULO#", "#NE", "-1"]);

function initialSelections(): Selections {
  return Object.fromEntries(
    OFFICES.map((office) => [office.id, office.fixed ? TERESINHA : null]),
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
      const candidate = selections[office.id];
      return [office.id, candidate ? sanitizeCandidateSummary(candidate) : null];
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

function SelectedOfficeCard({
  office,
  candidate,
  mode = "interactive",
  onInspect,
  onClear,
}: {
  office: Office;
  candidate: CandidateSummary;
  mode?: "interactive" | "preview";
  onInspect?: (candidate: CandidateSummary) => void;
  onClear?: () => void;
}) {
  return (
    <article className={`office-card selected${office.fixed ? " fixed" : ""}${mode === "preview" ? " preview-card" : ""}`}>
      <CandidatePhoto candidate={candidate} />
      <div className="office-card-copy">
        <div className="office-card-heading">
          <span>{office.label}</span>
          {office.fixed && mode === "interactive" && (
            <span className="fixed-label"><LockKeyhole size={12} /> fixo</span>
          )}
        </div>
        <strong>{candidate.ballotName}</strong>
        <small>{[candidate.partyAcronym, candidate.status].filter(Boolean).join(" · ")}</small>
        {mode === "interactive" && onInspect && (
          <button className="text-button" type="button" onClick={() => onInspect(candidate)}>
            <Info size={14} /> Ver informações
          </button>
        )}
      </div>
      <div className="selected-number">
        <NumberBoxes number={candidate.ballotNumber} digits={office.digits} />
        {mode === "interactive" && !office.fixed && onClear && (
          <button className="clear-button" type="button" onClick={onClear} aria-label={`Trocar ${office.label}`}>
            Trocar
          </button>
        )}
      </div>
    </article>
  );
}

function EmptyOfficeCard({ office }: { office: Office }) {
  return (
    <article className="office-card preview-empty">
      <span className="empty-photo" aria-hidden="true" />
      <div className="office-card-copy">
        <div className="office-card-heading">
          <span>{office.label}</span>
        </div>
        <strong>Escolha seu candidato</strong>
        <small>{office.digits} dígitos</small>
      </div>
      <div className="selected-number">
        <NumberBoxes digits={office.digits} />
      </div>
    </article>
  );
}

function CandidatePicker({
  office,
  selected,
  onSelect,
  onClear,
  onInspect,
}: {
  office: Office;
  selected: CandidateSummary | null;
  onSelect: (candidate: CandidateSummary) => void;
  onClear: () => void;
  onInspect: (candidate: CandidateSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CandidateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (office.fixed || selected || query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          office: String(office.code),
          uf: office.jurisdiction,
          year: "2026",
        });
        const response = await fetch(`/api/candidates?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Falha na busca");
        setResults((data.candidates ?? []).map(sanitizeCandidateSummary));
        setSearched(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 320);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [office, query, selected]);

  if (selected) {
    return (
      <SelectedOfficeCard
        office={office}
        candidate={selected}
        onInspect={onInspect}
        onClear={onClear}
      />
    );
  }

  return (
    <article className="office-card search-card">
      <div className="empty-photo"><Search size={20} /></div>
      <div className="office-card-copy search-copy">
        <label htmlFor={`search-${office.id}`}>{office.label}</label>
        <div className="search-field">
          <Search size={17} />
          <input
            id={`search-${office.id}`}
            value={query}
            inputMode="search"
            autoComplete="off"
            placeholder={`Digite nome ou ${office.digits} dígitos`}
            onChange={(event) => setQuery(event.target.value)}
          />
          {loading && <span className="search-spinner" aria-label="Buscando" />}
        </div>
        <NumberBoxes
          number={/^\d+$/.test(query) ? query.slice(0, office.digits) : undefined}
          digits={office.digits}
        />
        {(results.length > 0 || searched) && (
          <div className="search-results" role="listbox" aria-label={`Resultados para ${office.label}`}>
            {results.map((candidate) => (
              <button type="button" key={candidate.id} onClick={() => onSelect(candidate)}>
                <CandidatePhoto candidate={candidate} size={42} />
                <span>
                  <strong>{candidate.ballotName}</strong>
                  <small>{candidate.partyAcronym ?? "Partido não informado"}</small>
                </span>
                <b>{candidate.ballotNumber}</b>
              </button>
            ))}
            {searched && results.length === 0 && (
              <p>Nenhum candidato encontrado nesse cargo.</p>
            )}
          </div>
        )}
      </div>
    </article>
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
  const [working, setWorking] = useState<"save" | "share" | null>(null);
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
        setSelections(sanitizeSelections({ ...initialSelections(), ...saved.selections, federal: TERESINHA }));
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

    const refreshableOffices = OFFICES.filter((office) => Boolean(selections[office.id]));
    if (!refreshableOffices.length) return;

    let cancelled = false;
    void Promise.all(
      refreshableOffices.map(async (office) => {
        const savedCandidate = selections[office.id];
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
          if (!update.allowReplace && current[update.officeId]?.id !== update.savedCandidateId) continue;
          next[update.officeId] = update.candidate;
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
    const first = selections.senador1?.ballotNumber;
    const second = selections.senador2?.ballotNumber;
    return Boolean(first && second && first === second);
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
    setSelections((current) => ({ ...current, [office.id]: cleanCandidate }));
    setNotice(`${candidate.ballotName} foi adicionado à sua colinha.`);
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
          text: "Minha colinha para a eleição de 2026.",
        });
        setNotice("Colinha compartilhada.");
      } else {
        pdf.save(fileName());
        window.open(
          `https://wa.me/?text=${encodeURIComponent("Minha colinha 2026 está pronta. Vou anexar o PDF que acabei de salvar.")}`,
          "_blank",
          "noopener,noreferrer",
        );
        setNotice("Salvamos o PDF e abrimos o WhatsApp para você anexar.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setNotice("Não foi possível compartilhar agora. Tente salvar o PDF.");
      }
    } finally {
      setWorking(null);
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
                onClear={() => setSelections((current) => ({ ...current, [office.id]: null }))}
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
            <div className="ballot-paper" ref={ballotRef} id="ballot-card">
              <div className="ballot-header">
                <div className="paper-brand"><span>✓</span> colinha<span>.2026</span></div>
                <div>ORDEM DE VOTAÇÃO<br /><strong>SÃO PAULO</strong></div>
              </div>
              <p className="paper-instruction">Confira o número e a foto antes de apertar <strong>CONFIRMA</strong>.</p>
              <div className="office-list ballot-office-list">
                {OFFICES.map((office) => {
                  const candidate = selections[office.id];
                  return candidate ? (
                    <SelectedOfficeCard
                      key={office.id}
                      office={office}
                      candidate={candidate}
                      mode="preview"
                    />
                  ) : (
                    <EmptyOfficeCard key={office.id} office={office} />
                  );
                })}
              </div>
              {duplicateSenator && <p className="paper-warning">Atenção: escolha números diferentes para as duas vagas de senador.</p>}
              <div className="ballot-footer">
                <span>Gerado em {new Date().toLocaleDateString("pt-BR")}</span>
                <strong>Leve sua colinha para votar.</strong>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button className="save-button" type="button" onClick={saveBallot} disabled={working !== null}>
              {working === "save" ? <span className="button-spinner" /> : <Check size={19} />}
              Salvar colinha
            </button>
            <button className="share-button" type="button" onClick={shareBallot} disabled={working !== null}>
              {working === "share" ? <span className="button-spinner" /> : <Share2 size={19} />}
              Compartilhar colinha
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
