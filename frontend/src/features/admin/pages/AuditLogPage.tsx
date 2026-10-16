// src/features/admin/pages/AuditLogPage.tsx
import { useEffect, useState } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { AuditLogDto } from "@/features/admin/types";
import {
  Loader2,
  Activity,
  Users,
  Video,
  FileText,
  School,
  Filter,
  LayoutList,
  Info,
} from "lucide-react";

type FilterType = "ALL" | "ACCOUNT" | "VIDEO" | "ASSIGNMENT" | "CLASS";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");

  useEffect(() => {
    adminApi
      .getAuditLogs(0, 200)
      .then((res) => setLogs(res.content))
      .catch((err) => console.error("Lỗi tải Audit Logs:", err))
      .finally(() => setLoading(false));
  }, []);

  const formatAction = (action: string) => {
    const act = (action || "").toUpperCase();
    if (act.includes("CREATE") || act.includes("ADD") || act.includes("START"))
      return {
        text: "TẠO MỚI",
        color: "text-emerald-700 bg-emerald-100 border-emerald-200",
      };
    if (
      act.includes("UPDATE") ||
      act.includes("EDIT") ||
      act.includes("SUBMIT") ||
      act.includes("APPROVE")
    )
      return {
        text: "CẬP NHẬT",
        color: "text-blue-700 bg-blue-100 border-blue-200",
      };
    if (
      act.includes("DELETE") ||
      act.includes("REJECT") ||
      act.includes("REMOVE") ||
      act.includes("LOCK")
    )
      return {
        text: "XÓA / HỦY",
        color: "text-rose-700 bg-rose-100 border-rose-200",
      };

    return { text: act, color: "text-slate-700 bg-slate-100 border-slate-200" };
  };

  const formatEntity = (entityName: string) => {
    const ent = (entityName || "").toUpperCase();
    if (
      ent.includes("USER") ||
      ent.includes("STUDENT") ||
      ent.includes("TEACHER")
    )
      return "Tài khoản";
    if (ent.includes("VIDEO")) return "Video Bài giảng";
    if (
      ent.includes("ASSIGNMENT") ||
      ent.includes("QUESTION") ||
      ent.includes("ATTEMPT")
    )
      return "Bài tập / Đề thi";
    if (
      ent.includes("CLASS") ||
      ent.includes("LESSON") ||
      ent.includes("CURRICULUM")
    )
      return "Lớp học / Giáo trình";
    return entityName;
  };

  // Hàm DỊCH CHUYÊN SÂU JSON Thành Tiếng Việt cho Admin
  const renderReadableMetadata = (jsonStr: string) => {
    if (!jsonStr || jsonStr === "{}" || jsonStr === "null") {
      return (
        <span className="text-slate-400 italic text-xs">
          Không có ghi chú thêm
        </span>
      );
    }

    try {
      const data = JSON.parse(jsonStr);

      // Từ điển dịch thuật Key
      const keyDictionary: Record<string, string> = {
        method: "Thao tác",
        reason: "Lý do",
        status: "Trạng thái",
        role: "Phân quyền",
        email: "Tài khoản Email",
        fileName: "Tên tệp",
        score: "Điểm số",
        level: "Cấp độ",
      };

      // Từ điển dịch thuật Value (đặc biệt cho các method kỹ thuật)
      const valueDictionary: Record<string, string> = {
        updateSkillScore: "Cập nhật điểm kỹ năng AI",
        login: "Đăng nhập hệ thống",
        logout: "Đăng xuất",
        ACTIVE: "Hoạt động",
        INACTIVE: "Khóa",
        PENDING: "Chờ xử lý",
        APPROVED: "Đã duyệt",
        REJECTED: "Từ chối",
      };

      return (
        <div className="space-y-1.5">
          {Object.entries(data).map(([key, value]) => {
            const displayKey = keyDictionary[key] || key;
            const valStr = String(value);
            const displayValue = valueDictionary[valStr] || valStr;

            return (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span className="font-semibold text-slate-500 capitalize shrink-0">
                  {displayKey}:
                </span>
                <span className="font-bold text-slate-800 break-words">
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      );
    } catch (e) {
      // Fallback nếu chuỗi lưu trữ không phải là JSON chuẩn
      return <span className="text-slate-700 text-xs">{jsonStr}</span>;
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (activeFilter === "ALL") return true;
    const ent = (log.entityName || "").toUpperCase();

    if (activeFilter === "ACCOUNT")
      return (
        ent.includes("USER") ||
        ent.includes("STUDENT") ||
        ent.includes("TEACHER")
      );
    if (activeFilter === "VIDEO") return ent.includes("VIDEO");
    if (activeFilter === "ASSIGNMENT")
      return (
        ent.includes("ASSIGNMENT") ||
        ent.includes("QUESTION") ||
        ent.includes("ATTEMPT")
      );
    if (activeFilter === "CLASS")
      return (
        ent.includes("CLASS") ||
        ent.includes("LESSON") ||
        ent.includes("CURRICULUM")
      );

    return false;
  });

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
          <Activity size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800">
            Lịch Sử Hoạt Động
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi chi tiết các thao tác tạo mới Tài khoản, đăng Video, giao
            Bài tập trên toàn bộ nền tảng.
          </p>
        </div>
      </div>

      {/* FILTER BUTTONS */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 px-3 py-2 border-r border-slate-200 mr-2 text-slate-400 font-bold text-sm uppercase">
          <Filter size={16} /> Lọc theo
        </div>

        <button
          onClick={() => setActiveFilter("ALL")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeFilter === "ALL" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <LayoutList size={16} /> Tất cả
        </button>

        <button
          onClick={() => setActiveFilter("ACCOUNT")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeFilter === "ACCOUNT" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <Users size={16} /> Tài khoản
        </button>

        <button
          onClick={() => setActiveFilter("ASSIGNMENT")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeFilter === "ASSIGNMENT" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <FileText size={16} /> Bài tập
        </button>

        <button
          onClick={() => setActiveFilter("VIDEO")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeFilter === "VIDEO" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <Video size={16} /> Video
        </button>

        <button
          onClick={() => setActiveFilter("CLASS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeFilter === "CLASS" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <School size={16} /> Lớp & Bài giảng
        </button>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-black border-b border-slate-200">
                <th className="p-4 w-40">Thời gian</th>
                <th className="p-4 w-48">Người thao tác</th>
                <th className="p-4 w-36">Loại hành động</th>
                <th className="p-4 w-48">Mục ảnh hưởng</th>
                <th className="p-4">Chi tiết thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-slate-400">
                    <Activity size={48} className="mx-auto mb-3 opacity-20" />
                    <span className="font-bold">
                      Không tìm thấy lịch sử nào trong mục này.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const actionBadge = formatAction(log.action);
                  const entityName = formatEntity(log.entityName);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 text-xs font-semibold text-slate-500 whitespace-nowrap">
                        <div className="text-slate-800 font-bold mb-0.5">
                          {new Date(log.createdAt).toLocaleDateString("vi-VN")}
                        </div>
                        <div>
                          {new Date(log.createdAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="p-4">
                        <div
                          className="font-bold text-indigo-700 truncate max-w-[150px]"
                          title={log.userName || log.userId}
                        >
                          {log.userName || "Hệ thống tự động"}
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase border ${actionBadge.color}`}
                        >
                          {actionBadge.text}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-700">
                        {entityName}
                      </td>
                      <td className="p-4">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 max-w-md">
                          {renderReadableMetadata(log.metadataJson)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
