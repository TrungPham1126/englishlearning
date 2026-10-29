// src/components/ui/Tabs.tsx
import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (val: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const handleValueChange = (val: string) => {
    if (!isControlled) setInternalValue(val);
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider
      value={{ value: activeValue, onValueChange: handleValueChange }}
    >
      <div className={cn("w-full space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabTrigger({
  value,
  disabled,
  className,
  children,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabTrigger must be used inside Tabs");

  const isSelected = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      disabled={disabled}
      aria-selected={isSelected}
      onClick={() => context.onValueChange(value)}
      className={cn(
        "px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        isSelected
          ? "bg-white dark:bg-[#0e1526] text-blue-800 dark:text-blue-400 font-bold shadow-xs border border-slate-200/80 dark:border-slate-700/80"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabContent must be used inside Tabs");

  if (context.value !== value) return null;

  return (
    <div
      role="tabpanel"
      className={cn("animate-in fade-in-50 duration-150", className)}
    >
      {children}
    </div>
  );
}
