import { UrnaKeyLabel, type UrnaKeySize } from "@/components/urna-key-label";

type UrnaBrancoLabelProps = {
  compact?: boolean;
  profile?: boolean;
  interactive?: boolean;
  className?: string;
};

function resolveSize({ compact, profile }: UrnaBrancoLabelProps): UrnaKeySize {
  if (profile) return "profile";
  if (compact) return "compact";
  return "default";
}

export function UrnaBrancoLabel(props: UrnaBrancoLabelProps) {
  const { interactive = false, className = "" } = props;
  return <UrnaKeyLabel kind="branco" size={resolveSize(props)} interactive={interactive} className={className} />;
}
