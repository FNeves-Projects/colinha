import { ExternalLink } from "lucide-react";
import {
  formatDataFreshnessLabel,
  TSE_DIVULGA_HOME_URL,
  type DataFreshness,
} from "@/lib/data-freshness";

type DataFreshnessNoteProps = {
  freshness: DataFreshness | null;
  variant?: "footer" | "inline";
};

export function DataFreshnessNote({ freshness, variant = "footer" }: DataFreshnessNoteProps) {
  const updatedLabel = formatDataFreshnessLabel(freshness);
  const className = variant === "footer" ? "data-freshness-note" : "data-freshness-note data-freshness-note--inline";

  return (
    <p className={className}>
      {updatedLabel ? (
        <>
          <span>{updatedLabel} </span>
        </>
      ) : (
        <span>Consulte o TSE para confirmar situação e dados oficiais das candidaturas. </span>
      )}
      <a href={TSE_DIVULGA_HOME_URL} target="_blank" rel="noopener noreferrer">
        Confirme no site do TSE
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    </p>
  );
}
