import React from "react";
import { Shield, Settings2, DatabaseZap, Trash2 } from "lucide-react";
import type { UserSummaryDto } from "@/types/api";

interface ClassroomSettingsTabProps {
  classroomStatus?: string;
  teachers: UserSummaryDto[];
  selectedTeacherId: string;
  setSelectedTeacherId: (val: string) => void;
  newStatus: string;
  setNewStatus: (val: string) => void;
  isProcessing: boolean;
  onAssignTeacher: () => void;
  onUpdateStatus: () => void;
  onOpenPurgeSubmissions?: () => void;
  onOpenDeleteClassroom?: () => void;
}

export const ClassroomSettingsTab: React.FC<ClassroomSettingsTabProps> = ({
  classroomStatus,
  teachers,
  selectedTeacherId,
  setSelectedTeacherId,
  newStatus,
  setNewStatus,
  isProcessing,
  onAssignTeacher,
  onUpdateStatus,
  onOpenPurgeSubmissions,
  onOpenDeleteClassroom,
}) => {
  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
          <Shield size={18} className="text-blue-700 dark:text-blue-400" /> Phân công giảng viên
        </h3>
        <select
          value={selectedTeacherId}
          onChange={(e) => setSelectedTeacherId(e.target.value)}
          className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950"
        >
          <option value="">-- Chọn giảng viên --</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.firstName} {t.lastName} ({t.email})
            </option>
          ))}
        </select>
        <button
          onClick={onAssignTeacher}
          disabled={isProcessing || !selectedTeacherId}
          className="w-full py-3 bg-blue-800 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer transition disabled:opacity-50"
        >
          Lưu
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
          <Settings2 size={18} className="text-blue-700 dark:text-blue-400" /> Trạng thái lớp
        </h3>
        <select
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950"
        >
          <option value="PLANNING">Kế hoạch (PLANNING)</option>
          <option value="OPEN">Tuyển sinh (OPEN)</option>
          <option value="IN_PROGRESS">Đang học (IN_PROGRESS)</option>
          <option value="COMPLETED">Kết thúc (COMPLETED)</option>
          <option value="CANCELLED">Đã hủy (CANCELLED)</option>
        </select>
        <button
          onClick={onUpdateStatus}
          disabled={isProcessing || !newStatus}
          className="w-full py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition disabled:opacity-50"
        >
          Lưu
        </button>
      </div>
    </div>

    {(onOpenPurgeSubmissions || onOpenDeleteClassroom) && (
      <div className="bg-rose-50/50 dark:bg-rose-950/15 p-6 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-rose-200/70 dark:border-rose-900/50 pb-3">
          <div>
            <h3 className="font-black text-rose-900 dark:text-rose-200">
              Dữ liệu &amp; Xóa lớp
            </h3>
            <p className="text-xs text-rose-700/80 dark:text-rose-300/80 mt-0.5">
              Trạng thái: {classroomStatus || "COMPLETED"} · Thao tác không thể hoàn tác.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {onOpenPurgeSubmissions && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={onOpenPurgeSubmissions}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
            >
              <DatabaseZap size={16} /> Xóa dữ liệu bài làm
            </button>
          )}

          {onOpenDeleteClassroom && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={onOpenDeleteClassroom}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
            >
              <Trash2 size={16} /> Xóa vĩnh viễn lớp
            </button>
          )}
        </div>
      </div>
    )}
    </div>
  );
};

export default ClassroomSettingsTab;
