const URNA_BRANCO_BUTTON = "/urna-branco-button.svg";

type UrnaBrancoLabelProps = {
  compact?: boolean;
  className?: string;
};

export function UrnaBrancoLabel({
  compact = false,
  className = "",
}: UrnaBrancoLabelProps) {
  const width = compact ? 96 : 120;
  const height = compact ? 34 : 42;

  return (
    <span className={`urna-branco-label${compact ? " urna-branco-label--compact" : ""}${className ? ` ${className}` : ""}`}>
      {/* Native img keeps the urna button crisp in PNG/PDF export. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={URNA_BRANCO_BUTTON}
        alt=""
        width={width}
        height={height}
        draggable={false}
        decoding="async"
      />
    </span>
  );
}
