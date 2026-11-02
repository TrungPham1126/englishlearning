import React from "react";
import {
  Calendar,
  Plus,
  Clock,
  Edit3,
  Trash2,
  FileText,
  CheckCircle,
  X,
  BookOpen,
  Archive,
  Video,
  FileQuestion,
  Headphones,
  Download,
  Eye,
  ChevronRight,
} from "lucide-react";
import type { DailyPlanItem, GlobalResourceItem } from "./dailyPlanTypes";

interface DailyPlanTimelineProps {
  plans: DailyPlanItem[];
  classAssignments?: any[];
  globalResources: GlobalResourceItem[];
  loading: boolean;
  onCreateAssignment: () => void;
  onCreateDay: () => void;
  onEditDay: (p: DailyPlanItem) => void;
  onDeleteDay: (planId: string, dayNum: number) => void;
  onOpenAddItem: (planId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onViewAssignment?: (assignmentId: string) => void;
  onEditAssignment?: (assignmentId: string) => void;
  onDeleteAssignment?: (assignmentId: string, title?: string) => void;
}

export const DailyPlanTimeline: React.FC<DailyPlanTimelineProps> = ({
  plans,
  classAssignments = [],
  globalResources,
  loading,
  onCreateAssignment,
  onCreateDay,
  onEditDay,
  onDeleteDay,
  onOpenAddItem,
  onDeleteItem,
  onViewAssignment,
  onEditAssignment,
  onDeleteAssignment,
}) => {
  const [expandedDays, setExpandedDays] = React.useState<Set<string>>(new Set());
  const toggleDay = (id: string) =>
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const getPlanItems = (p: DailyPlanItem) => {
    const map = new Map<string, any>();
    (p.items || []).forEach((it: any) => {
      const a = it.assignment || classAssignments?.find((ca: any) => ca.id === it.assignmentId);
      const key = it.assignmentId || it.assignment?.id || it.id;
      if (key) {
        map.set(key, {
          id: it.id,
          assignmentId: it.assignmentId || it.assignment?.id,
          assignment: a,
          title: a?.title || it.title,
          sectionName: it.sectionName || (a?.skillType ? `Kỹ năng ${a.skillType}` : "Bài tập ngày"),
          itemType: it.itemType || a?.skillType || "ASSIGNMENT",
          raw: a || it,
        });
      }
    });

    if (classAssignments && classAssignments.length > 0) {
      classAssignments.forEach((ca: any) => {
        const matchDate = ca.dueDate && p.scheduledDate && ca.dueDate.startsWith(p.scheduledDate);
        const matchTitle =
          ca.title &&
          p.dayNumber &&
          (ca.title.toLowerCase().includes(`day ${p.dayNumber}`) ||
            ca.title.toLowerCase().includes(`ngày ${p.dayNumber}`));
        if ((matchDate || matchTitle) && !map.has(ca.id)) {
          map.set(ca.id, {
            id: ca.id,
            assignmentId: ca.id,
            assignment: ca,
            title: ca.title,
            sectionName: `Kỹ năng ${ca.skillType || "Bài tập"}`,
            itemType: ca.skillType || "ASSIGNMENT",
            raw: ca,
          });
        }
      });
    }

    return Array.from(map.values());
  };

  const getResourceIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case "VIDEO":
        return <Video className="h-6 w-6 text-rose-400" />;
      case "EXAM":
        return <FileQuestion className="h-6 w-6 text-amber-400" />;
      case "AUDIO":
        return <Headphones className="h-6 w-6 text-emerald-400" />;
      case "PDF":
        return <FileText className="h-6 w-6 text-red-400" />;
      default:
        return <FileText className="h-6 w-6 text-blue-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in zoom-in-95 duration-300">
      {/* CỘT TRÁI: Lộ trình học */}
      <div className="lg:col-span-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-700 dark:text-blue-400" />
            Lịch Học & Nhiệm Vụ ({plans.length} ngày)
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={onCreateAssignment}
              className="flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1" /> Tạo Bài Tập Mới (AI / Tài Liệu)
            </button>
            <button
              onClick={onCreateDay}
              className="flex items-center px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1" /> Thêm Ngày Mới
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center text-slate-500">
            Đang tải lộ trình học tập...
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center text-slate-500">
            Chưa có lịch học hàng ngày nào. Bấm nút <b>Thêm Ngày Mới</b> để bắt đầu tạo lộ trình!
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3 shadow-sm"
              >
                <div
                  className={`flex items-center justify-between ${expandedDays.has(p.id) ? "border-b border-slate-100 dark:border-slate-800/80 pb-3" : ""}`}
                >
                  <div
                    className="flex items-center space-x-2.5 cursor-pointer select-none flex-1"
                    onClick={() => toggleDay(p.id)}
                    role="button"
                    aria-expanded={expandedDays.has(p.id)}
                  >
                    <ChevronRight
                      className={`h-4 w-4 text-slate-500 shrink-0 transition-transform duration-200 ${expandedDays.has(p.id) ? "rotate-90" : ""}`}
                    />
                    <span className="rounded-md bg-blue-600/10 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-400 border border-blue-600/20">
                      Day {p.dayNumber}
                    </span>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                      {p.title}
                    </h3>
                    {!expandedDays.has(p.id) && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        ({getPlanItems(p).length} bài)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-xs space-x-3">
                    <span className="flex items-center text-slate-500 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      {p.estimatedMinutes} phút
                    </span>
                    <span className="flex items-center rounded bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Hạn mở: {p.scheduledDate}
                    </span>

                    {/* Nút thao tác Sửa / Xóa / Thêm bài */}
                    <div className="flex items-center space-x-1 pl-2">
                      <button
                        onClick={() => onEditDay(p)}
                        title="Sửa thông tin Day"
                        className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white transition rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDeleteDay(p.id, p.dayNumber)}
                        title="Xóa Day"
                        className="p-1 text-rose-500 dark:text-rose-400 hover:text-rose-600 transition rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Danh sách bài tập / tài liệu trong ngày */}
                {expandedDays.has(p.id) && (
                <div className="space-y-2 pt-1">
                  {(() => {
                    const resolvedItems = getPlanItems(p);
                    if (resolvedItems.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 italic py-1">
                          Chưa có bài tập nào được gắn vào ngày này.
                        </p>
                      );
                    }
                    return resolvedItems.map((item, i) => (
                      <div
                        key={item.id || item.assignmentId || i}
                        className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-[#162033] px-3.5 py-2 text-xs border border-slate-200 dark:border-slate-800/60"
                      >
                        <div className="flex items-center space-x-2.5">
                          {item.itemType === "DOCUMENT" ? (
                            <FileText className="h-4 w-4 text-blue-700 dark:text-blue-400 shrink-0" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                          )}
                          <span className="text-slate-800 dark:text-slate-200 font-medium">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                            {item.sectionName}
                          </span>
                          {(item.assignmentId || item.assignment?.id) && (
                            <>
                              <button
                                type="button"
                                onClick={() => onViewAssignment?.(item.assignment || item.assignmentId || item.raw)}
                                className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition p-1 cursor-pointer"
                                title="Xem đề bài & câu hỏi"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditAssignment?.(item.assignment || item.assignmentId || item.raw)}
                                className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition p-1 cursor-pointer"
                                title="Chỉnh sửa toàn diện bài tập này"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteAssignment?.(item.assignmentId || item.id, item.title)}
                                className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition p-1 cursor-pointer"
                                title="Xóa vĩnh viễn bài tập này"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {item.id && !item.assignmentId && (
                            <button
                              type="button"
                              onClick={() => onDeleteItem(item.id)}
                              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1 cursor-pointer"
                              title="Gỡ khỏi ngày này"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ));
                  })()}

                  <button
                    onClick={() => onOpenAddItem(p.id)}
                    className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-blue-600 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm bài tập / tài liệu vào Day {p.dayNumber}
                  </button>
                </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CỘT PHẢI: Kho tài liệu */}
      <div className="lg:col-span-4 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
          <BookOpen className="h-5 w-5 mr-2 text-blue-700 dark:text-blue-400" />
          Kho Tài Liệu Chung
        </h2>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3 shadow-sm">
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {globalResources.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <Archive className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Chưa có tài liệu nào trong kho.</p>
              </div>
            ) : (
              globalResources.map((res) => (
                <div
                  key={res.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#162033] p-3.5 hover:border-blue-600/50"
                >
                  <div className="flex items-start space-x-3 mb-3">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      {getResourceIcon(res.resourceType)}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs line-clamp-2">
                        {res.name}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase">
                        {res.resourceType} • {res.fileSize}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    {res.url && (
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 font-semibold text-[11px] flex items-center"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Xem / Tải về
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
