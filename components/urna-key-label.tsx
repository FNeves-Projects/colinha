const URNA_ASPECT = 855 / 467;

export type UrnaKeyKind = "nulo" | "branco" | "corrige" | "confirma";
export type UrnaKeySize = "default" | "compact" | "profile";

const URNA_KEYS: Record<UrnaKeyKind, { src: string; bg: string; label: string; className: string }> = {
  nulo: { src: "/urna-nulo-button.png", bg: "#e5e7eb", label: "Nulo", className: "urna-nulo-button" },
  branco: { src: "/urna-branco-button.png", bg: "#fff", label: "Branco", className: "urna-branco-button" },
  corrige: { src: "/urna-corrige-button.png", bg: "#ef4423", label: "Corrige", className: "urna-corrige-button" },
  confirma: { src: "/urna-confirma-button.png", bg: "#12b76a", label: "Confirma", className: "urna-confirma-button" },
};

const URNA_WIDTH: Record<UrnaKeySize, number> = {
  default: 110,
  compact: 88,
  profile: 0,
};

export function urnaKeyDimensions(size: UrnaKeySize) {
  if (size === "profile") return null;
  const width = URNA_WIDTH[size];
  return { width, height: Math.round(width / URNA_ASPECT) };
}

type UrnaKeyLabelProps = {
  kind: UrnaKeyKind;
  size?: UrnaKeySize;
  interactive?: boolean;
  className?: string;
};

export function UrnaKeyLabel({
  kind,
  size = "default",
  interactive = false,
  className = "",
}: UrnaKeyLabelProps) {
  const config = URNA_KEYS[kind];
  const dimensions = urnaKeyDimensions(size);
  const sizeClass = size === "compact" ? ` ${config.className}--compact` : size === "profile" ? ` ${config.className}--profile` : "";

  return (
    <span
      className={`urna-key-button ${config.className}${sizeClass}${interactive ? " urna-key-button--interactive" : ""}${className ? ` ${className}` : ""}`}
      style={{
        backgroundColor: config.bg,
        backgroundImage: `url("${config.src}")`,
        ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}),
      }}
      role="img"
      aria-hidden={interactive ? true : undefined}
      aria-label={interactive ? undefined : config.label}
    />
  );
}
