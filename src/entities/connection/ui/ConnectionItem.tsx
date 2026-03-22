import { Terminal, Play, Pencil, Copy } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { DeleteConfirmButton } from "@/shared/ui/delete-confirm-button";
import type { ConnectionConfig } from "../model/connectionStore";

interface ConnectionItemProps {
  connection: ConnectionConfig;
  isActive: boolean;
  isMobile?: boolean;
  activeCount?: number;
  onConnect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onDuplicate?: () => void;
}

export function ConnectionItem({
  connection,
  isActive,
  isMobile,
  activeCount = 0,
  onConnect,
  onEdit,
  onRemove,
  onDuplicate,
}: ConnectionItemProps) {
  if (isMobile) {
    return (
      <div
        className={`rounded-xl border bg-card transition-colors ${
          isActive ? "border-primary/40 bg-primary/5" : "border-border"
        }`}
      >
        {/* Top row: icon + name + badge */}
        <div className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Terminal className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight">
              {connection.name}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">SSH</p>
          </div>
          {activeCount > 0 && (
            <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {activeCount} active
            </span>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-end gap-1.5 border-t border-border px-3 py-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="size-4" />
          </Button>
          <DeleteConfirmButton
            onConfirm={onRemove}
            title="Delete Connection"
            description="This will permanently remove the connection. This action cannot be undone."
            className="flex size-8 items-center justify-center rounded-md hover:bg-destructive/10 active:bg-destructive/20"
            iconSize="size-4"
          />
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onConnect();
            }}
            className="gap-1.5"
          >
            <Play className="size-3.5" />
            Connect
          </Button>
        </div>
      </div>
    );
  }

  // Desktop sidebar item
  return (
    <div
      className={`group flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors ${
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/60 text-foreground"
      }`}
      onClick={onConnect}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Terminal className="size-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{connection.name}</p>
        {activeCount > 0 && (
          <p className="text-[10px] text-primary">
            {activeCount} session{activeCount > 1 ? "s" : ""}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onDuplicate && (
          <button
            className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy className="size-3" />
          </button>
        )}
        <button
          className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="size-3" />
        </button>
        <DeleteConfirmButton
          onConfirm={onRemove}
          title="Delete Connection"
          description="This will permanently remove the connection. This action cannot be undone."
          className="flex size-6 items-center justify-center rounded-sm hover:bg-destructive/10"
        />
      </div>
    </div>
  );
}
