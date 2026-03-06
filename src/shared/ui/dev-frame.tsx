/**
 * DevFrame — DEV-only component frame overlay.
 *
 * Wraps children with a labeled red border to visualize component boundaries.
 * In production builds (import.meta.env.DEV === false) renders children directly
 * with no extra DOM nodes.
 *
 * Usage:
 *   <DevFrame name="KeyboardToolbar" className="...same classes as original root div...">
 *     {children}
 *   </DevFrame>
 *
 * Toggle off in console: window.__devFrames = false; location.reload()
 * Toggle on  in console: window.__devFrames = true;  location.reload()
 */
import { cn } from "@/shared/lib/utils";

interface DevFrameProps {
  name: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const IS_DEV = import.meta.env.DEV;

const LABEL_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  zIndex: 9999,
  background: "rgba(220, 80, 80, 0.85)",
  color: "#fff",
  fontSize: "9px",
  fontFamily: "monospace",
  lineHeight: 1,
  padding: "1px 4px",
  pointerEvents: "none",
  whiteSpace: "nowrap",
  borderBottomRightRadius: "3px",
};

export function DevFrame({ name, children, className, style }: DevFrameProps) {
  if (!IS_DEV) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn("relative", className)}
      style={{
        ...style,
        outline: "1px solid rgba(220, 80, 80, 0.5)",
      }}
    >
      <span style={LABEL_STYLE}>{name}</span>
      {children}
    </div>
  );
}
