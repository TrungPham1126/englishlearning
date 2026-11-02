import React from "react";
import {
  SubmissionFilterBar,
  SubmissionListSidebar,
  GradingWorkspacePanel,
  useTeacherGrading,
} from "../components/grading";

export type {
  GradingSubmission,
  GradingQuestion,
  GradingSubmissionDetail,
  AiFeedbackParsed,
} from "../components/grading";

export default function TeacherGradingPage() {
  const {
    classes,
    selectedClassId,
    setSelectedClassId,
    assignments,
    selectedAssignmentId,
    setSelectedAssignmentId,
    submissions,
    selectedSub,
    submissionDetail,
    inputScore,
    setInputScore,
    feedback,
    setFeedback,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    loadingClasses,
    loadingAssignments,
    loadingSubmissions,
    loadingDetail,
    savingGrade,
    saveSuccess,
    handleSelectSubmission,
    handleSaveGrade,
    filteredSubmissions,
    pendingCount,
    completedCount,
  } = useTeacherGrading();

  return (
    <div className="space-y-6">
      {/* Top Header & Dropdown Selectors */}
      <SubmissionFilterBar
        classes={classes}
        selectedClassId={selectedClassId}
        onChangeClassId={setSelectedClassId}
        assignments={assignments}
        selectedAssignmentId={selectedAssignmentId}
        onChangeAssignmentId={setSelectedAssignmentId}
        loadingClasses={loadingClasses}
        loadingAssignments={loadingAssignments}
      />

      {/* Main Grid: Left List + Right Grading Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <SubmissionListSidebar
          submissions={submissions}
          filteredSubmissions={filteredSubmissions}
          selectedSub={selectedSub}
          onSelectSubmission={handleSelectSubmission}
          statusFilter={statusFilter}
          onChangeStatusFilter={setStatusFilter}
          search={search}
          onChangeSearch={setSearch}
          pendingCount={pendingCount}
          completedCount={completedCount}
          loadingSubmissions={loadingSubmissions}
        />

        <GradingWorkspacePanel
          selectedSub={selectedSub}
          submissionDetail={submissionDetail}
          loadingDetail={loadingDetail}
          inputScore={inputScore}
          setInputScore={setInputScore}
          feedback={feedback}
          setFeedback={setFeedback}
          savingGrade={savingGrade}
          saveSuccess={saveSuccess}
          onSaveGrade={handleSaveGrade}
        />
      </div>
    </div>
  );
}
