// src/components/layouts/PublicLayout.tsx
import { Outlet } from "react-router-dom";
import { GraduationCap, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";

export default function PublicLayout() {
  return (
    <div className="relative min-h-screen w-full flex flex-col bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Dynamic Background Glow Elements (Subtle) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0 select-none opacity-40 dark:opacity-20"
      >
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/10 dark:bg-blue-600/15 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-blue-600/10 dark:bg-blue-600/15 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 dark:bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Top Sticky Glass Header */}
      <header className="relative z-20 h-16 w-full px-6 lg:px-12 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800/80 bg-white/75 dark:bg-[#070b14]/75 backdrop-blur-md">
        <div className="flex items-center gap-3 select-none">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-800 text-white shadow-sm">
            <GraduationCap size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">
                ELP LEARNING
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50">
                <Sparkles size={11} /> AI EdTech
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nền tảng Học &amp; Đánh giá Năng lực Tiếng Anh Thông minh
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle showLabel />
        </div>
      </header>

      {/* Main Centered Auth Stage */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <Outlet />
      </div>

      {/* Subtle Footer */}
      <footer className="relative z-10 py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-[#070b14]/40 backdrop-blur-sm">
        <span>
          © {new Date().getFullYear()} ELP English Learning Platform • Chuẩn hóa
          CEFR &amp; AI Speech Assessment
        </span>
      </footer>
    </div>
  );
}
