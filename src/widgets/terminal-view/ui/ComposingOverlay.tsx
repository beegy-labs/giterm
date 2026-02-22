interface ComposingOverlayProps {
  composing: string;
}

export function ComposingOverlay({ composing }: ComposingOverlayProps) {
  if (!composing) return null;

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-20 rounded border border-primary/30 bg-card px-2 py-1 text-sm font-medium text-primary shadow-sm">
      {composing}
    </div>
  );
}
