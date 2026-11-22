import { useState, useEffect, useRef } from "react";
import { teacherApi } from "../../api/teacherApi";
import { notifyTeacherTaskStatus } from "@/utils/teacherTaskNotification";
import type { DailyPlanItem, GlobalResourceItem } from "./dailyPlanTypes";

export function useTeacherDailyPlan(classId: string | undefined) {
  const [plans, setPlans] = useState<DailyPlanItem[]>([]);
  const [classAssignments, setClassAssignments] = useState<any[]>([]);
  const [globalResources, setGlobalResources] = useState<GlobalResourceItem[]>([]);
  const [progressStats, setProgressStats] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const savingPlanRef = useRef<boolean>(false);
  const addingItemRef = useRef<boolean>(false);

  // Modal Xem chi tiết bài tập & Chỉnh sửa toàn diện
  const [showEditAssignmentModal, setShowEditAssignmentModal] = useState<boolean>(false);
  const [editingAssignmentData, setEditingAssignmentData] = useState<any | null>(null);
  const [showAssignmentDetailsModal, setShowAssignmentDetailsModal] = useState<boolean>(false);
  const [selectedAssignmentForView, setSelectedAssignmentForView] = useState<any | null>(null);

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

  const [searchStudent, setSearchStudent] = useState<string>("");

  useEffect(() => {
    if (classId) {
      loadData();
    }
  }, [classId]);

  useEffect(() => {
    const handleDailyPlanUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ classId?: string }>).detail;
      if (!detail?.classId || !classId || detail.classId === classId) {
        void loadData();
      }
    };
    window.addEventListener("daily-plan-updated", handleDailyPlanUpdated);
    return () => {
      window.removeEventListener("daily-plan-updated", handleDailyPlanUpdated);
    };
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
    if (savingPlanRef.current) return;
    if (!title.trim() || !scheduledDate) return;

    savingPlanRef.current = true;
    try {
      if (editingPlan) {
        await teacherApi.updateDailyPlan(editingPlan.id, {
          dayNumber: Number(dayNumber),
          title: title.trim(),
          scheduledDate,
          estimatedMinutes: Number(estimatedMinutes),
        });
        alert(`Đã cập nhật Day ${dayNumber}.`);
      } else {
        await teacherApi.createDailyPlan(classId!, {
          dayNumber: Number(dayNumber),
          title: title.trim(),
          scheduledDate,
          estimatedMinutes: Number(estimatedMinutes),
        });
        alert(`Đã tạo Day ${dayNumber}.`);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lưu lộ trình thất bại.");
    } finally {
      savingPlanRef.current = false;
    }
  };

  const handleDeletePlan = async (planId: string, dayNum: number) => {
    if (!window.confirm(`Xóa Day ${dayNum}?`)) return;
    try {
      await teacherApi.deleteDailyPlan(planId);
      loadData();
    } catch (err) {
      alert("Xóa ngày học thất bại.");
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
    if (addingItemRef.current) return;
    if (!targetPlanId) return;

    let finalTitle = itemTitle.trim();
    let assignId: string | undefined = undefined;

    if (selectedResourceType === "ASSIGNMENT") {
      const selectedAssign = classAssignments.find(
        (a) => a.id === selectedAssignmentId,
      );
      if (!selectedAssign) {
        alert("Chưa chọn bài tập.");
        return;
      }
      finalTitle = selectedAssign.title;
      assignId = selectedAssign.id;
    }

    if (!finalTitle) {
      alert("Thiếu tiêu đề hoặc bài tập.");
      return;
    }

    const capturedPlanId = targetPlanId;
    const capturedClassId = classId;
    const capturedSectionName = itemSectionName || "Bài tập ngày";
    const capturedTitle = finalTitle;
    const capturedResourceType = selectedResourceType;
    const capturedAssignId = assignId;
    const currentPlan = plans.find((p) => p.id === capturedPlanId);
    const capturedItemCount = currentPlan?.items?.length ?? 0;
    const planLabel = currentPlan
      ? `Day ${currentPlan.dayNumber}${currentPlan.scheduledDate ? ` (${currentPlan.scheduledDate})` : ""}`
      : "lộ trình";

    addingItemRef.current = true;
    setShowAddItemModal(false);
    setItemTitle("");
    setSelectedAssignmentId("");

    notifyTeacherTaskStatus({
      status: "PROCESSING",
      title: `Đang gán "${capturedTitle}"`,
      message: `Đang gán "${capturedTitle}" vào ${planLabel}...`,
      classroomId: capturedClassId,
      targetUrl: "/teacher/daily-plan",
      referenceId: capturedAssignId || capturedPlanId,
      taskKey: `plan-item:${capturedPlanId}:${capturedAssignId || capturedTitle}`,
    });

    try {
      await teacherApi.addPlanItem(capturedPlanId, {
        sectionName: capturedSectionName,
        title: capturedTitle,
        itemType: capturedResourceType,
        orderIndex: capturedItemCount + 1,
        assignmentId: capturedAssignId,
      });

      await loadData();
      window.dispatchEvent(
        new CustomEvent("daily-plan-updated", {
          detail: { classId: capturedClassId, planId: capturedPlanId },
        }),
      );

      notifyTeacherTaskStatus({
        status: "SUCCESS",
        title: "Đã gán vào lộ trình",
        message: `Đã gán "${capturedTitle}" vào ${planLabel}.`,
        classroomId: capturedClassId,
        targetUrl: "/teacher/daily-plan",
        referenceId: capturedAssignId || capturedPlanId,
        taskKey: `plan-item:${capturedPlanId}:${capturedAssignId || capturedTitle}`,
      });
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Lỗi kết nối hoặc dữ liệu.";
      notifyTeacherTaskStatus({
        status: "ERROR",
        title: "Gán bài tập thất bại",
        message: `Lỗi gán "${capturedTitle}" vào ${planLabel}: ${errMsg}`,
        classroomId: capturedClassId,
        targetUrl: "/teacher/daily-plan",
        referenceId: capturedAssignId || capturedPlanId,
        taskKey: `plan-item:${capturedPlanId}:${capturedAssignId || capturedTitle}`,
      });
    } finally {
      addingItemRef.current = false;
    }
  };

  const handleViewAssignment = async (assignmentOrId: any) => {
    try {
      const id = typeof assignmentOrId === "string" ? assignmentOrId : assignmentOrId?.id;
      if (!id) return;
      const res: any = await teacherApi.getAssignment(id);
      const detail = res?.data?.data || res?.data || assignmentOrId;
      setSelectedAssignmentForView(detail);
      setShowAssignmentDetailsModal(true);
    } catch {
      if (typeof assignmentOrId === "object") {
        setSelectedAssignmentForView(assignmentOrId);
        setShowAssignmentDetailsModal(true);
      }
    }
  };

  const handleEditAssignment = async (assignmentOrId: any) => {
    try {
      const id = typeof assignmentOrId === "string" ? assignmentOrId : assignmentOrId?.id;
      if (!id) return;
      const res: any = await teacherApi.getAssignment(id);
      const detail = res?.data?.data || res?.data || assignmentOrId;
      setEditingAssignmentData(detail);
      setShowEditAssignmentModal(true);
    } catch {
      if (typeof assignmentOrId === "object") {
        setEditingAssignmentData(assignmentOrId);
        setShowEditAssignmentModal(true);
      }
    }
  };

  const handleDeleteAssignment = async (assignmentId: string, itemTitle?: string) => {
    if (
      !window.confirm(
        `Xóa vĩnh viễn "${itemTitle || "bài tập này"}"?\nSẽ gỡ khỏi mọi ngày học và xóa dữ liệu liên quan.`
      )
    ) {
      return;
    }
    try {
      await teacherApi.deleteAssignment(assignmentId);
      alert("Đã xóa bài tập.");
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Xóa bài tập thất bại.");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await teacherApi.deletePlanItem(itemId);
      loadData();
    } catch (err) {
      alert("Xóa mục khỏi ngày học thất bại.");
    }
  };

  return {
    plans,
    classAssignments,
    globalResources,
    progressStats,
    loading,
    loadData,
    // Assignment modal
    showCreateAssignmentModal,
    setShowCreateAssignmentModal,
    assignmentTargetDate,
    setAssignmentTargetDate,
    // Day plan modal
    showModal,
    setShowModal,
    editingPlan,
    dayNumber,
    setDayNumber,
    title,
    setTitle,
    scheduledDate,
    setScheduledDate,
    estimatedMinutes,
    setEstimatedMinutes,
    openCreateModal,
    openEditModal,
    handleSavePlan,
    handleDeletePlan,
    // Add item to day modal
    showAddItemModal,
    setShowAddItemModal,
    selectedResourceType,
    setSelectedResourceType,
    selectedAssignmentId,
    setSelectedAssignmentId,
    itemSectionName,
    setItemSectionName,
    itemTitle,
    setItemTitle,
    openAddItemModal,
    handleAddItemToPlan,
    handleDeleteItem,
    // Tracker
    searchStudent,
    setSearchStudent,
    // Assignment View / Edit / Delete
    showEditAssignmentModal,
    setShowEditAssignmentModal,
    editingAssignmentData,
    setEditingAssignmentData,
    showAssignmentDetailsModal,
    setShowAssignmentDetailsModal,
    selectedAssignmentForView,
    setSelectedAssignmentForView,
    handleViewAssignment,
    handleEditAssignment,
    handleDeleteAssignment,
  };
}
