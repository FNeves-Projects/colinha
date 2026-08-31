import type { ButtonHTMLAttributes } from "react";

export type PickerActionVariant = "nulo" | "branco" | "remove" | "save";

const LABELS: Record<PickerActionVariant, string> = {
  nulo: "Nulo",
  branco: "Em branco",
  remove: "Remover",
  save: "Salvar",
};

type PickerActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: PickerActionVariant;
};

export function PickerActionButton({
  variant,
  className = "",
  type = "button",
  children,
  ...props
}: PickerActionButtonProps) {
  return (
    <button
      type={type}
      className={`picker-action-btn picker-action-btn--${variant}${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children ?? LABELS[variant]}
    </button>
  );
}
