import { Plus, X, List } from "lucide-react";
import { DevFrame } from "@/shared/ui/dev-frame";
import { statusColor } from "@/shared/lib/statusColor";
import { useConnectDialogStore, closeSession } from "@/features/ssh-connect";
import { useSessionStore, MAX_SESSIONS } from "@/entities/session";

export function MobileSessionTabBar({
  onShowConnections,
}: {
  onShowConnections: () => void;
}) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeIndex = useSessionStore((s) => s.activeIndex);
  const setActiveIndex = useSessionStore((s) => s.setActiveIndex);
  const setDialogOpen = useConnectDialogStore((s) => s.setOpen);

  return (
    <DevFrame
      name="SessionTabBar"
      className="pt-safe-bar shrink-0 flex items-center border-b border-border bg-card"
    >
      <button
        className="flex shrink-0 items-center justify-center px-2.5 py-2 text-muted-foreground active:text-foreground"
        onClick={onShowConnections}
      >
        <List className="size-4" />
      </button>

      <div className="flex flex-1 items-center gap-0.5 overflow-x-auto py-1 [touch-action:pan-x]">
        {sessions.map((s, i) => (
          <button
            key={s.sessionId}
            className={`flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-xs ${
              i === activeIndex
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground active:text-foreground"
            }`}
            onClick={() => setActiveIndex(i)}
          >
            <span
              className={`size-1.5 rounded-full ${statusColor(s.status)}`}
            />
            <span className="max-w-20 truncate">{s.connectionName}</span>
            <button
              className="flex size-3.5 items-center justify-center rounded-sm text-muted-foreground active:bg-accent"
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

      {sessions.length < MAX_SESSIONS && (
        <button
          className="flex shrink-0 items-center justify-center px-2.5 py-2 text-muted-foreground active:text-foreground"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" />
        </button>
      )}
    </DevFrame>
  );
}
