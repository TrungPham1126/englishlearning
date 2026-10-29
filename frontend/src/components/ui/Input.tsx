// src/components/ui/Input.tsx
import React, { forwardRef, useId } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      id: customId,
      label,
      helperText,
      error,
      startIcon,
      endIcon,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = customId || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startIcon && (
            <span className="pointer-events-none absolute left-3 flex items-center text-slate-500 dark:text-slate-400">
              {startIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              "w-full rounded-md border bg-white dark:bg-[#0b1120] py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
              startIcon ? "pl-9" : "pl-3",
              endIcon ? "pr-9" : "pr-3",
              error
                ? "border-rose-400 dark:border-rose-500/70 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                : "border-slate-300 dark:border-slate-700/80 focus:border-blue-700 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-600/20",
              className,
            )}
            {...props}
          />
          {endIcon && (
            <span className="absolute right-3 flex items-center text-slate-500 dark:text-slate-400">
              {endIcon}
            </span>
          )}
        </div>
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

Input.displayName = "Input";
