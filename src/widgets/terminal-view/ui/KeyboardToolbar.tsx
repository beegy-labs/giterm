import { useRef, useCallback, useEffect, useState, type RefObject } from "react";
// triggerHitRegionRefresh intentionally NOT called on panel toggle:
// - New panel row DOM nodes are registered at correct coords by iOS automatically
// - Main row Y is unchanged (always last in DOM = always at screen bottom)
// - Calling scrollTo(0,1) nudge induces 34px iOS form assistant bar oscillation
//   (778↔744 --vvh swing) which shifts toolbar position and breaks hit-regions
import { DevFrame } from "@/shared/ui/dev-frame";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Copy,
  ClipboardPaste,
  Delete,
  Keyboard,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { ESC } from "@/shared/lib/escapeSequences";
import { applyModifiers } from "@/shared/lib/terminalModifiers";

const TAP_THRESHOLD = 10; // px
const TMUX = "\x02"; // Ctrl+B prefix

type PanelId = "tmux" | "ctrl" | "fn";

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
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  showKeyboard?: boolean;
  onKeyboardToggle?: () => void;
  composingText?: string;
}

/**
 * Distinguishes tap from horizontal scroll.
 */
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
      const moved =
        Math.abs(t.clientX - start.x) >= TAP_THRESHOLD ||
        Math.abs(t.clientY - start.y) >= TAP_THRESHOLD;
      if (!moved) {
        e.preventDefault();
        onTap();
      }
    },
    [onTap],
  );

  const onTouchCancel = useCallback(() => {
    startRef.current = null;
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onTap();
    },
    [onTap],
  );

  return { onTouchStart, onTouchEnd, onTouchCancel, onMouseDown };
}

function Key({
  label,
  value,
  icon,
  active,
  onKey,
}: {
  label?: string;
  value: string;
  icon?: React.ReactNode;
  active?: boolean;
  onKey: (v: string) => void;
}) {
  const tap = useTap(() => onKey(value));
  return (
    <button
      tabIndex={-1}
      className={`flex shrink-0 min-h-[30px] items-center justify-center rounded-sm px-2 py-1.5 text-xs font-medium ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-accent text-foreground active:bg-accent/70"
      }`}
      onTouchStart={tap.onTouchStart}
      onTouchEnd={tap.onTouchEnd}
      onTouchCancel={tap.onTouchCancel}
      onMouseDown={tap.onMouseDown}
    >
      {icon ?? label}
    </button>
  );
}

/**
 * Programmatic horizontal scroll for iOS WKWebView.
 * Uses native addEventListener + overflow-x:hidden (CSS clip, scrollLeft always writable).
 */
function useHorizontalScroll(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startLeft = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startLeft = el.scrollLeft;
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      el.scrollLeft = startLeft + (startX - t.clientX);
    };

    const onEnd = () => { tracking = false; };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [ref]);
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

// ---------------------------------------------------------------------------
// Panel key definitions — only keys NOT on the standard iOS keyboard
// ---------------------------------------------------------------------------

/**
 * Tmux panel: auto-prepends Ctrl+B prefix.
 * Removed window numbers 0-4 — they're on the iOS keyboard.
 */
const TMUX_KEYS: { label: string; value: string }[] = [
  // Windows
  { label: "+",     value: TMUX + "c" },  // new window
  { label: "n",     value: TMUX + "n" },  // next window
  { label: "p",     value: TMUX + "p" },  // previous window
  { label: "l",     value: TMUX + "l" },  // last window
  // Panes
  { label: "V|",    value: TMUX + "%" },  // vertical split
  { label: "H—",    value: TMUX + '"' },  // horizontal split
  { label: "z",     value: TMUX + "z" },  // zoom pane
  { label: "o",     value: TMUX + "o" },  // cycle pane
  { label: "x",     value: TMUX + "x" },  // close pane
  // Misc
  { label: "d",     value: TMUX + "d" },  // detach
  { label: ":",     value: TMUX + ":" },  // command prompt
];

/**
 * Ctrl shortcuts panel: one-tap common Ctrl combos.
 * These require the Ctrl modifier which is absent from the iOS keyboard.
 * Replaces the Vi panel — h/j/k/l/etc. are just letters already on iOS keyboard.
 */
