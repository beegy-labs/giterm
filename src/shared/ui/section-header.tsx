interface SectionHeaderProps {
  title: string;
  className?: string;
}

export function SectionHeader({ title, className }: SectionHeaderProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
