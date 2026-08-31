const URNA_CONFIRMA_BUTTON = "/urna-confirma-button.png";
const URNA_CONFIRMA_ASPECT = 855 / 467;

type UrnaConfirmaLabelProps = {
  compact?: boolean;
  profile?: boolean;
  interactive?: boolean;
  className?: string;
};

export function UrnaConfirmaLabel({
  compact = false,
  profile = false,
  interactive = false,
  className = "",
}: UrnaConfirmaLabelProps) {
  const width = profile ? 77 : compact ? 88 : 110;
  const height = profile ? 42 : Math.round(width / URNA_CONFIRMA_ASPECT);

  return (
    <span
      className={`urna-key-button urna-confirma-button${compact ? " urna-confirma-button--compact" : ""}${interactive ? " urna-key-button--interactive" : ""}${className ? ` ${className}` : ""}`}
      style={{
        width,
        height,
        backgroundImage: `url("${URNA_CONFIRMA_BUTTON}")`,
      }}
      role="img"
      aria-hidden={interactive ? true : undefined}
      aria-label={interactive ? undefined : "Confirma"}
    />
  );
}