const CTRL_KEYS: { label: string; value: string; note: string }[] = [
  { label: "^C", value: "\x03", note: "interrupt" },
  { label: "^D", value: "\x04", note: "EOF/logout" },
  { label: "^Z", value: "\x1A", note: "suspend" },
  { label: "^L", value: "\x0C", note: "clear" },
  { label: "^A", value: "\x01", note: "line start" },
  { label: "^E", value: "\x05", note: "line end" },
  { label: "^R", value: "\x12", note: "history" },
  { label: "^W", value: "\x17", note: "del word" },
  { label: "^U", value: "\x15", note: "del line" },
  { label: "^K", value: "\x0B", note: "del to end" },
];

const FN_KEYS: { label: string; value: string }[] = [
  { label: "F1",  value: ESC.f1  },
  { label: "F2",  value: ESC.f2  },
  { label: "F3",  value: ESC.f3  },
  { label: "F4",  value: ESC.f4  },
  { label: "F5",  value: ESC.f5  },
  { label: "F6",  value: ESC.f6  },
  { label: "F7",  value: ESC.f7  },
  { label: "F8",  value: ESC.f8  },
  { label: "F9",  value: ESC.f9  },
  { label: "F10", value: ESC.f10 },
  { label: "F11", value: ESC.f11 },
  { label: "F12", value: ESC.f12 },
];

function panelKeys(panel: PanelId): { label: string; value: string }[] {
  if (panel === "tmux") return TMUX_KEYS;
  if (panel === "ctrl") return CTRL_KEYS;
  return FN_KEYS;
}

// ---------------------------------------------------------------------------
// Panel rows (rendered ABOVE main row — iOS hit-region rule)
// ---------------------------------------------------------------------------

function PanelContentRow({
  panel,
  onKey,
  onScrollUp,
  onScrollDown,
}: {
  panel: PanelId;
  onKey: (v: string) => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useHorizontalScroll(scrollRef);
  // Always call useTap unconditionally (hooks rule); fallback is a no-op
  const upTap = useTap(onScrollUp ?? (() => {}));
  const downTap = useTap(onScrollDown ?? (() => {}));

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1 overflow-x-hidden border-b border-border px-2 py-1.5 [touch-action:none]"
    >
      {panel === "tmux" && (
        <>
          <button
            tabIndex={-1}
            className="flex shrink-0 min-h-[30px] items-center justify-center rounded-sm px-2 py-1.5 text-xs font-medium bg-accent text-foreground active:bg-accent/70"
            {...upTap}
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            tabIndex={-1}
            className="flex shrink-0 min-h-[30px] items-center justify-center rounded-sm px-2 py-1.5 text-xs font-medium bg-accent text-foreground active:bg-accent/70"
            {...downTap}
          >
            <ArrowDown className="size-3.5" />
          </button>
          <Divider />
        </>
      )}
      {panelKeys(panel).map((k) => (
        <Key key={k.label} label={k.label} value={k.value} onKey={onKey} />
      ))}
    </div>
  );
}

