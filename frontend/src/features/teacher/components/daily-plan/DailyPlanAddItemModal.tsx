import React from "react";
import { X } from "lucide-react";

interface DailyPlanAddItemModalProps {
  isOpen: boolean;
  classAssignments: any[];
  selectedResourceType: "ASSIGNMENT" | "DOCUMENT";
  setSelectedResourceType: (t: "ASSIGNMENT" | "DOCUMENT") => void;
  itemSectionName: string;
  setItemSectionName: (s: string) => void;
  selectedAssignmentId: string;
  setSelectedAssignmentId: (id: string) => void;
  itemTitle: string;
  setItemTitle: (t: string) => void;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
}

export const DailyPlanAddItemModal: React.FC<DailyPlanAddItemModalProps> = ({
  isOpen,
  classAssignments,
  selectedResourceType,
  setSelectedResourceType,
  itemSectionName,
  setItemSectionName,
  selectedAssignmentId,
  setSelectedAssignmentId,
  itemTitle,
  setItemTitle,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-elevated space-y-4 text-slate-900 dark:text-slate-100">
        <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Gắn Bài Tập / Nội Dung vào Ngày Học
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-4 text-xs">
          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
              Loại nội dung:
            </label>
            <select
              value={selectedResourceType}
              onChange={(e) =>
                setSelectedResourceType(e.target.value as "ASSIGNMENT" | "DOCUMENT")
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-2.5 text-slate-900 dark:text-white outline-none focus:border-blue-600"
            >
              <option value="ASSIGNMENT">Bài Tập Từ Lớp Học (Assignment)</option>
              <option value="DOCUMENT">Tài Liệu Đính Kèm (Document)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
              Tên mục / Section:
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Bài tập Listening, Tài liệu đính kèm..."
              value={itemSectionName}
              onChange={(e) => setItemSectionName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-2.5 text-slate-900 dark:text-white outline-none focus:border-blue-600"
              required
            />
          </div>

          {selectedResourceType === "ASSIGNMENT" ? (
            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                Chọn Bài Tập Đã Tạo Trong Lớp:
              </label>
              {classAssignments.length === 0 ? (
                <p className="text-amber-600 dark:text-amber-400 text-xs italic">
                  Lớp này chưa có bài tập nào. Hãy vào mục Quản lý bài tập để tạo trước!
                </p>
              ) : (
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-2.5 text-slate-900 dark:text-white outline-none focus:border-blue-600"
                >
                  {classAssignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.type || "ASSIGNMENT"}] {a.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                Tiêu đề tài liệu:
              </label>
              <input
                type="text"
                placeholder="Ví dụ: File Audio Luyện Nghe IELTS"
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-2.5 text-slate-900 dark:text-white outline-none focus:border-blue-600"
                required
              />
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-800 px-5 py-2 font-semibold text-white hover:bg-blue-600 cursor-pointer shadow-sm"
            >
              Gắn Vào Ngày Học
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
