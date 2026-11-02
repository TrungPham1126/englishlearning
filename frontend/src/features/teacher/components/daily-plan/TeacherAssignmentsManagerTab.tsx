import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Plus,
  Clock,
  Percent,
  RotateCcw,
  Calendar,
  Edit3,
  Trash2,
  Eye,
  Headphones,
  Mic,
  BookOpen,
  FileText,
  CheckCircle2,
  HelpCircle,
  Inbox,
} from "lucide-react";
import type { DailyPlanItem } from "./dailyPlanTypes";

export interface TeacherAssignmentsManagerTabProps {
  plans: DailyPlanItem[];
  classAssignments: any[];
  onCreateAssignment: () => void;
  onEditAssignment: (assignment: any) => void;
  onDeleteAssignment: (assignmentId: string, title?: string) => void;
  onViewAssignment: (assignment: any) => void;
}

export const TeacherAssignmentsManagerTab: React.FC<TeacherAssignmentsManagerTabProps> = ({
  plans,
  classAssignments,
  onCreateAssignment,
  onEditAssignment,
  onDeleteAssignment,
  onViewAssignment,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string>("ALL");
  const [selectedDayId, setSelectedDayId] = useState<string>("ALL");

  // Map assignmentId -> Plan info (Day number & scheduledDate)
  const assignmentDayMap = useMemo(() => {
    const map = new Map<string, { dayNumber: number; title: string; scheduledDate: string }>();
    plans.forEach((p) => {
      p.items?.forEach((item) => {
        const aId = item.assignmentId || item.assignment?.id;
        if (aId) {
          map.set(aId, {
            dayNumber: p.dayNumber,
            title: p.title,
            scheduledDate: p.scheduledDate,
          });
        }
      });
    });
    return map;
  }, [plans]);

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return classAssignments.filter((a) => {
      // 1. Search filter
      const matchesSearch =
        !searchTerm.trim() ||
        a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Skill filter
      const skill = (a.skillType || "READING").toUpperCase();
      const matchesSkill = selectedSkill === "ALL" || skill === selectedSkill;

      // 3. Day filter
      const dayInfo = assignmentDayMap.get(a.id);
      const matchesDay =
        selectedDayId === "ALL" ||
        (selectedDayId === "UNASSIGNED" && !dayInfo) ||
        (dayInfo && String(dayInfo.dayNumber) === selectedDayId);

      return matchesSearch && matchesSkill && matchesDay;
    });
  }, [classAssignments, searchTerm, selectedSkill, selectedDayId, assignmentDayMap]);

  const getSkillMeta = (type: string) => {
    switch (type?.toUpperCase()) {
      case "LISTENING":
        return {
          icon: Headphones,
          color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
          label: "Listening",
        };
      case "SPEAKING":
        return {
          icon: Mic,
          color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
          label: "Speaking",
        };
      case "WRITING":
        return {
          icon: Edit3,
          color: "text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
          label: "Writing",
        };
      case "VOCABULARY":
        return {
          icon: BookOpen,
          color: "text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
          label: "Vocabulary",
        };
      case "GRAMMAR":
        return {
          icon: FileText,
          color: "text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
          label: "Grammar",
        };
      default:
        return {
          icon: FileText,
          color: "text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
          label: "Reading",
        };
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Header Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white shadow-xs">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Quản Lý Toàn Bộ Bài Đã Giao
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tổng cộng {classAssignments.length} bài tập • Hiển thị {filteredAssignments.length} bài phù hợp
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreateAssignment}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo Bài Tập Mới</span>
        </button>
      </div>

      {/* 2. Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tiêu đề bài tập hoặc kỹ năng..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Skill & Day Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Skill Filter */}
          <select
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
            className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer outline-none"
          >
            <option value="ALL">Tất cả kỹ năng</option>
            <option value="READING">Đọc hiểu (Reading)</option>
            <option value="LISTENING">Nghe hiểu (Listening)</option>
            <option value="SPEAKING">Nói (Speaking/Shadowing)</option>
            <option value="WRITING">Viết (Writing)</option>
            <option value="VOCABULARY">Từ vựng (Vocabulary)</option>
            <option value="GRAMMAR">Ngữ pháp (Grammar)</option>
          </select>

          {/* Day Filter */}
          <select
            value={selectedDayId}
            onChange={(e) => setSelectedDayId(e.target.value)}
            className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer outline-none"
          >
            <option value="ALL">Tất cả các ngày học</option>
            {plans.map((p) => (
              <option key={p.id} value={String(p.dayNumber)}>
                Day {p.dayNumber} ({p.scheduledDate})
              </option>
            ))}
            <option value="UNASSIGNED">Chưa gắn vào Day</option>
          </select>
        </div>
      </div>

      {/* 3. Danh Sách Bài Tập (Card Grid) */}
      {filteredAssignments.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3">
          <Inbox className="h-10 w-10 mx-auto text-slate-400 opacity-60" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
            Không tìm thấy bài tập nào phù hợp với bộ lọc.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setSelectedSkill("ALL");
              setSelectedDayId("ALL");
            }}
            className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
          >
            Xóa bộ lọc tìm kiếm
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssignments.map((a) => {
            const skill = (a.skillType || "READING").toUpperCase();
            const meta = getSkillMeta(skill);
            const Icon = meta.icon;
            const dayInfo = assignmentDayMap.get(a.id);
            const timeLimit = a.timeLimitMinutes || 30;
            const maxErr =
              a.maxAllowedErrorPercent != null
                ? a.maxAllowedErrorPercent
                : a.passScore != null
                ? Math.max(0, 100 - (a.passScore <= 10 ? a.passScore * 10 : a.passScore))
                : 20;
            const maxAttempts = a.maxAttempts || 3;
            const questionCount = a.questions?.length || 0;

            return (
              <div
                key={a.id}
                className="flex flex-col justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md transition space-y-3"
              >
                {/* Top Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${meta.color}`}>
                      <Icon size={12} />
                      {meta.label}
                    </span>

                    {dayInfo ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Day {dayInfo.dayNumber} ({dayInfo.scheduledDate})
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 italic">
                        Chưa gán Day
                      </span>
                    )}
                  </div>

                  <h3
                    onClick={() => onViewAssignment(a)}
                    className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition"
                    title={a.title}
                  >
                    {a.title}
                  </h3>

                  {a.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {a.description.replace(/\[.*?\]/g, "").trim()}
                    </p>
                  )}
                </div>

                {/* Parameters Pill Grid */}
                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1 font-medium">
                    <Clock size={12} className="text-blue-500 shrink-0" />
                    <span>{timeLimit} phút</span>
                  </div>
                  <div className="flex items-center gap-1 font-medium">
                    <Percent size={12} className="text-amber-500 shrink-0" />
                    <span>Sai ≤ {maxErr}%</span>
                  </div>
                  <div className="flex items-center gap-1 font-medium">
                    <RotateCcw size={12} className="text-blue-500 shrink-0" />
                    <span>Tối đa {maxAttempts} lần</span>
                  </div>
                  <div className="flex items-center gap-1 font-medium">
                    <FileText size={12} className="text-emerald-500 shrink-0" />
                    <span>{questionCount} câu hỏi</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onViewAssignment(a)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>Xem Đề</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onEditAssignment(a)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Sửa Bài</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteAssignment(a.id, a.title)}
                    className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Xóa bài tập này"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeacherAssignmentsManagerTab;
