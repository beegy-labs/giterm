import type { ReactNode } from "react";
import { Label } from "./label";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  /** Truthy string = red border on child input. Empty/undefined = no error. */
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
  const errorClass = error
    ? "[&_input]:border-destructive [&_input]:ring-destructive/20 [&_[data-slot=select-trigger]]:border-destructive"
    : "";

  if (layout === "horizontal") {
    return (
      <div className="grid grid-cols-4 items-start gap-4">
        <Label htmlFor={htmlFor} className={labelClassName ?? "pt-2 text-right"}>
          {label}
        </Label>
        <div className={`col-span-3 ${errorClass}`}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${errorClass}`}>
      <Label htmlFor={htmlFor} className={labelClassName}>
        {label}
      </Label>
      {children}
    </div>
  );
}
