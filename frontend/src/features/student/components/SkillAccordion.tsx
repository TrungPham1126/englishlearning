// src/features/student/components/SkillAccordion.tsx
import React from "react";
import {
  BookText,
  Headphones,
  Mic,
  PenTool,
  BookOpen,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

export type SkillCategory =
  | "READING"
  | "LISTENING"
  | "SPEAKING"
  | "WRITING"
  | "VOCABULARY_GRAMMAR";

export interface SkillThemeConfig {
  category: SkillCategory;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  border: string;
  borderHover: string;
  borderActive: string;
  bgHeaderHover: string;
  bgActive: string;
  squircleBg: string;
  squircleBorder: string;
  squircleText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  progressGradient: string;
  progressBarBg: string;
  ctaPrimaryBg: string;
  ctaPrimaryHover: string;
  ctaPrimaryText: string;
  accentGlow: string;
}

export const SKILL_THEMES: Record<SkillCategory, SkillThemeConfig> = {
  READING: {
    category: "READING",
    title: "Đọc",
    subtitle: "",
    icon: BookText,
    border: "border-slate-200/90 dark:border-slate-800",
    borderHover: "hover:border-slate-300 dark:hover:border-slate-700",
    borderActive: "border-amber-500/70 dark:border-amber-500/50",
    bgHeaderHover: "hover:bg-slate-50 dark:hover:bg-slate-800/50",
    bgActive: "bg-amber-50/20 dark:bg-amber-950/10",
    squircleBg: "bg-amber-50 dark:bg-amber-500/10",
    squircleBorder: "border-amber-200/60 dark:border-amber-500/20",
    squircleText: "text-amber-700 dark:text-amber-400",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeBorder: "border-slate-200 dark:border-slate-700",
    badgeText: "text-slate-700 dark:text-slate-300",
    progressGradient: "bg-amber-500",
    progressBarBg: "bg-slate-100 dark:bg-slate-800",
    ctaPrimaryBg: "bg-blue-800 hover:bg-blue-700",
    ctaPrimaryHover: "hover:bg-blue-700",
    ctaPrimaryText: "text-white",
    accentGlow: "shadow-xs",
  },
  LISTENING: {
    category: "LISTENING",
    title: "Nghe",
    subtitle: "",
    icon: Headphones,
    border: "border-slate-200/90 dark:border-slate-800",
    borderHover: "hover:border-slate-300 dark:hover:border-slate-700",
    borderActive: "border-blue-500/70 dark:border-blue-500/50",
    bgHeaderHover: "hover:bg-slate-50 dark:hover:bg-slate-800/50",
    bgActive: "bg-blue-50/20 dark:bg-blue-950/10",
    squircleBg: "bg-blue-50 dark:bg-blue-600/10",
    squircleBorder: "border-blue-200/60 dark:border-blue-600/20",
    squircleText: "text-blue-700 dark:text-blue-400",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeBorder: "border-slate-200 dark:border-slate-700",
    badgeText: "text-slate-700 dark:text-slate-300",
    progressGradient: "bg-blue-800",
    progressBarBg: "bg-slate-100 dark:bg-slate-800",
    ctaPrimaryBg: "bg-blue-800 hover:bg-blue-700",
    ctaPrimaryHover: "hover:bg-blue-700",
    ctaPrimaryText: "text-white",
    accentGlow: "shadow-xs",
  },
  SPEAKING: {
    category: "SPEAKING",
    title: "Nói",
    subtitle: "",
    icon: Mic,
    border: "border-slate-200/90 dark:border-slate-800",
    borderHover: "hover:border-slate-300 dark:hover:border-slate-700",
    borderActive: "border-emerald-500/70 dark:border-emerald-500/50",
    bgHeaderHover: "hover:bg-slate-50 dark:hover:bg-slate-800/50",
    bgActive: "bg-emerald-50/20 dark:bg-emerald-950/10",
    squircleBg: "bg-emerald-50 dark:bg-emerald-500/10",
    squircleBorder: "border-emerald-200/60 dark:border-emerald-500/20",
    squircleText: "text-emerald-700 dark:text-emerald-400",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeBorder: "border-slate-200 dark:border-slate-700",
    badgeText: "text-slate-700 dark:text-slate-300",
    progressGradient: "bg-emerald-600",
    progressBarBg: "bg-slate-100 dark:bg-slate-800",
    ctaPrimaryBg: "bg-emerald-600 hover:bg-emerald-700",
    ctaPrimaryHover: "hover:bg-emerald-700",
    ctaPrimaryText: "text-white",
    accentGlow: "shadow-xs",
  },
  WRITING: {
    category: "WRITING",
    title: "Viết",
    subtitle: "",
    icon: PenTool,
    border: "border-slate-200/90 dark:border-slate-800",
    borderHover: "hover:border-slate-300 dark:hover:border-slate-700",
    borderActive: "border-indigo-500/70 dark:border-indigo-500/50",
    bgHeaderHover: "hover:bg-slate-50 dark:hover:bg-slate-800/50",
    bgActive: "bg-indigo-50/20 dark:bg-indigo-950/10",
    squircleBg: "bg-indigo-50 dark:bg-indigo-500/10",
    squircleBorder: "border-indigo-200/60 dark:border-indigo-500/20",
    squircleText: "text-indigo-700 dark:text-indigo-400",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeBorder: "border-slate-200 dark:border-slate-700",
    badgeText: "text-slate-700 dark:text-slate-300",
    progressGradient: "bg-indigo-600",
    progressBarBg: "bg-slate-100 dark:bg-slate-800",
    ctaPrimaryBg: "bg-indigo-600 hover:bg-indigo-700",
    ctaPrimaryHover: "hover:bg-indigo-700",
    ctaPrimaryText: "text-white",
    accentGlow: "shadow-xs",
  },
  VOCABULARY_GRAMMAR: {
    category: "VOCABULARY_GRAMMAR",
    title: "Từ vựng & Ngữ pháp",
    subtitle: "",
    icon: BookOpen,
    border: "border-slate-200/90 dark:border-slate-800",
    borderHover: "hover:border-slate-300 dark:hover:border-slate-700",
    borderActive: "border-blue-500/70 dark:border-blue-500/50",
    bgHeaderHover: "hover:bg-slate-50 dark:hover:bg-slate-800/50",
    bgActive: "bg-blue-50/20 dark:bg-blue-950/10",
    squircleBg: "bg-blue-50 dark:bg-blue-600/10",
    squircleBorder: "border-blue-200/60 dark:border-blue-600/20",
    squircleText: "text-blue-700 dark:text-blue-400",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeBorder: "border-slate-200 dark:border-slate-700",
    badgeText: "text-slate-700 dark:text-slate-300",
    progressGradient: "bg-blue-800",
    progressBarBg: "bg-slate-100 dark:bg-slate-800",
    ctaPrimaryBg: "bg-blue-800 hover:bg-blue-700",
    ctaPrimaryHover: "hover:bg-blue-700",
    ctaPrimaryText: "text-white",
    accentGlow: "shadow-xs",
  },
};

/**
 * Tự động phân loại kỹ năng dựa vào mã skillType hoặc tiêu đề section
 */
export function detectSkillCategory(raw: string): SkillCategory {
  const upper = (raw || "").toUpperCase();
  if (upper.includes("READING") || upper.includes("ĐỌC")) return "READING";
  if (upper.includes("LISTENING") || upper.includes("NGHE")) return "LISTENING";
  if (
    upper.includes("SPEAKING") ||
    upper.includes("NÓI") ||
    upper.includes("PHÁT ÂM") ||
    upper.includes("SHADOWING") ||
    upper.includes("THOẠI")
  ) {
    return "SPEAKING";
  }
  if (upper.includes("WRITING") || upper.includes("VIẾT") || upper.includes("ESSAY")) {
    return "WRITING";
  }
  return "VOCABULARY_GRAMMAR";
}

/**
 * Phân loại từng bài theo itemType trước (chính xác hơn tên mục),
 * chỉ khi itemType không rõ ràng mới dựa vào tên mục.
 */
export function detectItemCategory(itemType: string | undefined | null, sectionName: string): SkillCategory {
  switch ((itemType || "").toUpperCase()) {
    case "SPEAKING":
    case "PRONUNCIATION":
    case "SHADOWING":
      return "SPEAKING";
    case "LISTENING":
      return "LISTENING";
    case "READING":
      return "READING";
    case "WRITING":
      return "WRITING";
    case "VOCABULARY":
    case "GRAMMAR":
      return "VOCABULARY_GRAMMAR";
    default:
      return detectSkillCategory(sectionName);
  }
}
/**
 * Thanh công cụ điều khiển tổng (Mở tất cả / Thu gọn tất cả)
 */
export interface SkillAccordionToolbarProps {
  totalSkills: number;
  completedTasks: number;
  totalTasks: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  isAllExpanded?: boolean;
}

export const SkillAccordionToolbar: React.FC<SkillAccordionToolbarProps> = ({
  completedTasks,
  totalTasks,
}) => {
  return (
    <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-600 dark:text-slate-400">
      <span>Kỹ năng</span>
      <span className="tabular-nums text-slate-800 dark:text-slate-200">
        {completedTasks}/{totalTasks} xong
      </span>
    </div>
  );
};

/**
 * Thẻ Accordion cho từng nhóm Kỹ Năng (Squircle Header + Expandable Body)
 */
export interface SkillAccordionCardProps {
  category: SkillCategory;
  customTitle?: string;
  customSubtitle?: string;
  totalTasks: number;
  completedTasks: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const SkillAccordionCard: React.FC<SkillAccordionCardProps> = ({
  category,
  customTitle,
  totalTasks,
  completedTasks,
  isExpanded,
  onToggle,
  children,
}) => {
  const theme = SKILL_THEMES[category] || SKILL_THEMES.VOCABULARY_GRAMMAR;
  const Icon = theme.icon;

  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isAllDone = totalTasks > 0 && completedTasks === totalTasks;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden bg-white dark:bg-[#111827] ${
        isExpanded
          ? theme.borderActive
          : `${theme.border} ${theme.borderHover}`
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-left transition-colors duration-200 cursor-pointer select-none ${
          isExpanded ? theme.bgActive : theme.bgHeaderHover
        }`}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${theme.squircleBg} ${theme.squircleBorder} ${theme.squircleText}`}
          >
            <Icon size={15} />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {customTitle || theme.title}
            </h3>
            {isAllDone && (
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className={`hidden sm:block w-16 h-1.5 rounded-full overflow-hidden ${theme.progressBarBg}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${theme.progressGradient}`}
              style={{ width: `${completionPct}%` }}
            />
          </div>

          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border tabular-nums ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText}`}
          >
            {completedTasks}/{totalTasks}
          </span>

          <div
            className={`flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-transform duration-200 ${
              isExpanded ? "rotate-180 bg-slate-200 dark:bg-slate-700" : ""
            }`}
          >
            <ChevronDown size={13} />
          </div>
        </div>
      </button>

      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
