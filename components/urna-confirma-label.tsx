import { UrnaKeyLabel, type UrnaKeySize } from "@/components/urna-key-label";

type UrnaConfirmaLabelProps = {
  compact?: boolean;
  profile?: boolean;
  interactive?: boolean;
  className?: string;
};

function resolveSize({ compact, profile }: UrnaConfirmaLabelProps): UrnaKeySize {
  if (profile) return "profile";
  if (compact) return "compact";
  return "default";
}

export function UrnaConfirmaLabel(props: UrnaConfirmaLabelProps) {
  const { interactive = false, className = "" } = props;
  return <UrnaKeyLabel kind="confirma" size={resolveSize(props)} interactive={interactive} className={className} />;
}
