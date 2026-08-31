import { FixedSlotBadge } from "@/components/fixed-slot-badge";
import { CampaignDisclaimer } from "@/components/campaign-disclaimer";
import { DataFreshnessNote } from "@/components/data-freshness-note";
import { candidatePhotoPublicUrl } from "@/lib/candidate-photo-urls";
import { partyLogoUrl } from "@/lib/party-logos";
import {
  FIXED_SLOT_BADGE_LABEL,
  TERESINHA_BALLOT_NUMBER,
} from "@/lib/teresinha-slot";
import { TERESINHA_SQ_CANDIDATE } from "@/lib/tse-urls";
import type { DataFreshness } from "@/lib/data-freshness";

const CAMPAIGN_CANDIDATE = {
  ballotName: "Teresinha Neves",
  ballotNumber: TERESINHA_BALLOT_NUMBER,
  officeLabel: "Deputada Federal",
  jurisdiction: "São Paulo",
  partyAcronym: "NOVO",
  photoUrl: candidatePhotoPublicUrl(TERESINHA_SQ_CANDIDATE),
} as const;

type SiteFooterProps = {
  freshness: DataFreshness | null;
};

export function SiteFooter({ freshness }: SiteFooterProps) {
  const partyLogo = partyLogoUrl(CAMPAIGN_CANDIDATE.partyAcronym);
  const digits = CAMPAIGN_CANDIDATE.ballotNumber.split("");

  return (
    <footer className="site-footer">
      <div className="footer-panel">
        <section className="footer-campaign" aria-label={`${FIXED_SLOT_BADGE_LABEL}: ${CAMPAIGN_CANDIDATE.ballotName}`}>
          <div className="footer-campaign-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={CAMPAIGN_CANDIDATE.photoUrl}
              alt={`Foto de ${CAMPAIGN_CANDIDATE.ballotName}`}
              width={72}
              height={100}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="footer-campaign-copy">
            <div className="footer-campaign-heading">
              <span>{CAMPAIGN_CANDIDATE.officeLabel}</span>
              <FixedSlotBadge />
            </div>
            <strong className="footer-campaign-name">{CAMPAIGN_CANDIDATE.ballotName}</strong>
            <div className="footer-campaign-number" aria-label={`Número ${CAMPAIGN_CANDIDATE.ballotNumber}`}>
              {digits.map((digit, index) => (
                <span className="number-box filled" key={`${digit}-${index}`}>
                  {digit}
                </span>
              ))}
            </div>
            <div className="footer-campaign-meta">
              {partyLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="footer-campaign-party-logo"
                  src={partyLogo}
                  alt=""
                  width={22}
                  height={22}
                />
              ) : null}
              <span>{CAMPAIGN_CANDIDATE.partyAcronym}</span>
              <span aria-hidden="true">·</span>
              <span>{CAMPAIGN_CANDIDATE.jurisdiction}</span>
            </div>
          </div>
        </section>

        <section className="footer-meta" aria-label="Informações do site">
          <div className="footer-brand">colinha<span>.2026</span></div>
          <CampaignDisclaimer />
          <DataFreshnessNote freshness={freshness} />
        </section>
      </div>
    </footer>
  );
}
