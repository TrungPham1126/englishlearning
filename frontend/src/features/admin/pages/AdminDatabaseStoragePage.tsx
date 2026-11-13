import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Database, Cloud, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import type {
  AdminDatabaseOverview,
  ClassroomDatabaseItem,
  ClassroomDetailedReport,
  R2CostReport,
} from "@/features/admin/types";
import {
  DatabaseManagementTab,
  R2CostReportTab,
  ClassroomReportPreviewModal,
  ClassroomActionConfirmModal,
  type ClassroomDestructiveActionMode,
} from "@/features/admin/components/database";

export default function AdminDatabaseStoragePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "r2" ? "r2" : "database";
  const [activeTab, setActiveTab] = useState<"database" | "r2">(initialTab);

  const [overview, setOverview] = useState<AdminDatabaseOverview | null>(null);
  const [r2Report, setR2Report] = useState<R2CostReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingClassId, setExportingClassId] = useState<string | null>(null);

  // Action result toast banner
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Preview report modal
  const [previewReport, setPreviewReport] = useState<ClassroomDetailedReport | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Confirm purge/delete modal
  const [targetClassroom, setTargetClassroom] = useState<ClassroomDatabaseItem | null>(null);
  const [actionMode, setActionMode] = useState<ClassroomDestructiveActionMode>("PURGE_SUBMISSIONS");
  const [actionProcessing, setActionProcessing] = useState(false);

  const loadAllData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [dbRes, r2Res] = await Promise.all([
        adminApi.getDatabaseOverview(),
        adminApi.getR2CostReport(),
      ]);
      setOverview(dbRes);
      setR2Report(r2Res);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu CSDL & R2:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleSwitchTab = (tab: "database" | "r2") => {
    setActiveTab(tab);
    setSearchParams(tab === "r2" ? { tab: "r2" } : {});
  };

  const handlePreviewReport = async (cls: ClassroomDatabaseItem) => {
    setPreviewLoading(true);
    setPreviewReport(null);
    try {
      const res = await adminApi.getClassroomDetailedReport(cls.id);
      setPreviewReport(res);
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể tải báo cáo chi tiết lớp.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadExcel = async (classroomId: string, classroomName: string) => {
    setExportingClassId(classroomId);
    try {
      await adminApi.downloadClassroomReportExcel(classroomId, classroomName);
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể xuất file Excel cho lớp học.");
    } finally {
      setExportingClassId(null);
    }
  };

  const handleConfirmAction = async (forcePurge: boolean) => {
    if (!targetClassroom) return;
    setActionProcessing(true);
    try {
      const result =
        actionMode === "DELETE_CLASSROOM"
          ? await adminApi.deleteClassroom(targetClassroom.id)
          : await adminApi.purgeClassroomSubmissions(targetClassroom.id, forcePurge);

      setActionSuccessMessage(result.message);
      setTargetClassroom(null);
      await loadAllData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể thực hiện thao tác dữ liệu.");
    } finally {
      setActionProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-blue-700" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Quản Lý Cơ Sở Dữ Liệu &amp; Chi Tiêu Cloud R2
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dọn dẹp dữ liệu bài làm lớp đã hoàn thành, xuất báo cáo Excel từng lớp và giám sát chi phí lưu trữ Cloudflare R2.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadAllData(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs cursor-pointer transition disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Đồng Bộ Thống Kê
        </button>
      </div>

      {/* Feedback Banner */}
      {actionSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={17} className="shrink-0" />
            {actionSuccessMessage}
          </span>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="underline font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => handleSwitchTab("database")}
          className={`pb-3 px-2 text-sm font-black tracking-wide transition border-b-2 inline-flex items-center gap-2 cursor-pointer ${
            activeTab === "database"
              ? "border-blue-700 text-blue-800 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Database size={16} /> Cơ Sở Dữ Liệu Lớp Học ({overview?.totalClassrooms ?? 0})
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab("r2")}
          className={`pb-3 px-2 text-sm font-black tracking-wide transition border-b-2 inline-flex items-center gap-2 cursor-pointer ${
            activeTab === "r2"
              ? "border-blue-700 text-blue-800 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Cloud size={16} /> Báo Cáo Chi Tiêu Cloud R2
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "database" ? (
        <DatabaseManagementTab
          overview={overview}
          exportingClassId={exportingClassId}
          onPreviewReport={handlePreviewReport}
          onDownloadExcel={(cls) => handleDownloadExcel(cls.id, cls.name)}
          onOpenPurgeModal={(cls) => {
            setTargetClassroom(cls);
            setActionMode("PURGE_SUBMISSIONS");
          }}
          onOpenDeleteModal={(cls) => {
            setTargetClassroom(cls);
            setActionMode("DELETE_CLASSROOM");
          }}
        />
      ) : (
        <R2CostReportTab
          report={r2Report}
          completedClassesCount={overview?.completedClassrooms ?? 0}
          submissionAudioCount={overview?.totalSubmissionAudioFiles ?? 0}
          onSwitchToDatabaseTab={() => handleSwitchTab("database")}
        />
      )}

      {/* Modals */}
      <ClassroomReportPreviewModal
        report={previewReport}
        loading={previewLoading}
        exporting={exportingClassId !== null}
        onClose={() => {
          setPreviewReport(null);
          setPreviewLoading(false);
        }}
        onDownloadExcel={handleDownloadExcel}
      />

      <ClassroomActionConfirmModal
        open={targetClassroom !== null}
        mode={actionMode}
        classroomName={targetClassroom?.name || ""}
        classroomStatus={targetClassroom?.status || ""}
        attemptCount={targetClassroom?.attemptCount}
        answerCount={targetClassroom?.answerCount}
        audioCount={targetClassroom?.submissionAudioCount}
        processing={actionProcessing}
        onCancel={() => setTargetClassroom(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
