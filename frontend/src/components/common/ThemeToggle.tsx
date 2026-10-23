import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: "pill" | "icon";
}

export default function ThemeToggle({
  className = "",
  showLabel = false,
  variant = "pill",
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (variant === "icon" && !showLabel) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={isDark ? "Chuyển sang giao diện Sáng (Light Mode)" : "Chuyển sang giao diện Tối (Obsidian Dark)"}
        aria-label="Chuyển đổi giao diện Sáng/Tối"
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer select-none ${
          isDark
            ? "bg-[#121a2d] border-slate-800/80 text-indigo-400 hover:border-indigo-500/40 hover:bg-slate-800/80 shadow-sm shadow-indigo-500/10"
            : "bg-white border-slate-200 text-amber-500 hover:border-slate-300 hover:bg-slate-50 shadow-sm"
        } ${className}`}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-indigo-400 transition-transform duration-300 rotate-0" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500 transition-transform duration-300 rotate-0" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Chuyển sang chế độ Sáng (Light Mode)" : "Chuyển sang chế độ Tối (Obsidian Dark)"}
      aria-label="Chuyển đổi giao diện Sáng/Tối"
      className={`group relative inline-flex items-center gap-2 rounded-full border p-1 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer select-none ${
        isDark
          ? "bg-[#121a2d] border-slate-800/90 hover:border-indigo-500/40 shadow-inner"
          : "bg-slate-100 border-slate-200/90 hover:border-slate-300 shadow-inner"
      } ${showLabel ? "pr-3" : ""} ${className}`}
    >
      <div className="relative flex items-center gap-1">
        {/* Sun Indicator (Light Mode) */}
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ${
            !isDark
              ? "bg-white text-amber-500 shadow-sm scale-100 rotate-0"
              : "text-slate-500 scale-90 -rotate-45 opacity-60 group-hover:opacity-90"
          }`}
        >
          <Sun className="h-3.5 w-3.5" />
        </span>

        {/* Moon Indicator (Dark Obsidian Mode) */}
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ${
            isDark
              ? "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40 shadow-sm shadow-indigo-500/20 scale-100 rotate-0"
              : "text-slate-400 scale-90 rotate-45 opacity-60 group-hover:opacity-90"
          }`}
        >
          <Moon className="h-3.5 w-3.5" />
        </span>
      </div>

      {showLabel && (
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
          {isDark ? "Tối" : "Sáng"}
        </span>
      )}
    </button>
  );
}
