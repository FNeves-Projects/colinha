type SpecialVoteBadgeProps = {
  vote: "branco" | "nulo";
  compact?: boolean;
};

export function SpecialVoteBadge({ vote, compact = false }: SpecialVoteBadgeProps) {
  const className = `ballot-blank-pill${compact ? " ballot-blank-pill-compact" : ""}`;
  const label = vote === "branco" ? "BRANCO" : "NULO";
  return (
    <span className={className} aria-label={vote === "branco" ? "Voto em branco" : "Voto nulo"}>
      {label}
    </span>
  );
}
