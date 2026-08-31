import { UrnaKeyLabel, type UrnaKeySize } from "@/components/urna-key-label";

type UrnaCorrigeLabelProps = {
  compact?: boolean;
  profile?: boolean;
  interactive?: boolean;
  className?: string;
};

function resolveSize({ compact, profile }: UrnaCorrigeLabelProps): UrnaKeySize {
  if (profile) return "profile";
  if (compact) return "compact";
  return "default";
}

export function UrnaCorrigeLabel(props: UrnaCorrigeLabelProps) {
  const { interactive = false, className = "" } = props;
  return <UrnaKeyLabel kind="corrige" size={resolveSize(props)} interactive={interactive} className={className} />;
}
