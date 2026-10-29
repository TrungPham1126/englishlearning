// src/components/ui/Dropdown.tsx
import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function Dropdown({
  trigger,
  children,
  align = "right",
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute mt-2 min-w-[200px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1526] p-1 text-slate-900 dark:text-slate-100 shadow-elevated z-50 animate-in fade-in zoom-in-95 duration-100",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  className,
  children,
  onClick,
  destructive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { destructive?: boolean }) {
  return (
    <div
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer select-none",
        destructive
          ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownSeparator() {
  return (
    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800/80 -mx-1" />
  );
}
