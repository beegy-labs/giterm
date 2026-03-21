import { useCallback, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useSessionStore, MAX_SESSIONS } from "@/entities/session";
import { useConnectDialogStore } from "@/features/ssh-connect";
import { statusColor } from "@/shared/lib/statusColor";

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
    <div className="flex shrink-0 items-center gap-0.5 border-b border-border bg-card px-1">
      {sessions.map((session, index) => (
        <div
          key={session.sessionId}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          onClick={() => setActiveIndex(index)}
          className={`group flex cursor-pointer items-center gap-2 border-b-2 px-3 py-1.5 text-xs transition-colors ${
            index === activeIndex
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          } ${dragIndex === index ? "opacity-50" : ""} ${
            dropTarget === index && dropTarget !== dragIndex
              ? "bg-accent/30"
              : ""
          }`}
        >
          <span
            className={`inline-block size-2 shrink-0 rounded-full ${statusColor(session.status)}`}
          />
          <span className="max-w-24 truncate">
            {session.connectionName || "Terminal"}
          </span>
          <button
            onClick={(e) => handleClose(e, session.sessionId)}
            className="flex size-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
      {canAddMore && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-1"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
