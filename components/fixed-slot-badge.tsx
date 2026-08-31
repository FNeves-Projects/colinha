import { FIXED_SLOT_BADGE_LABEL } from "@/lib/teresinha-slot";

type FixedSlotBadgeProps = {
  variant?: "card" | "ballot";
  className?: string;
};

export function FixedSlotBadge({ variant = "card", className = "" }: FixedSlotBadgeProps) {
  const baseClass = variant === "ballot" ? "ballot-fixed-mark" : "fixed-label";
  return (
    <span className={`${baseClass}${className ? ` ${className}` : ""}`}>
      {FIXED_SLOT_BADGE_LABEL}
    </span>
  );
}
