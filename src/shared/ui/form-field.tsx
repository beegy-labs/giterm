import type { ReactNode } from "react";
import { Label } from "./label";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  /** Error message. Pass "" to reserve space (invisible). Pass undefined to hide slot entirely. */
  error?: string;
  labelClassName?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  labelClassName = "pt-2 text-right",
  children,
}: FormFieldProps) {
  return (
    <div className="grid grid-cols-4 items-start gap-4">
      <Label htmlFor={htmlFor} className={labelClassName}>
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
