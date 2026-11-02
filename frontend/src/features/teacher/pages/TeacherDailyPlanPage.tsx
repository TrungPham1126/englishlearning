import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckSquare, BarChart2, Layers } from "lucide-react";
import ClassroomHeaderNav from "../components/ClassroomHeaderNav";
import CreateAssignmentModal from "../components/CreateAssignmentModal";
import { AssignmentDetailsModal } from "../components/assignment-modal";
import {
  DailyPlanTimeline,
  DailyPlanItemModal,
  DailyPlanAddItemModal,
  DailyPlanTrackerTab,
  TeacherAssignmentsManagerTab,
  useTeacherDailyPlan,
} from "../components/daily-plan";

export type { DailyPlanItem, GlobalResourceItem } from "../components/daily-plan";

export default function TeacherDailyPlanPage() {
  const { classId } = useParams<{ classId: string }>();
  const [activeTab, setActiveTab] = useState<"BUILDER" | "ASSIGNMENTS" | "TRACKER">("BUILDER");

  const {
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
    showAssignmentDetailsModal,
    setShowAssignmentDetailsModal,
    selectedAssignmentForView,
    handleViewAssignment,
    handleEditAssignment,
    handleDeleteAssignment,
  } = useTeacherDailyPlan(classId);

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
                  ? "bg-blue-800 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Soạn Lộ Trình
            </button>
            <button
              onClick={() => setActiveTab("ASSIGNMENTS")}
              className={`flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === "ASSIGNMENTS"
                  ? "bg-blue-800 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Layers className="h-3.5 w-3.5 mr-1.5" /> Bài Đã Giao ({classAssignments.length})
            </button>
            <button
              onClick={() => setActiveTab("TRACKER")}
              className={`flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === "TRACKER"
                  ? "bg-blue-800 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5 mr-1.5" /> Bảng Tiến Độ
            </button>
          </div>
        }
      />

      {/* Tab 1: BUILDER */}
      {activeTab === "BUILDER" && (
        <DailyPlanTimeline
          plans={plans}
          classAssignments={classAssignments}
          globalResources={globalResources}
          loading={loading}
          onCreateAssignment={() => {
            setAssignmentTargetDate(new Date().toISOString().split("T")[0]);
            setShowCreateAssignmentModal(true);
          }}
          onCreateDay={openCreateModal}
          onEditDay={openEditModal}
          onDeleteDay={handleDeletePlan}
          onOpenAddItem={openAddItemModal}
          onDeleteItem={handleDeleteItem}
          onViewAssignment={handleViewAssignment}
          onEditAssignment={handleEditAssignment}
          onDeleteAssignment={handleDeleteAssignment}
        />
      )}

      {/* Tab 2: ASSIGNMENTS (Quản lý toàn bộ bài đã giao các ngày) */}
      {activeTab === "ASSIGNMENTS" && (
        <TeacherAssignmentsManagerTab
          plans={plans}
          classAssignments={classAssignments}
          onCreateAssignment={() => {
            setAssignmentTargetDate(new Date().toISOString().split("T")[0]);
            setShowCreateAssignmentModal(true);
          }}
          onEditAssignment={handleEditAssignment}
          onDeleteAssignment={handleDeleteAssignment}
          onViewAssignment={handleViewAssignment}
        />
      )}

      {/* Tab 3: TRACKER */}
      {activeTab === "TRACKER" && (
        <DailyPlanTrackerTab
          plans={plans}
          progressStats={progressStats}
          searchStudent={searchStudent}
          setSearchStudent={setSearchStudent}
        />
      )}

      {/* Modal Tạo / Sửa Day */}
      <DailyPlanItemModal
        isOpen={showModal}
        editingPlan={editingPlan}
        dayNumber={dayNumber}
        setDayNumber={setDayNumber}
        title={title}
        setTitle={setTitle}
        scheduledDate={scheduledDate}
        setScheduledDate={setScheduledDate}
        estimatedMinutes={estimatedMinutes}
        setEstimatedMinutes={setEstimatedMinutes}
        classAssignments={classAssignments}
        onClose={() => setShowModal(false)}
        onSave={handleSavePlan}
        onViewAssignment={handleViewAssignment}
        onEditAssignment={handleEditAssignment}
        onDeleteAssignment={handleDeleteAssignment}
        onCreateNewAssignmentForDay={(targetDate) => {
          setAssignmentTargetDate(targetDate);
          setShowCreateAssignmentModal(true);
        }}
        onRefresh={loadData}
      />

      {/* Modal Thêm Bài Tập / Tài Liệu vào Day */}
      <DailyPlanAddItemModal
        isOpen={showAddItemModal}
        classAssignments={classAssignments}
        selectedResourceType={selectedResourceType}
        setSelectedResourceType={setSelectedResourceType}
        itemSectionName={itemSectionName}
        setItemSectionName={setItemSectionName}
        selectedAssignmentId={selectedAssignmentId}
        setSelectedAssignmentId={setSelectedAssignmentId}
        itemTitle={itemTitle}
        setItemTitle={setItemTitle}
        onClose={() => setShowAddItemModal(false)}
        onSave={handleAddItemToPlan}
      />

      {/* Modal Tạo Bài Tập Mới */}
      <CreateAssignmentModal
        isOpen={showCreateAssignmentModal}
        onClose={() => setShowCreateAssignmentModal(false)}
        classId={classId!}
        onSuccess={loadData}
        initialDate={assignmentTargetDate}
        mode="CREATE"
      />

      {/* Modal Chỉnh Sửa Mọi Thông Số Bài Tập Đã Giao */}
      <CreateAssignmentModal
        isOpen={showEditAssignmentModal}
        onClose={() => setShowEditAssignmentModal(false)}
        classId={classId!}
        onSuccess={loadData}
        initialData={editingAssignmentData}
        mode="EDIT"
      />

      {/* Modal Xem Đề Bài & Câu Hỏi & Đáp Án Chi Tiết */}
      <AssignmentDetailsModal
        isOpen={showAssignmentDetailsModal}
        onClose={() => setShowAssignmentDetailsModal(false)}
        assignment={selectedAssignmentForView}
        onEdit={(a) => handleEditAssignment(a)}
        onDelete={(id, t) => handleDeleteAssignment(id, t)}
      />
    </div>
  );
}
