import { Info } from "lucide-react";

export function CampaignDisclaimer() {
  return (
    <div className="campaign-disclaimer" role="note">
      <Info size={16} aria-hidden="true" />
      <p>
        <strong>Não é urna eletrônica.</strong> Ferramenta de campanha de Teresinha Neves (3088) para montar sua colinha pessoal de voto.
      </p>
    </div>
  );
}
