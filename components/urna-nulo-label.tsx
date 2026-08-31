import { UrnaKeyLabel, type UrnaKeySize } from "@/components/urna-key-label";

type UrnaNuloLabelProps = {
  compact?: boolean;
  profile?: boolean;
  interactive?: boolean;
  className?: string;
};

function resolveSize({ compact, profile }: UrnaNuloLabelProps): UrnaKeySize {
  if (profile) return "profile";
  if (compact) return "compact";
  return "default";
}

export function UrnaNuloLabel(props: UrnaNuloLabelProps) {
  const { interactive = false, className = "" } = props;
  return <UrnaKeyLabel kind="nulo" size={resolveSize(props)} interactive={interactive} className={className} />;
}
