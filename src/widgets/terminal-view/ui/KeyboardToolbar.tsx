import { useState, useRef, useCallback } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Copy,
  ClipboardPaste,
  Delete,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { ESC, ctrl } from "@/shared/lib/escapeSequences";

const TMUX_PREFIX = ctrl("b"); // \x02
const TAP_THRESHOLD = 10; // px — movement under this is a tap, above is scroll

interface KeyboardToolbarProps {
  onKey: (value: string) => void;
  isCtrlActive: boolean;
  isAltActive: boolean;
  isShiftActive: boolean;
  onCtrlToggle: () => void;
  onAltToggle: () => void;
  onShiftToggle: () => void;
  onCopy: () => void;
  onPaste: () => void;
  tmuxMode?: boolean;
  onTmuxToggle?: () => void;
}

/** Hook: distinguishes tap from scroll on touch devices */
function useTap(onTap: () => void) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) startRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = startRef.current;
      const t = e.changedTouches[0];
      startRef.current = null;
      if (!start || !t) return;
      if (
        Math.abs(t.clientX - start.x) < TAP_THRESHOLD &&
        Math.abs(t.clientY - start.y) < TAP_THRESHOLD
      ) {
        e.preventDefault();
        onTap();
      }
    },
    [onTap],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onTap();
    },
    [onTap],
  );

  return { onTouchStart, onTouchEnd, onMouseDown };
}

function ToolbarKey({
  label,
  value,
  icon,
  onKey,
  className: extraClass,
}: {
  label?: string;
  value: string;
  icon?: React.ReactNode;
  onKey: (value: string) => void;
  className?: string;
}) {
  const tap = useTap(() => onKey(value));
  return (
    <button
      tabIndex={-1}
      className={`flex shrink-0 min-h-[28px] items-center justify-center rounded-sm bg-accent px-2 py-1.5 text-xs font-medium text-foreground active:bg-accent/70 ${extraClass ?? ""}`}
      onTouchStart={tap.onTouchStart}
      onTouchEnd={tap.onTouchEnd}
      onMouseDown={tap.onMouseDown}
    >
      {icon ?? label}
    </button>
  );
}

function ModifierKey({
  label,
  isActive,
  onToggle,
}: {
  label: string;
  isActive: boolean;
  onToggle: () => void;
}) {
  const tap = useTap(onToggle);
  return (
    <button
      tabIndex={-1}
      className={`flex shrink-0 min-h-[28px] items-center justify-center rounded-sm px-2.5 py-1.5 text-xs font-semibold ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-accent text-foreground active:bg-accent/70"
      }`}
      onTouchStart={tap.onTouchStart}
      onTouchEnd={tap.onTouchEnd}
      onMouseDown={tap.onMouseDown}
    >
      {label}
    </button>
  );
}

function ActionButton({
  icon,
  onAction,
}: {
  icon: React.ReactNode;
  onAction: () => void;
}) {
  const tap = useTap(onAction);
  return (
    <button
      tabIndex={-1}
      className="flex shrink-0 min-h-[28px] items-center justify-center rounded-sm bg-accent px-2 py-1.5 text-foreground active:bg-accent/70"
      onTouchStart={tap.onTouchStart}
      onTouchEnd={tap.onTouchEnd}
      onMouseDown={tap.onMouseDown}
    >
      {icon}
    </button>
  );
}

