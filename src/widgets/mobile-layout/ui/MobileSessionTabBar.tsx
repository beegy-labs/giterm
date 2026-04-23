import { X, List } from "lucide-react";
import { DevFrame } from "@/shared/ui/dev-frame";
import { StatusDot } from "@/shared/ui/status-dot";
import { closeSession } from "@/features/ssh-connect";
import { useSessionStore } from "@/entities/session";

export function MobileSessionTabBar({
  onShowConnections,
}: {
  onShowConnections: () => void;
}) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeIndex = useSessionStore((s) => s.activeIndex);
  const setActiveIndex = useSessionStore((s) => s.setActiveIndex);
  return (
    <DevFrame
      name="SessionTabBar"
      className="shrink-0 flex items-center border-b border-border bg-card/80"
    >
      {/* Connections list button */}
      <button
        className="flex shrink-0 items-center justify-center px-3 py-2.5 text-muted-foreground transition-colors active:text-foreground"
        onClick={onShowConnections}
      >
        <List className="size-4" />
      </button>

      {/* Session tabs */}
      <div className="flex flex-1 items-center gap-1 overflow-x-auto px-1 py-1.5 [touch-action:pan-x] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sessions.map((s, i) => (
          <button
            key={`${s.connectionId}-${i}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              i === activeIndex
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            onClick={() => setActiveIndex(i)}
          >
            <StatusDot status={s.status} />
            <span className="max-w-[5rem] truncate">{s.connectionName}</span>
            <button
              className="flex size-3.5 shrink-0 items-center justify-center rounded-sm opacity-60 hover:opacity-100 active:bg-accent"
              onClick={(e) => {
                e.stopPropagation();
                closeSession(s.sessionId);
              }}
            >
              <X className="size-2.5" />
            </button>
          </button>
        ))}
      </div>

    </DevFrame>
  );
}
