import { Minus, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useTerminalSettingsStore } from "@/entities/session/model/terminalSettingsStore";

export function FontSizeControls() {
  const fontSize = useTerminalSettingsStore((s) => s.fontSize);
  const increase = useTerminalSettingsStore((s) => s.increase);
  const decrease = useTerminalSettingsStore((s) => s.decrease);

  return (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-sm bg-card/80 px-1 py-0.5 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
      <Button variant="ghost" size="icon-xs" onClick={decrease}>
        <Minus className="size-3" />
      </Button>
      <span className="min-w-6 text-center text-xs text-muted-foreground">
        {fontSize}
      </span>
      <Button variant="ghost" size="icon-xs" onClick={increase}>
        <Plus className="size-3" />
      </Button>
    </div>
  );
}