function PanelSelectorRow({
  activePanel,
  onSelect,
}: {
  activePanel: PanelId;
  onSelect: (p: PanelId) => void;
}) {
  const PANELS: { id: PanelId; label: string }[] = [
    { id: "tmux", label: "Tmux" },
    { id: "ctrl", label: "Ctrl" },
    { id: "fn",   label: "Fn"   },
  ];
  return (
    <div className="flex items-center gap-1 border-b border-border px-2 py-1">
      {PANELS.map(({ id, label }) => (
        <button
          key={id}
          tabIndex={-1}
          className={`flex shrink-0 min-h-[26px] items-center justify-center rounded-sm px-3 py-0.5 text-xs font-medium [touch-action:manipulation] ${
            id === activePanel
              ? "bg-primary/15 text-primary ring-1 ring-primary/40"
              : "bg-accent text-muted-foreground active:bg-accent/70"
          }`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(id); }}
          onTouchEnd={(e) => { e.preventDefault(); onSelect(id); }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

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
  onScrollUp,
  onScrollDown,
  showKeyboard,
  onKeyboardToggle,
  composingText = "",
}: KeyboardToolbarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useHorizontalScroll(scrollRef);

  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const lastPanelRef = useRef<PanelId>("tmux");

  const togglePanel = useCallback(() => {
    setActivePanel((prev) =>
      prev === null ? lastPanelRef.current : null,
    );
  }, []);

  const selectPanel = useCallback((p: PanelId) => {
    lastPanelRef.current = p;
    setActivePanel(p);
  }, []);

  const send = (value: string) => {
    const { output, consumed } = applyModifiers(value, {
      ctrl: isCtrlActive,
      alt: isAltActive,
      shift: isShiftActive,
    });
    onKey(output);
    for (const mod of consumed) {
      if (mod === "ctrl") onCtrlToggle();
      if (mod === "alt") onAltToggle();
      if (mod === "shift") onShiftToggle();
    }
  };

  return (
    <DevFrame
      name="KeyboardToolbar"
      className="shrink-0 border-t border-border pb-[var(--vvh-safe-bottom,34px)]"
      style={{
        background:
          "linear-gradient(to bottom, var(--card) calc(100% - var(--vvh-safe-bottom, 34px)), var(--background) calc(100% - var(--vvh-safe-bottom, 34px)))",
      }}
    >
      {/*
       * iOS WKWebView hit-region rule:
       * Expandable rows ABOVE main row in DOM → main row Y never changes.
       * New DOM nodes register at correct coords automatically (no refresh needed).
       */}

      {activePanel !== null && (
        <PanelContentRow
          panel={activePanel}
          onKey={onKey}
          onScrollUp={onScrollUp}
          onScrollDown={onScrollDown}
        />
      )}

      {activePanel !== null && (
        <PanelSelectorRow activePanel={activePanel} onSelect={selectPanel} />
      )}

      {/* Main row — always last = always at same Y */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        {onKeyboardToggle && (
          <button
            tabIndex={-1}
            className={`flex shrink-0 min-h-[30px] min-w-[36px] items-center justify-center rounded-sm px-2 py-1.5 text-sm font-medium [touch-action:manipulation] ${
              showKeyboard
                ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                : "bg-accent text-muted-foreground active:bg-accent/70"
            }`}
            onMouseDown={(e) => { e.preventDefault(); onKeyboardToggle(); }}
            onTouchEnd={(e) => { e.preventDefault(); onKeyboardToggle(); }}
          >
            {composingText ? (
              composingText
            ) : showKeyboard ? (
              <span className="opacity-40">가</span>
            ) : (
              <Keyboard className="size-3.5" />
            )}
          </button>
        )}

        {/* Scrollable middle — overflow-x:hidden + touch-action:none for iOS */}
        <div
          ref={scrollRef}
          className="flex flex-1 min-w-0 items-center gap-1 overflow-x-hidden [touch-action:none]"
        >
          <Key label="Ctrl" value="" active={isCtrlActive} onKey={onCtrlToggle} />
          <Key label="Alt"  value="" active={isAltActive}  onKey={onAltToggle}  />
          <Key label="⇧"   value="" active={isShiftActive} onKey={onShiftToggle} />

          <Divider />

          <Key value={ESC.arrowLeft}  icon={<ArrowLeft  className="size-3.5" />} onKey={send} />
          <Key value={ESC.arrowUp}    icon={<ArrowUp    className="size-3.5" />} onKey={send} />
          <Key value={ESC.arrowDown}  icon={<ArrowDown  className="size-3.5" />} onKey={send} />
          <Key value={ESC.arrowRight} icon={<ArrowRight className="size-3.5" />} onKey={send} />

          <Divider />

          <Key label="ESC" value={ESC.escape}    onKey={send} />
          <Key label="Tab" value={ESC.tab}       onKey={send} />
          <Key value={ESC.backspace} icon={<Delete className="size-3.5" />} onKey={send} />

          <Divider />

          {/* Buried symbols — require 3 taps on iOS keyboard (#+=  layer) */}
          <Key label="|"  value="|"  onKey={send} />
          <Key label="~"  value="~"  onKey={send} />
          <Key label="`"  value="`"  onKey={send} />
          <Key label="\"  value="\"  onKey={send} />

          <Divider />

          <Key label="PgU" value={ESC.pageUp}   onKey={send} />
          <Key label="PgD" value={ESC.pageDown} onKey={send} />

          <Divider />

          <Key value="" icon={<Copy          className="size-3.5" />} onKey={() => onCopy()}  />
          <Key value="" icon={<ClipboardPaste className="size-3.5" />} onKey={() => onPaste()} />
        </div>

        {/* Panel expand/collapse */}
        <button
          tabIndex={-1}
          className={`flex shrink-0 min-h-[30px] min-w-[30px] items-center justify-center rounded-sm px-1.5 py-1.5 [touch-action:manipulation] ${
            activePanel !== null
              ? "bg-primary/15 text-primary ring-1 ring-primary/40"
              : "bg-accent text-muted-foreground active:bg-accent/70"
          }`}
          onMouseDown={(e) => { e.preventDefault(); togglePanel(); }}
          onTouchEnd={(e) => { e.preventDefault(); togglePanel(); }}
        >
          {activePanel !== null ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronUp className="size-3.5" />
          )}
        </button>
      </div>
    </DevFrame>
  );
}
