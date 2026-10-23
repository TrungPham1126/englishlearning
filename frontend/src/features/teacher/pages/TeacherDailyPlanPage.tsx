import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { teacherApi } from "../api/teacherApi";
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  BookOpen,
  FileText,
  CheckCircle,
  X,
  Search,
  Download,
  Video,
  FileQuestion,
  Headphones,
  Archive,
  BarChart2,
  CheckSquare,
  Trash2,
  Edit3,
} from "lucide-react";

import CreateAssignmentModal from "../components/CreateAssignmentModal";
import ClassroomHeaderNav from "../components/ClassroomHeaderNav";
import { Sparkles, Mic, PenTool } from "lucide-react";

interface DailyPlanItem {
  id: string;
  dayNumber: number;
  title: string;
  scheduledDate: string;
  estimatedMinutes: number;
  isUnlocked?: boolean;
  items: any[];
}

interface GlobalResourceItem {
  id: string;
  name: string;
  resourceType: string;
  url?: string;
  fileSize?: string;
}

export default function TeacherDailyPlanPage() {
  const { classId } = useParams<{ classId: string }>();
  const [activeTab, setActiveTab] = useState<"BUILDER" | "TRACKER">("BUILDER");

  const [plans, setPlans] = useState<DailyPlanItem[]>([]);
  const [classAssignments, setClassAssignments] = useState<any[]>([]);
  const [globalResources, setGlobalResources] = useState<GlobalResourceItem[]>(
    [],
  );
  const [progressStats, setProgressStats] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Tạo Bài Tập Chuyên Nghiệp (AI / Thủ Công / Tài Liệu)
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] =
    useState<boolean>(false);
  const [assignmentTargetDate, setAssignmentTargetDate] = useState<string>("");

  // Modal Tạo / Sửa Lộ Trình (Day)
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<DailyPlanItem | null>(null);
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [title, setTitle] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(45);

  // Modal Thêm Bài Tập / Nội dung vào Day
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [targetPlanId, setTargetPlanId] = useState<string | null>(null);
  const [selectedResourceType, setSelectedResourceType] = useState<
    "ASSIGNMENT" | "DOCUMENT"
  >("ASSIGNMENT");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [itemSectionName, setItemSectionName] =
    useState<string>("Bài tập ngày");
  const [itemTitle, setItemTitle] = useState<string>("");

  const [searchResource, setSearchResource] = useState<string>("");
  const [searchStudent, setSearchStudent] = useState<string>("");

  useEffect(() => {
    if (classId) {
      loadData();
    }
  }, [classId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resPlans, resRes, resProgress, resAssign]: any = await Promise.allSettled([
        teacherApi.getDailyPlans(classId!),
        teacherApi.getGlobalResources(),
        teacherApi.getDailyProgressStats(classId!),
        teacherApi.getClassAssignments(classId!),
      ]);

      if (resPlans.status === "fulfilled" && resPlans.value?.data) {
        const loadedPlans = resPlans.value.data?.data || [];
        setPlans(loadedPlans);
        setDayNumber(loadedPlans.length + 1);
      }

      if (resRes.status === "fulfilled" && resRes.value?.data) {
        setGlobalResources(resRes.value.data?.data || []);
      }

      if (resProgress.status === "fulfilled" && resProgress.value?.data) {
        setProgressStats(resProgress.value.data?.data || []);
      } else {
        setProgressStats([]);
      }

      if (resAssign.status === "fulfilled" && resAssign.value?.data) {
        setClassAssignments(resAssign.value.data?.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setDayNumber(plans.length + 1);
    setTitle(`DAY ${plans.length + 1}`);
    setScheduledDate(new Date().toISOString().split("T")[0]);
    setEstimatedMinutes(45);
    setShowModal(true);
  };

  const openEditModal = (p: DailyPlanItem) => {
    setEditingPlan(p);
    setDayNumber(p.dayNumber);
    setTitle(p.title);
    setScheduledDate(p.scheduledDate);
    setEstimatedMinutes(p.estimatedMinutes);
    setShowModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledDate) return;

    try {
      if (editingPlan) {
        await teacherApi.updateDailyPlan(editingPlan.id, {
          dayNumber: Number(dayNumber),
          title: title.trim(),
          scheduledDate,
          estimatedMinutes: Number(estimatedMinutes),
        });
        alert(`Đã cập nhật Ngày ${dayNumber}!`);
      } else {
        await teacherApi.createDailyPlan(classId!, {
          dayNumber: Number(dayNumber),
          title: title.trim(),
          scheduledDate,
          estimatedMinutes: Number(estimatedMinutes),
        });
        alert(`Đã tạo lịch học Ngày ${dayNumber}!`);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi lưu lộ trình");
    }
  };

  const handleDeletePlan = async (planId: string, dayNum: number) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Day ${dayNum}?`)) return;
    try {
      await teacherApi.deleteDailyPlan(planId);
      loadData();
    } catch (err) {
      alert("Lỗi khi xóa Ngày học");
    }
  };

  const openAddItemModal = (planId: string) => {
    setTargetPlanId(planId);
    setSelectedResourceType("ASSIGNMENT");
    setSelectedAssignmentId(classAssignments[0]?.id || "");
    setItemSectionName("Bài tập cần làm");
    setItemTitle("");
    setShowAddItemModal(true);
  };

  const handleAddItemToPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPlanId) return;

    let finalTitle = itemTitle.trim();
    let assignId: string | undefined = undefined;

    if (selectedResourceType === "ASSIGNMENT") {
      const selectedAssign = classAssignments.find(
        (a) => a.id === selectedAssignmentId,
      );
      if (!selectedAssign) {
        alert("Vui lòng chọn 1 bài tập!");
        return;
      }
      finalTitle = selectedAssign.title;
      assignId = selectedAssign.id;
    }

    if (!finalTitle) {
      alert("Vui lòng nhập tên tiêu đề hoặc chọn bài tập!");
      return;
    }

    try {
      const currentPlan = plans.find((p) => p.id === targetPlanId);
      const currentItemCount = currentPlan?.items?.length ?? 0;
      await teacherApi.addPlanItem(targetPlanId, {
        sectionName: itemSectionName || "Bài tập ngày",
        title: finalTitle,
        itemType: selectedResourceType,
        orderIndex: currentItemCount + 1,
        assignmentId: assignId,
      });
      setShowAddItemModal(false);
      setItemTitle("");
      setSelectedAssignmentId("");
      loadData();
    } catch (err) {
      alert("Lỗi thêm bài tập vào Ngày học");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await teacherApi.deletePlanItem(itemId);
      loadData();
    } catch (err) {
      alert("Lỗi xóa bài tập khỏi Ngày học");
    }
  };

  const filteredResources = globalResources.filter((r) =>
    r.name.toLowerCase().includes(searchResource.toLowerCase()),
  );
  const filteredStudents = progressStats.filter((s) =>
    s.studentName.toLowerCase().includes(searchStudent.toLowerCase()),
  );

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
    <div className="space-y-6">
      {/* Unified Classroom Header & Sub-Nav */}
      <ClassroomHeaderNav
        classId={classId!}
        activeTab="plans"
        actions={
          <div className="flex bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-sm">
            <button
              onClick={() => setActiveTab("BUILDER")}
              className={`flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === "BUILDER"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Soạn Lộ Trình
            </button>
            <button
              onClick={() => setActiveTab("TRACKER")}
              className={`flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === "TRACKER"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5 mr-1.5" /> Bảng Tiến Độ (Ma Trận)
            </button>
          </div>
        }
      />

      {/* TABS CONTENT */}
      {activeTab === "BUILDER" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in zoom-in-95 duration-300">
          {/* CỘT TRÁI: Lộ trình học */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                Lịch Học & Nhiệm Vụ ({plans.length} ngày)
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setAssignmentTargetDate(
                      new Date().toISOString().split("T")[0],
                    );
                    setShowCreateAssignmentModal(true);
                  }}
                  className="flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
                >
                  <Sparkles className="h-4 w-4 mr-1 text-amber-300" /> Tạo Bài Tập Mới (AI / Tài Liệu)
                </button>
                <button
                  onClick={openCreateModal}
                  className="flex items-center px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
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
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                      <div className="flex items-center space-x-2.5">
                        <span className="rounded-md bg-indigo-500/10 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          Day {p.dayNumber}
                        </span>
                        <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                          {p.title}
                        </h3>
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
                            onClick={() => openEditModal(p)}
                            title="Sửa thông tin Day"
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white transition rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlan(p.id, p.dayNumber)}
                            title="Xóa Day"
                            className="p-1 text-rose-500 dark:text-rose-400 hover:text-rose-600 transition rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Danh sách bài tập / tài liệu trong ngày */}
                    <div className="space-y-2 pt-1">
                      {p.items && p.items.length > 0 ? (
                        p.items.map((item, i) => (
                          <div
                            key={item.id || i}
                            className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-[#162033] px-3.5 py-2 text-xs border border-slate-200 dark:border-slate-800/60"
                          >
                            <div className="flex items-center space-x-2.5">
                              {item.itemType === "DOCUMENT" ? (
                                <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              )}
                              <span className="text-slate-800 dark:text-slate-200 font-medium">
                                {item.title}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                                {item.sectionName}
                              </span>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition p-1"
                                title="Xóa khỏi ngày này"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 italic py-1">
                          Chưa có bài tập nào được gắn vào ngày này.
                        </p>
                      )}

                      <button
                        onClick={() => openAddItemModal(p.id)}
                        className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-indigo-500 transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Thêm bài tập / tài liệu vào Day {p.dayNumber}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CỘT PHẢI: Kho tài liệu */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
              <BookOpen className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
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
                      className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#162033] p-3.5 hover:border-indigo-500/50"
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
      )}

      {/* TAB 2: BẢNG MA TRẬN TIẾN ĐỘ (TRACKER) */}
      {activeTab === "TRACKER" && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên học viên..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mr-1.5"></div>{" "}
                Hoàn thành (100%)
              </span>
              <span className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-amber-500 mr-1.5"></div>{" "}
                Đang làm dở
              </span>
              <span className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-slate-400 dark:bg-slate-700 mr-1.5"></div>{" "}
                Chưa làm
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#111827] shadow-sm">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-[#162033] text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4 sticky left-0 bg-slate-50 dark:bg-[#162033] z-10 w-64 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    Học viên
                  </th>
                  <th className="px-4 py-4 text-center border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#162033]">
                    Tổng tiến độ
                  </th>
                  {plans.map((p) => (
                    <th
                      key={p.id}
                      className="px-4 py-4 text-center border-l border-slate-200 dark:border-slate-800 min-w-[100px]"
                    >
                      Day {p.dayNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={plans.length + 2}
                      className="p-8 text-center text-slate-500"
                    >
                      Không có dữ liệu tiến độ.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, sIdx) => (
                    <tr key={sIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="px-5 py-3 sticky left-0 bg-white dark:bg-[#111827] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {student.studentName}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center border-l border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${student.overallRate >= 80 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : student.overallRate >= 50 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}
                        >
                          {student.overallRate}%
                        </span>
                      </td>

                      {student.days?.map((day: any, dIdx: number) => (
                        <td
                          key={dIdx}
                          className="px-4 py-3 text-center border-l border-slate-100 dark:border-slate-800"
                        >
                          {day.rate === 100 ? (
                            <div className="flex flex-col items-center">
                              <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                                100%
                              </span>
                              <span className="text-[10px] text-slate-500 flex items-center mt-0.5">
                                <Clock className="w-3 h-3 mr-1" /> {day.minutes}{" "}
                                phút
                              </span>
                            </div>
                          ) : day.rate > 0 ? (
                            <div className="flex flex-col items-center">
                              <span className="text-amber-600 dark:text-amber-400 font-bold text-sm">
                                {day.rate}%
                              </span>
                              <span className="text-[10px] text-slate-500 flex items-center mt-0.5">
                                <Clock className="w-3 h-3 mr-1" /> {day.minutes}{" "}
                                phút
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 font-medium text-xs">
                              -
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL TẠO / SỬA DAY */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">
                {editingPlan ? `Chỉnh Sửa Day ${editingPlan.dayNumber}` : "Thêm Ngày Học Mới"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Day thứ:</label>
                  <input
                    type="number"
                    min="1"
                    value={dayNumber}
                    onChange={(e) => setDayNumber(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-800/60 p-2 text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Ngày mở bài tập (Deadline):</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-800/60 p-2 text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">
                  Tiêu đề ngày học:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: DAY 1: Nắm vững câu điều kiện"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-800/60 p-2.5 text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">
                  Thời gian làm bài ước tính (phút):
                </label>
                <input
                  type="number"
                  min="5"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-800/60 p-2 text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-800 px-4 py-2 font-semibold text-slate-400 hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                >
                  {editingPlan ? "Cập Nhật" : "Tạo Mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM BÀI TẬP / TÀI LIỆU VÀO DAY */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">
                Gắn Bài Tập / Nội Dung vào Ngày Học
              </h2>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddItemToPlan} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Loại nội dung:</label>
                <select
                  value={selectedResourceType}
                  onChange={(e) =>
                    setSelectedResourceType(e.target.value as any)
                  }
                  className="w-full rounded-lg border border-slate-800 bg-slate-800/60 p-2.5 text-white outline-none focus:border-indigo-500"
                >
                  <option value="ASSIGNMENT">Bài Tập Từ Lớp Học (Assignment)</option>
                  <option value="DOCUMENT">Tài Liệu Đính Kèm (Document)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Tên mục / Section:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Bài tập Listening, Tài liệu đính kèm..."
                  value={itemSectionName}
                  onChange={(e) => setItemSectionName(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-800/60 p-2.5 text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {selectedResourceType === "ASSIGNMENT" ? (
                <div>
                  <label className="text-slate-400 block mb-1">
                    Chọn Bài Tập Đã Tạo Trong Lớp:
                  </label>
                  {classAssignments.length === 0 ? (
                    <p className="text-amber-400 text-xs italic">
                      Lớp này chưa có bài tập nào. Hãy vào mục Quản lý bài tập để tạo trước!
                    </p>
                  ) : (
                    <select
                      value={selectedAssignmentId}
                      onChange={(e) => setSelectedAssignmentId(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-800/60 p-2.5 text-white outline-none focus:border-indigo-500"
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
                  <label className="text-slate-400 block mb-1">Tiêu đề tài liệu:</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: File Audio Luyện Nghe IELTS"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-800/60 p-2.5 text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="rounded-lg border border-slate-800 px-4 py-2 font-semibold text-slate-400 hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                >
                  Gắn Vào Ngày Học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TẠO BÀI TẬP CHUYÊN NGHIỆP (AI / THỦ CÔNG / TÀI LIỆU) */}
      <CreateAssignmentModal
        isOpen={showCreateAssignmentModal}
        onClose={() => setShowCreateAssignmentModal(false)}
        classId={classId!}
        onSuccess={loadData}
        initialDate={assignmentTargetDate}
      />
    </div>
  );
}
