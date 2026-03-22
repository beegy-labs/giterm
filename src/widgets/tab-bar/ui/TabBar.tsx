import { useCallback, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { StatusDot } from "@/shared/ui/status-dot";
import { useSessionStore, MAX_SESSIONS } from "@/entities/session";
import { useConnectDialogStore } from "@/features/ssh-connect";

interface TabBarProps {
  onCloseSession?: (sessionId: string) => void;
}

export function TabBar({ onCloseSession }: TabBarProps) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeIndex = useSessionStore((s) => s.activeIndex);
  const setActiveIndex = useSessionStore((s) => s.setActiveIndex);
  const removeSession = useSessionStore((s) => s.removeSession);
  const reorderSessions = useSessionStore((s) => s.reorderSessions);
  const canAddMore = sessions.length < MAX_SESSIONS;
  const setDialogOpen = useConnectDialogStore((s) => s.setOpen);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const handleClose = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      if (onCloseSession) {
        onCloseSession(sessionId);
      } else {
        removeSession(sessionId);
      }
    },
    [onCloseSession, removeSession],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      dragRef.current = index;
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(index);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const fromIndex = dragRef.current;
      if (fromIndex !== null && fromIndex !== toIndex) {
        reorderSessions(fromIndex, toIndex);
      }
      setDragIndex(null);
      setDropTarget(null);
      dragRef.current = null;
    },
    [reorderSessions],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropTarget(null);
    dragRef.current = null;
  }, []);

  if (sessions.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-0.5 border-b border-border bg-card/80 px-1.5 py-0.5">
      {sessions.map((session, index) => (
        <div
          key={session.sessionId}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          onClick={() => setActiveIndex(index)}
          className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            index === activeIndex
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          } ${dragIndex === index ? "opacity-40" : ""} ${
            dropTarget === index && dropTarget !== dragIndex
              ? "ring-1 ring-primary/40"
              : ""
          }`}
        >
          <StatusDot status={session.status} className="size-1.5" />
          <span className="max-w-28 truncate">
            {session.connectionName || "Terminal"}
          </span>
          <button
            onClick={(e) => handleClose(e, session.sessionId)}
            className="flex size-3.5 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-muted group-hover:opacity-60 group-hover:hover:opacity-100"
          >
            <X className="size-2.5" />
          </button>
        </div>
      ))}
      {canAddMore && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-0.5 text-muted-foreground"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
