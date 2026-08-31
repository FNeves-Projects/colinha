const URNA_BRANCO_BUTTON = "/urna-branco-button.png";
const URNA_BRANCO_ASPECT = 855 / 467;

type UrnaBrancoLabelProps = {
  compact?: boolean;
  interactive?: boolean;
  className?: string;
};

export function UrnaBrancoLabel({
  compact = false,
  interactive = false,
  className = "",
}: UrnaBrancoLabelProps) {
  const width = compact ? 88 : 110;
  const height = Math.round(width / URNA_BRANCO_ASPECT);

  return (
    <span
      className={`urna-key-button urna-branco-button${compact ? " urna-branco-button--compact" : ""}${interactive ? " urna-key-button--interactive" : ""}${className ? ` ${className}` : ""}`}
      style={{
        width,
        height,
        backgroundImage: `url("${URNA_BRANCO_BUTTON}")`,
      }}
      role="img"
      aria-hidden={interactive ? true : undefined}
      aria-label={interactive ? undefined : "Branco"}
    />
  );
}
