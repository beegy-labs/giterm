import type { ReactNode } from "react";

interface InlineAlertProps {
  variant: "error" | "success";
  message: string;
  icon?: ReactNode;
  className?: string;
}

const STYLES = {
  error: "bg-destructive/10 text-destructive",
  success: "bg-primary/10 text-primary",
} as const;

export function InlineAlert({ variant, message, icon, className }: InlineAlertProps) {
  return (
    <div className={`flex items-center gap-2 rounded-sm p-3 text-sm ${STYLES[variant]} ${className ?? ""}`}>
      {icon}
      {message}
    </div>
  );
}
