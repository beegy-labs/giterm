import type { ReactNode } from "react";
import { Label } from "./label";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  /** Error message. Pass "" to reserve space (invisible). Pass undefined to hide slot entirely. */
  error?: string;
  /** "vertical" = stacked label+input (mobile-friendly default).
   *  "horizontal" = 4-col grid label | input (compact dialogs). */
  layout?: "vertical" | "horizontal";
  labelClassName?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  layout = "vertical",
  labelClassName,
  children,
}: FormFieldProps) {
  if (layout === "horizontal") {
    return (
      <div className="grid grid-cols-4 items-start gap-4">
        <Label htmlFor={htmlFor} className={labelClassName ?? "pt-2 text-right"}>
          {label}
        </Label>
        <div className="col-span-3">
          {children}
          {error !== undefined && (
            <p className={`mt-1 text-xs text-destructive ${!error ? "invisible" : ""}`}>
              {error || "\u00A0"}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className={labelClassName}>
        {label}
      </Label>
      {children}
      {error !== undefined && (
        <p className={`text-xs text-destructive ${!error ? "invisible" : ""}`}>
          {error || "\u00A0"}
        </p>
      )}
    </div>
  );
}
