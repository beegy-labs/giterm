import { Terminal, Trash2, Play, Pencil, Copy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
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

function DeleteConfirmButton({
  onConfirm,
  className,
  iconSize = "size-3.5",
}: {
  onConfirm: () => void;
  className: string;
  iconSize?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          className={className}
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className={`${iconSize} text-destructive`} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Connection</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the connection. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
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
        className={`flex items-center gap-4 rounded-soft border border-border bg-card p-4 ${
          isActive ? "border-primary/50" : ""
        }`}
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Terminal className="size-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">
            {connection.name}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>SSH</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-primary/20 px-1.5 text-xs text-primary">
                {activeCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex size-12 items-center justify-center rounded-sm active:bg-accent/70"
            onClick={onEdit}
          >
            <Pencil className="size-4 text-primary/70" />
          </button>
          <button
            className="flex size-12 items-center justify-center rounded-sm bg-primary text-primary-foreground active:bg-primary/80"
            onClick={onConnect}
          >
            <Play className="size-5" />
          </button>
          <DeleteConfirmButton
            onConfirm={onRemove}
            className="flex size-12 items-center justify-center rounded-sm active:bg-destructive/10"
            iconSize="size-4"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-3 rounded-sm px-3 py-2 transition-colors ${
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 cursor-pointer"
      }`}
      onClick={onConnect}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10">
        <Terminal className="size-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{connection.name}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>SSH</span>
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px] text-primary">
              {activeCount}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onDuplicate && (
          <button
            className="flex size-6 items-center justify-center rounded-sm hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy className="size-3 text-muted-foreground" />
          </button>
        )}
        <button
          className="flex size-6 items-center justify-center rounded-sm hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="size-3 text-muted-foreground" />
        </button>
        <DeleteConfirmButton
          onConfirm={onRemove}
          className="flex size-6 items-center justify-center rounded-sm hover:bg-destructive/10"
        />
      </div>
    </div>
  );
}
