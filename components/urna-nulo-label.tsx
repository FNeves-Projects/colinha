const URNA_NULO_BUTTON = "/urna-nulo-button.png";
const URNA_NULO_ASPECT = 855 / 467;

type UrnaNuloLabelProps = {
  compact?: boolean;
  interactive?: boolean;
  className?: string;
};

export function UrnaNuloLabel({
  compact = false,
  interactive = false,
  className = "",
}: UrnaNuloLabelProps) {
  const width = compact ? 88 : 110;
  const height = Math.round(width / URNA_NULO_ASPECT);

  return (
    <span
      className={`urna-key-button urna-nulo-button${compact ? " urna-nulo-button--compact" : ""}${interactive ? " urna-key-button--interactive" : ""}${className ? ` ${className}` : ""}`}
      style={{
        width,
        height,
        backgroundImage: `url("${URNA_NULO_BUTTON}")`,
      }}
      role="img"
      aria-hidden={interactive ? true : undefined}
      aria-label={interactive ? undefined : "Nulo"}
    />
  );
}
