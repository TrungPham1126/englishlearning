// src/components/ui/Textarea.tsx
import React, { forwardRef, useId } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      id: customId,
      label,
      helperText,
      error,
      disabled,
      rows = 4,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const textareaId = customId || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            "w-full rounded-md border bg-white dark:bg-[#0b1120] p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-rose-400 dark:border-rose-500/70 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              : "border-slate-300 dark:border-slate-700/80 focus:border-blue-700 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-600/20",
            className,
          )}
          {...props}
        />
        {error ? (
          <p
            id={errorId}
            className="flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 mt-1"
          >
            <AlertCircle size={13} className="shrink-0" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p
            id={helperId}
            className="text-xs text-slate-500 dark:text-slate-400 mt-1"
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
