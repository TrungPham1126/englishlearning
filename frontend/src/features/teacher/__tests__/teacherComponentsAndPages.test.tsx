import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { teacherApi } from "../api/teacherApi";
import ExcelFormatCheatSheetModal from "../components/ExcelFormatCheatSheetModal";
import ImportReportBanner from "../components/ImportReportBanner";
import { AssignmentDetailsModal } from "../components/assignment-modal/AssignmentDetailsModal";
import { QuestionEditorItem } from "../components/assignment-modal/QuestionEditorItem";
import { DailyPlanTimeline } from "../components/daily-plan/DailyPlanTimeline";
import { DailyPlanAddItemModal } from "../components/daily-plan/DailyPlanAddItemModal";
import { DailyPlanItemModal } from "../components/daily-plan/DailyPlanItemModal";
import { DailyPlanTrackerTab } from "../components/daily-plan/DailyPlanTrackerTab";
import { TeacherAssignmentsManagerTab } from "../components/daily-plan/TeacherAssignmentsManagerTab";
import { SubmissionFilterBar } from "../components/grading/SubmissionFilterBar";
import { SubmissionListSidebar } from "../components/grading/SubmissionListSidebar";
import { AiEvaluationCard } from "../components/grading/AiEvaluationCard";
import { GradingWorkspacePanel } from "../components/grading/GradingWorkspacePanel";
import { StudentLearningProfileModal } from "../components/students/StudentLearningProfileModal";
import { ExamBuilderModal } from "../components/exams/ExamBuilderModal";
import TeacherDashboardPage from "../pages/TeacherDashboardPage";
import TeacherClassroomsPage from "../pages/TeacherClassroomsPage";
import TeacherClassExamsPage from "../pages/TeacherClassExamsPage";
import TeacherClassStudentsPage from "../pages/TeacherClassStudentsPage";
import TeacherGradingPage from "../pages/TeacherGradingPage";

