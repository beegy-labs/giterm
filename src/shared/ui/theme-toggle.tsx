import { Sun, Moon } from "lucide-react";
import { Button } from "./button";
import { useTheme, toggleTheme } from "@/shared/lib/useTheme";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={toggleTheme}
      className={className}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="size-3.5" />
      ) : (
        <Moon className="size-3.5" />
      )}
    </Button>
  );
}
