import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Cloud,
  FileSpreadsheet,
  ArrowRight,
  HardDrive,
  DollarSign,
  DatabaseZap,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { ClassroomResponse, R2CostReport } from "@/features/admin/types";

interface ReportsR2AndClassExportWidgetProps {
  classes: ClassroomResponse[];
}

export const ReportsR2AndClassExportWidget: React.FC<ReportsR2AndClassExportWidgetProps> = ({
  classes,
}) => {
  const navigate = useNavigate();
  const [r2Report, setR2Report] = useState<R2CostReport | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    adminApi
      .getR2CostReport()
      .then((res) => setR2Report(res))
      .catch(() => {});
  }, []);

  const handleExportClassExcel = async () => {
    if (!selectedClassId) return;
    const cls = classes.find((c) => c.id === selectedClassId);
    setExporting(true);
    try {
      await adminApi.downloadClassroomReportExcel(selectedClassId, cls?.name);
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi khi xuất báo cáo Excel lớp học");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
      {/* Cloud R2 Cost Summary Card */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Cloud size={18} className="text-sky-600 dark:text-sky-400" />
              Báo Cáo Lưu Trữ &amp; Chi Tiêu Cloud R2
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {r2Report
                ? `${r2Report.liveConnected ? "Đồng bộ Live Bucket" : "Ước tính từ Database"} • ${r2Report.bucketName}`
                : "Đang tải thống kê lưu trữ Cloudflare R2..."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/database?tab=r2")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
          >
            Xem chi tiết R2 <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <DollarSign size={13} className="text-rose-500" /> Chi Phí Tháng (Net)
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5">
              ${(r2Report?.totalPayableUsd ?? 0).toFixed(3)}
            </div>
            <div className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold mt-0.5">
              ≈ {(r2Report?.totalPayableVnd ?? 0).toLocaleString("vi-VN")} ₫
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <HardDrive size={13} className="text-blue-600" /> Dung Lượng Bucket
            </div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1.5">
              {(r2Report?.totalStorageGb ?? 0).toFixed(3)} GB
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {(r2Report?.totalObjects ?? 0).toLocaleString()} objects / 10 GB Free
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <DatabaseZap size={13} className="text-emerald-600" /> Class A / Egress
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
              {(r2Report?.classAOps ?? 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              ops ghi/list • Egress $0.00
            </div>
          </div>
        </div>
      </div>

      {/* Quick Classroom Detailed Excel Export Card */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            Xuất Báo Cáo Chi Tiết Theo Lớp (.xlsx)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Bao gồm tổng quan lớp, bảng điểm từng học viên và chi tiết bài nộp / gian lận thi.
          </p>
        </div>

        <div className="space-y-3">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 outline-none focus:border-blue-700"
          >
            {classes.length === 0 ? (
              <option value="">Chưa có lớp học nào</option>
            ) : (
              classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.level} - {cls.status})
                </option>
              ))
            )}
          </select>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={!selectedClassId || exporting}
              onClick={handleExportClassExcel}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
            >
              <FileSpreadsheet size={15} />
              {exporting ? "Đang tạo file Excel..." : "Xuất Báo Cáo Lớp (.xlsx)"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/admin/database")}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer transition"
            >
              Quản Lý CSDL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsR2AndClassExportWidget;
