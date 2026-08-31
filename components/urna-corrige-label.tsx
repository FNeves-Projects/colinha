const URNA_CORRIGE_BUTTON = "/urna-corrige-button.png";
const URNA_CORRIGE_ASPECT = 855 / 467;

type UrnaCorrigeLabelProps = {
  compact?: boolean;
  profile?: boolean;
  interactive?: boolean;
  className?: string;
};

export function UrnaCorrigeLabel({
  compact = false,
  profile = false,
  interactive = false,
  className = "",
}: UrnaCorrigeLabelProps) {
  const width = profile ? 77 : compact ? 88 : 110;
  const height = profile ? 42 : Math.round(width / URNA_CORRIGE_ASPECT);

  return (
    <span
      className={`urna-key-button urna-corrige-button${compact ? " urna-corrige-button--compact" : ""}${interactive ? " urna-key-button--interactive" : ""}${className ? ` ${className}` : ""}`}
      style={{
        width,
        height,
        backgroundImage: `url("${URNA_CORRIGE_BUTTON}")`,
      }}
      role="img"
      aria-hidden={interactive ? true : undefined}
      aria-label={interactive ? undefined : "Corrige"}
    />
  );
}
