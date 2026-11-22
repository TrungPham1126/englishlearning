import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Cloud,
  FileSpreadsheet,
  ArrowRight,
  HardDrive,
  DollarSign,
  DatabaseZap,
  Eye,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import type {
  ClassroomDetailedReport,
  ClassroomResponse,
  R2CostReport,
} from "@/features/admin/types";
import { ClassroomReportPreviewModal } from "./ClassroomReportPreviewModal";

interface ReportsR2AndClassExportWidgetProps {
  classes: ClassroomResponse[];
}

const CENTER_SHEETS = [
  "Tong_Quan_Trung_Tam",
  "Danh_Sach_Lop_Hoc",
  "Doi_Ngu_Giang_Vien",
  "Luu_Tru_Cloud_R2",
];

const CLASS_SHEETS = [
  "Tong_Quan_Lop",
  "Danh_Sach_Hoc_Vien",
  "Chi_Tiet_Bai_Nop_Thi",
];

export const ReportsR2AndClassExportWidget: React.FC<
  ReportsR2AndClassExportWidgetProps
> = ({ classes }) => {
  const navigate = useNavigate();
  const [r2Report, setR2Report] = useState<R2CostReport | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || "",
  );
  const [exportingClass, setExportingClass] = useState(false);
  const [exportingCenter, setExportingCenter] = useState(false);
  const [previewReport, setPreviewReport] =
    useState<ClassroomDetailedReport | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || null,
    [classes, selectedClassId],
  );

  const handleExportCenterExcel = async () => {
    setExportingCenter(true);
    setFeedback(null);
    try {
      await adminApi.downloadCenterReportExcel();
      setFeedback({
        type: "success",
        text: "Đã xuất Excel trung tâm (.xlsx).",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text:
          err?.response?.data?.message ||
          "Xuất Excel trung tâm thất bại.",
      });
    } finally {
      setExportingCenter(false);
    }
  };

  const handleExportClassExcel = async (
    targetId = selectedClassId,
    targetName = selectedClass?.name,
  ) => {
    if (!targetId) return;
    setExportingClass(true);
    setFeedback(null);
    try {
      await adminApi.downloadClassroomReportExcel(targetId, targetName);
      setFeedback({
        type: "success",
        text: `Đã xuất Excel lớp "${targetName || targetId}".`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text:
          err?.response?.data?.message ||
          "Xuất Excel lớp thất bại.",
      });
    } finally {
      setExportingClass(false);
    }
  };

  const handlePreviewClass = async () => {
    if (!selectedClassId) return;
    setPreviewLoading(true);
    setPreviewReport(null);
    setFeedback(null);
    try {
      const res = await adminApi.getClassroomDetailedReport(selectedClassId);
      setPreviewReport(res);
    } catch (err: any) {
      setFeedback({
        type: "error",
        text:
          err?.response?.data?.message ||
          "Tải xem trước thất bại.",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const storagePercent = Math.min(
    100,
    Math.max(0, r2Report?.freeTierUsagePercent ?? 0),
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        {/* Cloud R2 Cost Summary Card */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-5">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Cloud size={18} className="text-sky-600 dark:text-sky-400" />
                Lưu trữ &amp; Chi phí R2
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {r2Report
                  ? `${r2Report.liveConnected ? "Live" : "Ước tính DB"} • ${r2Report.bucketName}`
                  : "Đang tải..."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/admin/database?tab=r2")}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 hover:underline cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md px-1.5 py-1"
            >
              Chi tiết R2 <ArrowRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                <DollarSign size={13} className="text-rose-600 dark:text-rose-400" />{" "}
                Chi phí tháng
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5 tabular-nums">
                ${(r2Report?.totalPayableUsd ?? 0).toFixed(3)}
              </div>
              <div className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold mt-0.5 tabular-nums">
                ≈ {(r2Report?.totalPayableVnd ?? 0).toLocaleString("vi-VN")} ₫
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                <HardDrive size={13} className="text-blue-700 dark:text-blue-400" />{" "}
                Dung lượng
              </div>
              <div className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1.5 tabular-nums">
                {(r2Report?.totalStorageGb ?? 0).toFixed(3)} GB
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                {(r2Report?.totalObjects ?? 0).toLocaleString()} tệp • 10 GB Free
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                <DatabaseZap
                  size={13}
                  className="text-emerald-600 dark:text-emerald-400"
                />{" "}
                Class A / Egress
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5 tabular-nums">
                {(r2Report?.classAOps ?? 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                ops • Egress $0
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Free Tier (10 GB/tháng)
              </span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {storagePercent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden">
              <div
                className={`h-full rounded-md transition-all duration-300 ${
                  storagePercent >= 85
                    ? "bg-rose-600"
                    : storagePercent >= 60
                      ? "bg-amber-500"
                      : "bg-blue-700"
                }`}
                style={{ width: `${Math.max(storagePercent > 0 ? 3 : 0, storagePercent)}%` }}
              />
            </div>

            {r2Report?.categoryBreakdowns &&
              r2Report.categoryBreakdowns.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                  {r2Report.categoryBreakdowns.slice(0, 3).map((cat) => (
                    <div
                      key={cat.categoryKey}
                      className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-[11px]"
                    >
                      <div className="font-bold text-slate-700 dark:text-slate-200 truncate">
                        {cat.label}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                        {cat.objectCount} tệp • {cat.sizeMb.toFixed(1)} MB
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Excel Export Studio Card */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet
                size={18}
                className="text-emerald-600 dark:text-emerald-400"
              />
              Xuất báo cáo Excel (.xlsx)
            </h3>
            <button
              type="button"
              onClick={() => navigate("/admin/database")}
              className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer transition shrink-0"
            >
              Quản trị DB
            </button>
          </div>

          {feedback && (
            <div
              role="status"
              className={`px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
                feedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 size={15} className="shrink-0" />
              ) : (
                <AlertCircle size={15} className="shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Block 1: Center-wide 4-sheet Excel export */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers size={14} className="text-blue-700 dark:text-blue-400" />
                Báo cáo trung tâm (4 sheet)
              </h4>
              <button
                type="button"
                disabled={exportingCenter}
                onClick={handleExportCenterExcel}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50 shrink-0"
              >
                {exportingCenter ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {exportingCenter
                  ? "Đang xuất..."
                  : "Xuất Excel trung tâm"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CENTER_SHEETS.map((sheetName) => (
                <span
                  key={sheetName}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  {sheetName}
                </span>
              ))}
            </div>
          </div>

          {/* Block 2: Per-classroom 3-sheet Excel export */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="report-class-select"
                className="text-xs font-extrabold text-slate-900 dark:text-white"
              >
                Báo cáo theo lớp (3 sheet)
              </label>
              <div className="hidden sm:flex flex-wrap gap-1">
                {CLASS_SHEETS.map((s) => (
                  <span
                    key={s}
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <select
              id="report-class-select"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#0b0f17] outline-none focus:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {classes.length === 0 ? (
                <option value="">Chưa có lớp</option>
              ) : (
                classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                    {cls.level ? ` (${cls.level}` : ""}
                    {cls.status ? ` - ${cls.status})` : cls.level ? ")" : ""}
                  </option>
                ))
              )}
            </select>

            {selectedClass && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                <span>
                  Level:{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {selectedClass.level || "-"}
                  </strong>
                </span>
                <span>
                  GV:{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {selectedClass.teacherName || "Chưa gán"}
                  </strong>
                </span>
                <span>
                  Sĩ số:{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {selectedClass.currentStudentsCount ?? 0}
                    {selectedClass.maxStudents
                      ? `/${selectedClass.maxStudents}`
                      : ""}{" "}
                    HV
                  </strong>
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={!selectedClassId || previewLoading}
                onClick={handlePreviewClass}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer transition disabled:opacity-50"
              >
                {previewLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Eye size={14} />
                )}
                Xem trước
              </button>

              <button
                type="button"
                disabled={!selectedClassId || exportingClass}
                onClick={() => handleExportClassExcel()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
              >
                {exportingClass ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={15} />
                )}
                {exportingClass
                  ? "Đang xuất..."
                  : "Xuất Excel lớp"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ClassroomReportPreviewModal
        report={previewReport}
        loading={previewLoading}
        exporting={exportingClass}
        onClose={() => {
          setPreviewReport(null);
          setPreviewLoading(false);
        }}
        onDownloadExcel={(classId, className) =>
          handleExportClassExcel(classId, className)
        }
      />
    </>
  );
};

export default ReportsR2AndClassExportWidget;
