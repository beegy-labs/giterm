import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, message, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-4 py-16 ${className ?? ""}`}>
      {icon}
      <p className="text-center text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
