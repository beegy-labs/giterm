import type { ReactNode } from "react";

interface CodeBlockProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function CodeBlock({ label, children, className }: CodeBlockProps) {
  return (
    <div className="space-y-1">
      {label && (
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <code className={`block break-all rounded-sm bg-muted px-3 py-2 font-mono text-xs ${className ?? ""}`}>
        {children}
      </code>
    </div>
  );
}
