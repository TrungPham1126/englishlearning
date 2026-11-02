import React from "react";
import { Shield, Settings2 } from "lucide-react";
import type { UserSummaryDto } from "@/types/api";

interface ClassroomSettingsTabProps {
  teachers: UserSummaryDto[];
  selectedTeacherId: string;
  setSelectedTeacherId: (val: string) => void;
  newStatus: string;
  setNewStatus: (val: string) => void;
  isProcessing: boolean;
  onAssignTeacher: () => void;
  onUpdateStatus: () => void;
}

export const ClassroomSettingsTab: React.FC<ClassroomSettingsTabProps> = ({
  teachers,
  selectedTeacherId,
  setSelectedTeacherId,
  newStatus,
  setNewStatus,
  isProcessing,
  onAssignTeacher,
  onUpdateStatus,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
          <Shield size={18} className="text-blue-700 dark:text-blue-400" /> Phân công Giảng viên
        </h3>
        <select
          value={selectedTeacherId}
          onChange={(e) => setSelectedTeacherId(e.target.value)}
          className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950"
        >
          <option value="">-- Chọn giảng viên phụ trách --</option>
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
          Lưu Giảng Viên
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
          <Settings2 size={18} className="text-blue-700 dark:text-blue-400" /> Đổi trạng thái Lớp
        </h3>
        <select
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950"
        >
          <option value="PLANNING">Lên kế hoạch (PLANNING)</option>
          <option value="OPEN">Mở đăng ký (OPEN)</option>
          <option value="IN_PROGRESS">Đang giảng dạy (IN_PROGRESS)</option>
          <option value="COMPLETED">Đã kết thúc (COMPLETED)</option>
          <option value="CANCELLED">Hủy bỏ (CANCELLED)</option>
        </select>
        <button
          onClick={onUpdateStatus}
          disabled={isProcessing || !newStatus}
          className="w-full py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-bold cursor-pointer transition disabled:opacity-50"
        >
          Lưu Trạng Thái
        </button>
      </div>
    </div>
  );
};

export default ClassroomSettingsTab;
