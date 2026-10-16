import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "dark" ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
      aria-label="Toggle theme"
      className={`relative inline-flex items-center justify-center gap-2 p-2 rounded-xl transition-all duration-200 border cursor-pointer select-none ${
        theme === "dark"
          ? "bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700 hover:text-amber-200 shadow-sm shadow-amber-500/10"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900 shadow-sm"
      } ${className}`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 transition-transform duration-300 -rotate-12 hover:rotate-0 text-slate-600" />
      )}
      {showLabel && (
        <span className="text-xs font-semibold">
          {theme === "dark" ? "Chế độ Sáng" : "Chế độ Tối"}
        </span>
      )}
    </button>
  );
}

