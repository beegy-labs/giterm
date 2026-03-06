/**
 * MobileScreen — iOS full-screen layout SSOT
 *
 * Encapsulates the mobile safe-area pattern:
 * - Outer container: no safe-area padding (extends behind Dynamic Island)
 * - Header/bar absorbs safe area so background fills behind status bar
 *
 * Usage:
 *   <MobileScreen name="ConnectionList">        ← DEV: shows frame label
 *     <MobileScreen.Header name="Header">...</MobileScreen.Header>
 *     <MobileScreen.Bar name="TabBar">...</MobileScreen.Bar>
 *     <ScrollArea className="flex-1">...</ScrollArea>
 *   </MobileScreen>
 */
import { cn } from "@/shared/lib/utils";
import { DevFrame } from "@/shared/ui/dev-frame";

interface MobileScreenProps {
  children: React.ReactNode;
  className?: string;
  name?: string;
}

function MobileScreen({ children, className, name }: MobileScreenProps) {
  return (
    <DevFrame name={name ?? "MobileScreen"} className={cn("flex flex-1 min-h-0 flex-col overflow-hidden bg-background", className)}>
      {children}
    </DevFrame>
  );
}

/** Page header — absorbs safe area + standard 12px top padding (for Connections-type screens) */
function Header({ children, className, name }: MobileScreenProps) {
  return (
    <DevFrame
      name={name ?? "Header"}
      className={cn("pt-safe-header flex items-center border-b border-border pb-3", className)}
    >
      {children}
    </DevFrame>
  );
}

/** Compact bar — absorbs safe area only (for tab bars, toolbars) */
function Bar({ children, className, name }: MobileScreenProps) {
  return (
    <DevFrame
      name={name ?? "Bar"}
      className={cn("pt-safe-bar flex shrink-0 items-center border-b border-border", className)}
    >
      {children}
    </DevFrame>
  );
}

MobileScreen.Header = Header;
MobileScreen.Bar = Bar;

export { MobileScreen };