function ExpandButton({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const tap = useTap(onToggle);
  return (
    <button
      tabIndex={-1}
      className="flex shrink-0 min-h-[28px] items-center justify-center rounded-sm bg-accent px-1.5 py-1.5 text-foreground active:bg-accent/70"
      onTouchStart={tap.onTouchStart}
      onTouchEnd={tap.onTouchEnd}
      onMouseDown={tap.onMouseDown}
    >
      {isOpen ? (
        <ChevronDown className="size-3.5" />
      ) : (
        <ChevronUp className="size-3.5" />
      )}
    </button>
  );
}

type ExpandedPanel = "none" | "tmux" | "vi" | "fkeys";

export function KeyboardToolbar({
  onKey,
  isCtrlActive,
  isAltActive,
  isShiftActive,
  onCtrlToggle,
  onAltToggle,
  onShiftToggle,
  onCopy,
  onPaste,
  tmuxMode,
  onTmuxToggle,
}: KeyboardToolbarProps) {
  const [panel, setPanel] = useState<ExpandedPanel>("none");

  const handleKey = (value: string) => {
    if (isCtrlActive && value.length === 1) {
      const code = value.toUpperCase().charCodeAt(0);
      if (code >= 65 && code <= 90) {
        onKey(String.fromCharCode(code - 64));
        onCtrlToggle();
        return;
      }
    }
    if (isAltActive) {
      onKey("\x1B" + value);
      onAltToggle();
      return;
    }
    if (isShiftActive && value.length === 1) {
      onKey(value.toUpperCase());
      onShiftToggle();
      return;
    }
    onKey(value);
  };

  const togglePanel = (target: ExpandedPanel) =>
    setPanel((p) => (p === target ? "none" : target));

  const tmuxKey = (key: string) => onKey(TMUX_PREFIX + key);

  return (
    <div className="shrink-0 border-t border-border bg-card pb-[max(env(safe-area-inset-bottom),8px)]">
      {/* Main row */}
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5">
        <ModifierKey label="Ctrl" isActive={isCtrlActive} onToggle={onCtrlToggle} />
        <ModifierKey label="Alt" isActive={isAltActive} onToggle={onAltToggle} />

        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

        <ToolbarKey value={ESC.arrowLeft} icon={<ArrowLeft className="size-3.5" />} onKey={handleKey} />
        <ToolbarKey value={ESC.arrowUp} icon={<ArrowUp className="size-3.5" />} onKey={handleKey} />
        <ToolbarKey value={ESC.arrowDown} icon={<ArrowDown className="size-3.5" />} onKey={handleKey} />
        <ToolbarKey value={ESC.arrowRight} icon={<ArrowRight className="size-3.5" />} onKey={handleKey} />

        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

        <ToolbarKey label="ESC" value={ESC.escape} onKey={handleKey} />
        <ToolbarKey label="Tab" value={ESC.tab} onKey={handleKey} />
        <ToolbarKey value={ESC.backspace} icon={<Delete className="size-3.5" />} onKey={handleKey} />

        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

        {onTmuxToggle && (
          <ModifierKey label="Tmux" isActive={!!tmuxMode} onToggle={onTmuxToggle} />
        )}
        <ActionButton icon={<Copy className="size-3.5" />} onAction={onCopy} />
        <ActionButton icon={<ClipboardPaste className="size-3.5" />} onAction={onPaste} />

        <ExpandButton
          isOpen={panel !== "none"}
          onToggle={() => togglePanel(panel === "none" ? "tmux" : "none")}
        />
      </div>

      {/* Panel selector tabs */}
      {panel !== "none" && (
        <div className="flex items-center gap-1 px-2 pb-1">
          <ModifierKey label="Tmux" isActive={panel === "tmux"} onToggle={() => togglePanel("tmux")} />
          <ModifierKey label="Vi" isActive={panel === "vi"} onToggle={() => togglePanel("vi")} />
          <ModifierKey label="Fn" isActive={panel === "fkeys"} onToggle={() => togglePanel("fkeys")} />

          <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

          <ModifierKey label="⇧" isActive={isShiftActive} onToggle={onShiftToggle} />
          <ToolbarKey label="Del" value={ESC.delete} onKey={handleKey} />
          <ToolbarKey label="Home" value={ESC.home} onKey={handleKey} />
          <ToolbarKey label="End" value={ESC.end} onKey={handleKey} />
          <ToolbarKey label="PgUp" value={ESC.pageUp} onKey={handleKey} />
          <ToolbarKey label="PgDn" value={ESC.pageDown} onKey={handleKey} />
        </div>
      )}

      {/* Tmux panel */}
      {panel === "tmux" && (
        <>
          {/* Windows */}
          <div className="flex items-center gap-1 overflow-x-auto px-2 pb-1">
            <span className="shrink-0 text-[10px] text-muted-foreground">Win</span>
            <ToolbarKey label="+New" value="" onKey={() => tmuxKey("c")} />
            <ToolbarKey label="Prev" value="" onKey={() => tmuxKey("p")} />
            <ToolbarKey label="Next" value="" onKey={() => tmuxKey("n")} />
            <ToolbarKey label="List" value="" onKey={() => tmuxKey("w")} />
            <ToolbarKey label="Last" value="" onKey={() => tmuxKey("l")} />
            {[0, 1, 2, 3, 4].map((n) => (
              <ToolbarKey key={n} label={String(n)} value="" onKey={() => tmuxKey(String(n))} />
            ))}
          </div>
          {/* Panes */}
          <div className="flex items-center gap-1 overflow-x-auto px-2 pb-1">
            <span className="shrink-0 text-[10px] text-muted-foreground">Pane</span>
            <ToolbarKey label="V|" value="" onKey={() => tmuxKey("%")} />
            <ToolbarKey label="H—" value="" onKey={() => tmuxKey('"')} />
            <ToolbarKey label="Zoom" value="" onKey={() => tmuxKey("z")} />
            <ToolbarKey label="Cycle" value="" onKey={() => tmuxKey("o")} />
            <ToolbarKey label="Close" value="" onKey={() => tmuxKey("x")} />
            <ToolbarKey label="→Win" value="" onKey={() => tmuxKey("!")} />
            <ToolbarKey label="Layout" value="" onKey={() => tmuxKey(" ")} />
          </div>
          {/* Session + Copy */}
          <div className="flex items-center gap-1 overflow-x-auto px-2 pb-1">
            <span className="shrink-0 text-[10px] text-muted-foreground">Etc</span>
            <ToolbarKey label="Detach" value="" onKey={() => tmuxKey("d")} />
            <ToolbarKey label="Sess" value="" onKey={() => tmuxKey("s")} />
            <ToolbarKey label="Cmd" value="" onKey={() => tmuxKey(":")} />
            <ToolbarKey label="Keys" value="" onKey={() => tmuxKey("?")} />

            <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

            <ToolbarKey label="Copy" value="" onKey={() => tmuxKey("[")} />
            <ToolbarKey label="Paste" value="" onKey={() => tmuxKey("]")} />
            <ToolbarKey label="⇞" value="" onKey={() => tmuxKey(ESC.pageUp)} />
          </div>
        </>
      )}

      {/* Vi panel */}
      {panel === "vi" && (
        <div className="flex items-center gap-1 px-2 pb-1">
          {[
            { label: "h", value: "h" },
            { label: "j", value: "j" },
            { label: "k", value: "k" },
            { label: "l", value: "l" },
            { label: "w", value: "w" },
            { label: "b", value: "b" },
            { label: "0", value: "0" },
            { label: "$", value: "$" },
            { label: "g", value: "g" },
            { label: "G", value: "G" },
            { label: "/", value: "/" },
            { label: "n", value: "n" },
            { label: "q", value: "q" },
          ].map((vk) => (
            <ToolbarKey key={vk.label} label={vk.label} value={vk.value} onKey={(v) => onKey(v)} />
          ))}
        </div>
      )}

      {/* Function keys panel */}
      {panel === "fkeys" && (
        <div className="flex items-center gap-1 overflow-x-auto px-2 pb-1">
          {([
            ["F1", ESC.f1], ["F2", ESC.f2], ["F3", ESC.f3], ["F4", ESC.f4],
            ["F5", ESC.f5], ["F6", ESC.f6], ["F7", ESC.f7], ["F8", ESC.f8],
            ["F9", ESC.f9], ["F10", ESC.f10], ["F11", ESC.f11], ["F12", ESC.f12],
          ] as const).map(([label, value]) => (
            <ToolbarKey key={label} label={label} value={value} onKey={handleKey} />
          ))}
        </div>
      )}
    </div>
  );
}