describe("Teacher Module - Components, Modals & Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Assignment & Excel Import Modals / Components
  // =========================================================================
  describe("ExcelFormatCheatSheetModal & ImportReportBanner", () => {
    it("renders ExcelFormatCheatSheetModal tabs and triggers template download callbacks", () => {
      const onClose = vi.fn();
      const onDownloadSkill = vi.fn();
      const onDownloadFull = vi.fn();

      render(
        <ExcelFormatCheatSheetModal
          isOpen={true}
          onClose={onClose}
          currentSkill="READING"
          onDownloadSkillTemplate={onDownloadSkill}
          onDownloadFullTemplate={onDownloadFull}
        />
      );

      expect(screen.getByText(/Tổng Quan 12 Cột Chuẩn/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/1\. Từ Vựng & Matching/i));
      expect(screen.getAllByText(/VOCABULARY/i).length).toBeGreaterThan(0);
    });

    it("renders ImportReportBanner with errors, warnings, and group tabs", () => {
      const onSwitchGroup = vi.fn();
      const onClose = vi.fn();

      render(
        <ImportReportBanner
          report={{
            source: "TEXT",
            totalRows: 5,
            imported: 4,
            errors: ["Dòng 3: Thiếu đáp án đúng"],
            warnings: ["Dòng 2: Tự động chuẩn hóa TRUE"],
          }}
          groups={[
            {
              key: "READING_QA",
              label: "Reading MC",
              skill: "READING",
              speakingMode: "QA",
              passage: "",
              audioUrl: "",
              questions: [{ id: "q1" } as any, { id: "q2" } as any],
            },
            {
              key: "LISTENING_QA",
              label: "Listening MC",
              skill: "LISTENING",
              speakingMode: "QA",
              passage: "",
              audioUrl: "",
              questions: [{ id: "q3" } as any, { id: "q4" } as any],
            },
          ]}
          activeGroupKey="READING_QA"
          onSwitchGroup={onSwitchGroup}
          onClose={onClose}
        />
      );

      expect(screen.getByRole("region", { name: /Báo cáo kết quả nhập dữ liệu/i })).toBeInTheDocument();
      fireEvent.click(screen.getByText(/LISTENING/i));
      expect(onSwitchGroup).toHaveBeenCalledWith("LISTENING_QA");
    });
  });

  describe("QuestionEditorItem & AssignmentDetailsModal", () => {
    it("renders QuestionEditorItem and fires update, option add, and delete callbacks", () => {
      const handleChangeType = vi.fn();
      const handleUpdate = vi.fn();
      const handleDelete = vi.fn();
      const handleAddOpt = vi.fn();
      const handlePreview = vi.fn();

      render(
        <QuestionEditorItem
          q={{
            id: "q-1",
            prompt: "Choose the correct verb form:",
            questionType: "MULTIPLE_CHOICE",
            options: ["go", "goes"],
            correctAnswer: "goes",
            explanation: "Third person singular",
            points: 1,
          }}
          idx={0}
          assignmentType="GRAMMAR"
          speakingMode="QA"
          playingPreviewId={null}
          handleChangeQuestionType={handleChangeType}
          handleUpdateQuestion={handleUpdate}
          handleDeleteQuestion={handleDelete}
          handleAddOption={handleAddOpt}
          handlePreviewAudio={handlePreview}
        />
      );

      expect(screen.getByText("Câu 1")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Choose the correct verb form:")).toBeInTheDocument();

      fireEvent.change(screen.getByDisplayValue("Choose the correct verb form:"), {
        target: { value: "Updated prompt" },
      });
      expect(handleUpdate).toHaveBeenCalledWith("q-1", "prompt", "Updated prompt");
    });

    it("loads full assignment details in AssignmentDetailsModal and cleans up audio when closed", async () => {
      vi.spyOn(teacherApi, "getAssignment").mockResolvedValue({
        data: {
          data: {
            id: "a-100",
            title: "Listening Practice 1",
            skillType: "LISTENING",
            timeLimitMinutes: 25,
            maxAllowedErrorPercent: 20,
            maxAttempts: 3,
            questions: [
              {
                id: "q1",
                promptText: "Where does the speaker work?",
                questionType: "MULTIPLE_CHOICE",
                correctAnswer: "Hospital",
                options: [
                  { optionText: "Hospital", isCorrect: true },
                  { optionText: "Bank", isCorrect: false },
                ],
              },
            ],
          },
        },
      } as any);

      const onEdit = vi.fn();
      const onDelete = vi.fn();
      const onClose = vi.fn();

      const { rerender } = render(
        <AssignmentDetailsModal
          isOpen={true}
          onClose={onClose}
          assignment={{ id: "a-100", title: "Listening Practice 1", questions: [] }}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Where does the speaker work?")).toBeInTheDocument();
      });

      rerender(
        <AssignmentDetailsModal
          isOpen={false}
          onClose={onClose}
          assignment={{ id: "a-100", title: "Listening Practice 1", questions: [] }}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      expect(screen.queryByText("Where does the speaker work?")).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Daily Plan Components & Modals
  // =========================================================================
  describe("DailyPlanTimeline, DailyPlanAddItemModal, DailyPlanItemModal, DailyPlanTrackerTab, TeacherAssignmentsManagerTab", () => {
    const samplePlans = [
      {
        id: "plan-1",
        dayNumber: 1,
        title: "DAY 1: Vocabulary Foundation",
        scheduledDate: "2026-05-01",
        estimatedMinutes: 45,
        items: [
          {
            id: "item-1",
            sectionName: "Bài tập ngày",
            title: "Vocab Quiz 1",
            itemType: "ASSIGNMENT",
            assignmentId: "a-1",
          },
        ],
      },
    ];

    it("renders DailyPlanTimeline and expands day items", () => {
      const onCreateAssignment = vi.fn();
      const onCreateDay = vi.fn();

      render(
        <DailyPlanTimeline
          plans={samplePlans as any}
          classAssignments={[{ id: "a-1", title: "Vocab Quiz 1", skillType: "VOCABULARY" }]}
          globalResources={[]}
          loading={false}
          onCreateAssignment={onCreateAssignment}
          onCreateDay={onCreateDay}
          onEditDay={vi.fn()}
          onDeleteDay={vi.fn()}
          onOpenAddItem={vi.fn()}
          onDeleteItem={vi.fn()}
        />
      );

      expect(screen.getByText(/DAY 1: Vocabulary Foundation/i)).toBeInTheDocument();
    });

    it("renders DailyPlanAddItemModal and submits selected assignment", () => {
      const onSave = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
        <DailyPlanAddItemModal
          isOpen={true}
          classAssignments={[{ id: "a-1", title: "Vocab Quiz 1", skillType: "VOCABULARY" }]}
          selectedResourceType="ASSIGNMENT"
          setSelectedResourceType={vi.fn()}
          itemSectionName="Bài tập ngày"
          setItemSectionName={vi.fn()}
          selectedAssignmentId="a-1"
          setSelectedAssignmentId={vi.fn()}
          itemTitle=""
          setItemTitle={vi.fn()}
          onClose={vi.fn()}
          onSave={onSave}
        />
      );

      expect(
        screen.getByText(/Gắn Bài Tập \/ Nội Dung vào Ngày Học/i)
      ).toBeInTheDocument();
    });

    it("renders DailyPlanItemModal in edit mode and displays day metadata", () => {
      render(
        <DailyPlanItemModal
          isOpen={true}
          editingPlan={samplePlans[0] as any}
          dayNumber={1}
          setDayNumber={vi.fn()}
          title="DAY 1: Vocabulary Foundation"
          setTitle={vi.fn()}
          scheduledDate="2026-05-01"
          setScheduledDate={vi.fn()}
          estimatedMinutes={45}
          setEstimatedMinutes={vi.fn()}
          classAssignments={[{ id: "a-1", title: "Vocab Quiz 1", skillType: "VOCABULARY" }]}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByDisplayValue("DAY 1: Vocabulary Foundation")).toBeInTheDocument();
    });

    it("filters students in DailyPlanTrackerTab and assignments in TeacherAssignmentsManagerTab", () => {
      const setSearchStudent = vi.fn();
      render(
        <DailyPlanTrackerTab
          plans={samplePlans as any}
          progressStats={[
            {
              studentId: "s-1",
              studentName: "Le Minh",
              studentEmail: "minh@edu.vn",
              daysProgress: { "plan-1": 100 },
            },
          ]}
          searchStudent=""
          setSearchStudent={setSearchStudent}
        />
      );

      expect(screen.getByText("Le Minh")).toBeInTheDocument();

      render(
        <TeacherAssignmentsManagerTab
          plans={samplePlans as any}
          classAssignments={[
            {
              id: "a-1",
              title: "Vocab Quiz 1",
              skillType: "VOCABULARY",
              timeLimitMinutes: 20,
              questions: [{ id: "q1" }],
            },
          ]}
          onCreateAssignment={vi.fn()}
          onEditAssignment={vi.fn()}
          onDeleteAssignment={vi.fn()}
          onViewAssignment={vi.fn()}
        />
      );

      expect(screen.getAllByText("Vocab Quiz 1").length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 3. Grading & Student Profile Components
  // =========================================================================
  describe("SubmissionFilterBar, SubmissionListSidebar, AiEvaluationCard, GradingWorkspacePanel, StudentLearningProfileModal", () => {
    const sampleSub = {
      attemptId: "att-1",
      studentId: "s-1",
      studentName: "Pham Hoa",
      studentEmail: "hoa@edu.vn",
      submittedAt: "2026-05-12T10:00:00Z",
      status: "SUBMITTED",
      score: null,
      violationCount: 1,
      isCheatingFlagged: false,
    };

    it("renders SubmissionFilterBar, SubmissionListSidebar, AiEvaluationCard, and GradingWorkspacePanel", () => {
      render(
        <SubmissionFilterBar
          classes={[{ id: "c-1", name: "IELTS 6.5" } as any]}
          selectedClassId="c-1"
          onChangeClassId={vi.fn()}
          assignments={[{ id: "a-1", title: "Writing Task 2", skillType: "WRITING" }]}
          selectedAssignmentId="a-1"
          onChangeAssignmentId={vi.fn()}
          loadingClasses={false}
          loadingAssignments={false}
        />
      );

      expect(screen.getByText(/Trung Tâm Chấm Bài & Đánh Giá/i)).toBeInTheDocument();

      render(
        <SubmissionListSidebar
          submissions={[sampleSub as any]}
          filteredSubmissions={[sampleSub as any]}
          selectedSub={sampleSub as any}
          onSelectSubmission={vi.fn()}
          statusFilter="ALL"
          onChangeStatusFilter={vi.fn()}
          search=""
          onChangeSearch={vi.fn()}
          pendingCount={1}
          completedCount={0}
          loadingSubmissions={false}
        />
      );

      expect(screen.getByText("Pham Hoa")).toBeInTheDocument();

      const onApplyAiScore = vi.fn();
      render(
        <AiEvaluationCard
          question={{
            questionId: "q-essay",
            promptText: "Discuss both views and give your opinion.",
            questionType: "ESSAY",
            studentAnswer: "Many people believe technology improves education...",
            aiEvaluation: {
              overallScore: 7.5,
              estimatedCefr: "B2",
            },
            evalFeedback: JSON.stringify({
              generalFeedback: "Well-structured essay with clear arguments.",
              strengths: ["Good cohesion"],
              improvements: ["Expand lexical range"],
            }),
          }}
          onApplyAiScore={onApplyAiScore}
        />
      );

      expect(
        screen.getByText(/Well-structured essay with clear arguments/i)
      ).toBeInTheDocument();

      render(
        <GradingWorkspacePanel
          selectedSub={sampleSub as any}
          submissionDetail={{
            attemptId: "att-1",
            assignmentTitle: "Writing Task 2",
            skillType: "WRITING",
            status: "SUBMITTED",
            score: null,
            teacherFeedback: "",
            questions: [
              {
                questionId: "q-essay",
                promptText: "Discuss both views.",
                questionType: "ESSAY",
                studentAnswer: "Sample student essay...",
                points: 10,
              },
            ],
          }}
          loadingDetail={false}
          inputScore="7.5"
          setInputScore={vi.fn()}
          feedback="Good structure"
          setFeedback={vi.fn()}
          savingGrade={false}
          saveSuccess={null}
          onSaveGrade={vi.fn()}
        />
      );

      expect(screen.getByText("Sample student essay...")).toBeInTheDocument();
    });

    it("loads student submissions in StudentLearningProfileModal and supports inline grading", async () => {
      vi.spyOn(teacherApi, "getStudentClassroomSubmissions").mockResolvedValue({
        data: {
          data: [
            {
              attemptId: "att-speaking-1",
              assignmentId: "a-s1",
              assignmentTitle: "Speaking Part 2",
              skillType: "SPEAKING",
              status: "SUBMITTED",
              score: null,
              submittedAt: "2026-05-11T10:00:00Z",
              dayNumber: 1,
              dayTitle: "DAY 1",
              hasAiEvaluation: true,
              aiScore: 7.0,
              aiCefr: "B2",
            },
          ],
        },
      } as any);

      vi.spyOn(teacherApi, "getSubmissionDetail").mockResolvedValue({
        data: {
          data: {
            attemptId: "att-speaking-1",
            assignmentTitle: "Speaking Part 2",
            skillType: "SPEAKING",
            status: "SUBMITTED",
            score: 7.0,
            teacherFeedback: "",
            questions: [
              {
                questionId: "q-s1",
                promptText: "Describe a book you recently read.",
                questionType: "AUDIO_RESPONSE",
                studentAnswer: "I recently read Atomic Habits...",
              },
            ],
          },
        },
      } as any);

      render(
        <StudentLearningProfileModal
          classId="c-1"
          student={{
            studentId: "s-1",
            fullName: "Pham Hoa",
            email: "hoa@edu.vn",
            phone: "0901234567",
            enrolledAt: "2026-04-01",
            completedTasks: 8,
            totalTasks: 10,
            completionRate: 80,
            averageScore: 7.8,
            weaknesses: ["Pronunciation"],
            aiQuota: { dailyUsed: 2, dailyLimit: 10, isBlocked: false },
          }}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Speaking Part 2/i).length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // 4. ExamBuilderModal & Teacher Pages
  // =========================================================================
  describe("ExamBuilderModal & Teacher Pages", () => {
    it("renders ExamBuilderModal, loads question bank, and adds custom question", async () => {
      vi.spyOn(teacherApi, "getQuestionBank").mockResolvedValue({
        data: {
          data: [
            {
              id: "qb-1",
              assignmentId: "a-1",
              assignmentTitle: "Unit 1",
              skillType: "READING",
              questionType: "MULTIPLE_CHOICE",
              promptText: "Bank question 1?",
              correctAnswer: "A",
              points: 1,
              options: [{ optionText: "A", isCorrect: true }],
            },
          ],
        },
      } as any);

      render(
        <ExamBuilderModal
          classId="c-1"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      );

      expect(screen.getByText(/Tạo Bài Thi & Kiểm Tra Mới/i)).toBeInTheDocument();
      const bankBtn = screen.getByRole("button", {
        name: /Chọn Câu Hỏi Có Sẵn Từ Lớp|Ngân hàng câu hỏi/i,
      });
      fireEvent.click(bankBtn);

      await waitFor(() => {
        expect(teacherApi.getQuestionBank).toHaveBeenCalledWith("c-1");
      });
    });

    it("renders TeacherDashboardPage, TeacherClassroomsPage, TeacherClassExamsPage, TeacherClassStudentsPage, and TeacherGradingPage", async () => {
      vi.spyOn(teacherApi, "getAssignedClasses").mockResolvedValue({
        data: {
          data: [
            {
              id: "c-1",
              name: "IELTS Intensive 6.5",
              description: "Evening class",
              level: "B2",
              status: "ACTIVE",
              startDate: "2026-04-01",
              endDate: "2026-07-01",
              maxStudents: 25,
              currentStudentsCount: 18,
            },
          ],
        },
      } as any);
      vi.spyOn(teacherApi, "getTeacherDashboardStats").mockResolvedValue({
        data: {
          data: {
            totalClasses: 1,
            totalStudents: 18,
            pendingSubmissionsCount: 3,
            upcomingLessonsCount: 2,
          },
        },
      } as any);
      vi.spyOn(teacherApi, "getClassDetail").mockResolvedValue({
        data: {
          data: {
            id: "c-1",
            name: "IELTS Intensive 6.5",
            level: "B2",
            status: "ACTIVE",
          },
        },
      } as any);
      vi.spyOn(teacherApi, "getClassExams").mockResolvedValue({
        data: {
          data: [
            {
              id: "exam-1",
              title: "Midterm CBT Exam",
              isExam: true,
              timeLimitMinutes: 60,
              maxAttempts: 1,
              questions: [{ id: "q1" }],
            },
          ],
        },
      } as any);
      vi.spyOn(teacherApi, "getClassStudents").mockResolvedValue({
        data: {
          data: [
            {
              studentId: "s-1",
              fullName: "Nguyen Minh",
              email: "minh@edu.vn",
              phone: "0912345678",
              enrolledAt: "2026-04-01",
              completedTasks: 5,
              totalTasks: 6,
              completionRate: 83,
              averageScore: 8.1,
            },
          ],
        },
      } as any);
      vi.spyOn(teacherApi, "getAiQuotas").mockResolvedValue({
        data: { data: [] },
      } as any);
      vi.spyOn(teacherApi, "getClassAssignments").mockResolvedValue({
        data: { data: [] },
      } as any);

      // 1. TeacherDashboardPage
      render(
        <MemoryRouter>
          <TeacherDashboardPage />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText(/Chào mừng trở lại, Giảng viên!/i)).toBeInTheDocument();
      });

      // 2. TeacherClassroomsPage
      render(
        <MemoryRouter>
          <TeacherClassroomsPage />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getAllByText(/IELTS Intensive 6\.5/i).length).toBeGreaterThan(0);
      });

      // 3. TeacherClassExamsPage
      render(
        <MemoryRouter initialEntries={["/teacher/classes/c-1/exams"]}>
          <Routes>
            <Route path="/teacher/classes/:classId/exams" element={<TeacherClassExamsPage />} />
          </Routes>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText(/Midterm CBT Exam/i)).toBeInTheDocument();
      });

      // 4. TeacherClassStudentsPage
      render(
        <MemoryRouter initialEntries={["/teacher/classes/c-1/students"]}>
          <Routes>
            <Route path="/teacher/classes/:classId/students" element={<TeacherClassStudentsPage />} />
          </Routes>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText("Nguyen Minh")).toBeInTheDocument();
      });

      // 5. TeacherGradingPage
      render(
        <MemoryRouter>
          <TeacherGradingPage />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText(/Trung Tâm Chấm Bài & Đánh Giá/i)).toBeInTheDocument();
      });
    });
  });
});
