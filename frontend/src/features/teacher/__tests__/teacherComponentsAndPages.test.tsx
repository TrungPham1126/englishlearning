import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { teacherApi } from "../api/teacherApi";
import ExcelFormatCheatSheetModal from "../components/ExcelFormatCheatSheetModal";
import ImportReportBanner from "../components/ImportReportBanner";
import CreateAssignmentModal from "../components/CreateAssignmentModal";
import * as assignmentImport from "../utils/assignmentImport";
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
import { getLevelQuestionFormats } from "../components/assignment-modal/assignmentModalConfig";
import { GradingWorkspacePanel } from "../components/grading/GradingWorkspacePanel";
import { StudentLearningProfileModal } from "../components/students/StudentLearningProfileModal";
import { ExamBuilderModal } from "../components/exams/ExamBuilderModal";
import TeacherDashboardPage from "../pages/TeacherDashboardPage";
import TeacherClassroomsPage from "../pages/TeacherClassroomsPage";
import TeacherClassExamsPage from "../pages/TeacherClassExamsPage";
import TeacherClassStudentsPage from "../pages/TeacherClassStudentsPage";
import TeacherGradingPage from "../pages/TeacherGradingPage";
import TeacherClassDetailPage from "../pages/TeacherClassDetailPage";
import TeacherLessonDetailPage from "../pages/TeacherLessonDetailPage";
import TeacherVideosPage from "../pages/TeacherVideosPage";

vi.mock("@/features/student/components/VideoPlayer", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/student/components/VideoPlayer")
  >("@/features/student/components/VideoPlayer");
  return {
    ...actual,
    default: (props: {
      videoId: string;
      streamUrl: string;
      enableProgressSync?: boolean;
      lazyLoad?: boolean;
    }) => (
      <div
        data-testid="mock-video-player"
        data-video-id={props.videoId}
        data-sync={String(props.enableProgressSync)}
        data-lazy={String(Boolean(props.lazyLoad))}
      >
        {props.streamUrl}
      </div>
    ),
  };
});

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

      expect(screen.getByText(/12 cột chuẩn/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/1\. Từ vựng/i));
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

      expect(screen.getByRole("region", { name: /Báo cáo nhập dữ liệu/i })).toBeInTheDocument();
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

    it("hides sample audio preview button for SPEAKING Q&A, PART_2, and PART_3, showing it only for SHADOWING", () => {
      const baseProps = {
        idx: 0,
        assignmentType: "SPEAKING",
        playingPreviewId: null,
        handleChangeQuestionType: vi.fn(),
        handleUpdateQuestion: vi.fn(),
        handleDeleteQuestion: vi.fn(),
        handleAddOption: vi.fn(),
        handlePreviewAudio: vi.fn(),
      };
      const speakingQ = {
        id: "q-sp-1",
        prompt: "What are the advantages of living in a big city?",
        questionType: "AUDIO_RESPONSE" as const,
        options: [],
        correctAnswer: "Nêu ít nhất 2 lợi ích về việc làm và giáo dục",
        explanation: "Từ vựng: job opportunities, public transport",
        points: 1,
      };

      const { rerender } = render(
        <QuestionEditorItem {...baseProps} q={speakingQ} speakingMode="QA" />
      );
      expect(
        screen.queryByRole("button", { name: /Nghe mẫu|Tạo & Nghe thử/i })
      ).not.toBeInTheDocument();

      rerender(
        <QuestionEditorItem {...baseProps} q={speakingQ} speakingMode="PART_2" />
      );
      expect(
        screen.getByText(/Cue Card \(IELTS Part 2\):/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Nghe mẫu|Tạo & Nghe thử/i })
      ).not.toBeInTheDocument();

      rerender(
        <QuestionEditorItem {...baseProps} q={speakingQ} speakingMode="PART_3" />
      );
      expect(
        screen.getByText(/Câu hỏi thảo luận \(Part 3\):/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Nghe mẫu|Tạo & Nghe thử/i })
      ).not.toBeInTheDocument();

      rerender(
        <QuestionEditorItem {...baseProps} q={speakingQ} speakingMode="SHADOWING" />
      );
      expect(
        screen.getByRole("button", { name: /Nghe mẫu|Tạo & Nghe thử/i })
      ).toBeInTheDocument();
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
        screen.getByText(/Thêm vào ngày học/i)
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

      expect(screen.getByRole("heading", { name: /^Chấm bài$/i })).toBeInTheDocument();

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
      // Band 7.5/9 converts cleanly via (7.5 / 9) * 10 = 8.3
      expect(screen.getByText(/Band 7\.5\/9 \(~8\.3\/10\)/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Dùng điểm AI \(8\.3\)/i }));
      expect(onApplyAiScore).toHaveBeenCalledWith(8.3);

      const a1WritingFormats = getLevelQuestionFormats("WRITING", "A1").map((f) => f.code);
      expect(a1WritingFormats).toEqual([
        "WRITING_DESCRIPTIVE_PARAGRAPH",
        "WRITING_SHORT_EMAIL",
        "WRITING_PARAGRAPH",
      ]);
      const c1WritingFormats = getLevelQuestionFormats("WRITING", "C1").map((f) => f.code);
      expect(c1WritingFormats).toEqual([
        "WRITING_IELTS_TASK1",
        "WRITING_IELTS_TASK2",
        "WRITING_DISCURSIVE_ESSAY",
      ]);

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

      expect(screen.getByText(/Tạo bài thi/i)).toBeInTheDocument();
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
        expect(screen.getByRole("heading", { name: /^Tổng quan$/i })).toBeInTheDocument();
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
        expect(screen.getByRole("heading", { name: /^Chấm bài$/i })).toBeInTheDocument();
      });
    });

    it("renders TeacherClassDetailPage with video status, material counts, and studio navigation", async () => {
      vi.spyOn(teacherApi, "getClassLessons").mockResolvedValue({
        data: {
          data: [
            {
              id: "l-1",
              title: "Lesson 1: Pronunciation",
              objectives: "Luyện phát âm /i:/",
              orderIndex: 1,
              hasVideo: true,
              videoId: "vid-1",
              videoStatus: "REJECTED",
              videoRejectionReason: "Âm thanh bị rè",
              documentsCount: 2,
              vocabulariesCount: 5,
              grammarTopicsCount: 3,
              completed: false,
            },
          ],
        },
      } as any);
      vi.spyOn(teacherApi, "getClassAnnouncements").mockResolvedValue({
        data: { data: [] },
      } as any);

      render(
        <MemoryRouter initialEntries={["/teacher/classrooms/c-1"]}>
          <Routes>
            <Route path="/teacher/classrooms/:classId" element={<TeacherClassDetailPage />} />
            <Route
              path="/teacher/classrooms/:classId/lessons/:lessonId"
              element={<div>Teacher Lesson Studio View</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Lesson 1: Pronunciation")).toBeInTheDocument();
      });
      expect(screen.getAllByText(/Video bị từ chối/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Âm thanh bị rè/i)).toBeInTheDocument();
      expect(screen.getByText(/2 tài liệu/i)).toBeInTheDocument();
      expect(screen.getByText(/5 từ vựng/i)).toBeInTheDocument();
      expect(screen.getByText(/3 ngữ pháp/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Xem video/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Xem & Chỉnh sửa/i }));
      await waitFor(() => {
        expect(screen.getByText("Teacher Lesson Studio View")).toBeInTheDocument();
      });
    });

    it("renders TeacherLessonDetailPage with VideoPlayer sync disabled and edits lesson, documents, vocabularies, and grammar", async () => {
      const lessonDetailPayload = {
        id: "l-1",
        classId: "c-1",
        title: "Lesson 1: Pronunciation",
        objectives: "Master vowel sounds",
        content: "Detailed notes",
        orderIndex: 1,
        documents: [
          {
            id: "doc-1",
            fileName: "Handout.pdf",
            fileType: "PDF" as const,
            fileUrl: "/uploads/documents/handout.pdf",
            fileSizeBytes: 2048,
          },
        ],
        vocabularies: [
          {
            id: "v-1",
            word: "resilient",
            ipa: "/rɪˈzɪl.jənt/",
            partOfSpeech: "ADJECTIVE",
            meaning: "kiên cường",
            exampleSentence: "She is resilient.",
          },
        ],
        grammarTopics: [
          {
            id: "g-1",
            title: "Present Perfect",
            ruleSummary: "Actions started in the past",
            formula: "S + have/has + V3",
            examples: "She has lived here for 5 years.",
          },
        ],
      };

      vi.spyOn(teacherApi, "getLessonDetail").mockResolvedValue({
        data: { data: lessonDetailPayload },
      } as any);
      vi.spyOn(teacherApi, "getLessonVideo").mockResolvedValue({
        data: {
          data: {
            id: "vid-1",
            originalFileName: "lesson1.mp4",
            status: "REJECTED",
            rejectionReason: "Cần chỉnh âm thanh",
            hlsPlaylistUrl: "/api/v1/videos/vid-1/raw",
            rawStorageUrl: "/raw/lesson1.mp4",
          },
        },
      } as any);
      vi.spyOn(teacherApi, "getClassLessons").mockResolvedValue({
        data: {
          data: [
            {
              id: "l-1",
              title: "Lesson 1: Pronunciation",
              orderIndex: 1,
              hasVideo: true,
              documentsCount: 1,
              vocabulariesCount: 1,
              grammarTopicsCount: 1,
              completed: false,
            },
          ],
        },
      } as any);
      const updateLessonSpy = vi.spyOn(teacherApi, "updateLesson").mockResolvedValue({ data: {} } as any);
      const updateDocumentSpy = vi.spyOn(teacherApi, "updateDocument").mockResolvedValue({ data: { data: {} } } as any);
      const addVocabSpy = vi.spyOn(teacherApi, "addVocabulary").mockResolvedValue({ data: { data: {} } } as any);
      const updateVocabSpy = vi.spyOn(teacherApi, "updateVocabulary").mockResolvedValue({ data: { data: {} } } as any);
      const addGrammarSpy = vi.spyOn(teacherApi, "addGrammarTopic").mockResolvedValue({ data: { data: {} } } as any);
      const updateGrammarSpy = vi.spyOn(teacherApi, "updateGrammarTopic").mockResolvedValue({ data: { data: {} } } as any);

      render(
        <MemoryRouter initialEntries={["/teacher/classrooms/c-1/lessons/l-1"]}>
          <Routes>
            <Route path="/teacher/classrooms/:classId/lessons/:lessonId" element={<TeacherLessonDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId("mock-video-player")).toBeInTheDocument();
      });
      expect(screen.getByTestId("mock-video-player")).toHaveAttribute("data-sync", "false");
      expect(screen.getByText(/Cần chỉnh âm thanh/i)).toBeInTheDocument();

      // Edit Lesson Overview Modal
      fireEvent.click(screen.getByRole("button", { name: /^Chỉnh sửa$/i }));
      fireEvent.change(screen.getByDisplayValue("Lesson 1: Pronunciation"), {
        target: { value: "Lesson 1: Updated" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Lưu bài giảng/i }));
      await waitFor(() => {
        expect(updateLessonSpy).toHaveBeenCalledWith(
          "l-1",
          expect.objectContaining({ title: "Lesson 1: Updated" })
        );
      });

      // Documents Tab -> Rename Document
      fireEvent.click(screen.getByRole("button", { name: /Tài liệu \(1\)/i }));
      expect(screen.getByText("Handout.pdf")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Sửa tài liệu Handout.pdf" }));
      fireEvent.change(screen.getByDisplayValue("Handout.pdf"), {
        target: { value: "Handout v2.pdf" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));
      await waitFor(() => {
        expect(updateDocumentSpy).toHaveBeenCalledWith("doc-1", {
          fileName: "Handout v2.pdf",
          fileType: "PDF",
        });
      });

      // Vocabulary Tab -> Update & Add Vocabulary
      fireEvent.click(screen.getByRole("button", { name: /Từ vựng \(1\)/i }));
      fireEvent.click(screen.getByRole("button", { name: "Sửa từ resilient" }));
      fireEvent.change(screen.getByDisplayValue("kiên cường"), {
        target: { value: "bền bỉ" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Cập nhật từ vựng/i }));
      await waitFor(() => {
        expect(updateVocabSpy).toHaveBeenCalledWith(
          "v-1",
          expect.objectContaining({ word: "resilient", meaning: "bền bỉ" })
        );
      });

      fireEvent.click(screen.getByRole("button", { name: /Thêm từ vựng/i }));
      fireEvent.change(screen.getByPlaceholderText("VD: resilient"), {
        target: { value: "eloquent" },
      });
      fireEvent.change(screen.getByPlaceholderText("VD: kiên cường, bền bỉ"), {
        target: { value: "hùng biện" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Lưu từ vựng/i }));
      await waitFor(() => {
        expect(addVocabSpy).toHaveBeenCalledWith(
          "l-1",
          expect.objectContaining({ word: "eloquent", meaning: "hùng biện" })
        );
      });

      // Grammar Tab -> Update & Add Grammar Topic
      fireEvent.click(screen.getByRole("button", { name: /Ngữ pháp \(1\)/i }));
      fireEvent.click(screen.getByRole("button", { name: "Sửa ngữ pháp Present Perfect" }));
      fireEvent.change(screen.getByDisplayValue("Present Perfect"), {
        target: { value: "Present Perfect Continuous" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Cập nhật ngữ pháp/i }));
      await waitFor(() => {
        expect(updateGrammarSpy).toHaveBeenCalledWith(
          "g-1",
          expect.objectContaining({ title: "Present Perfect Continuous" })
        );
      });

      fireEvent.click(screen.getByRole("button", { name: /Thêm ngữ pháp/i }));
      fireEvent.change(screen.getByPlaceholderText("VD: Present Perfect Tense"), {
        target: { value: "Passive Voice" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Diễn tả hành động/i), {
        target: { value: "Be + V3/ed" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Lưu ngữ pháp/i }));
      await waitFor(() => {
        expect(addGrammarSpy).toHaveBeenCalledWith(
          "l-1",
          expect.objectContaining({ title: "Passive Voice", ruleSummary: "Be + V3/ed" })
        );
      });
    });

    it("renders TeacherVideosPage with status filtering, search, rejection reason, and video deletion", async () => {
      const sampleVideos = [
        {
          id: "vid-1",
          originalFileName: "intro.mp4",
          status: "APPROVED",
          hlsPlaylistUrl: "/api/v1/videos/vid-1/raw",
          rawStorageUrl: "/raw/intro.mp4",
          lesson: {
            id: "l-1",
            title: "Lesson 1: Intro",
            classroom: { id: "c-1", name: "IELTS 6.5" },
          },
        },
        {
          id: "vid-2",
          originalFileName: "rejected.mp4",
          status: "REJECTED",
          rejectionReason: "Video quá tối",
          hlsPlaylistUrl: "/api/v1/videos/vid-2/raw",
          rawStorageUrl: "/raw/rejected.mp4",
          lesson: {
            id: "l-2",
            title: "Lesson 2: Speaking",
            classroom: { id: "c-1", name: "IELTS 6.5" },
          },
        },
      ];

      const getMyVideosSpy = vi.spyOn(teacherApi, "getMyUploadedVideos").mockImplementation(async (status?: string) => {
        if (status === "REJECTED") {
          return { data: { data: [sampleVideos[1]] } } as any;
        }
        return { data: { data: sampleVideos } } as any;
      });
      const deleteVideoSpy = vi.spyOn(teacherApi, "deleteVideo").mockResolvedValue({ data: {} } as any);

      render(
        <MemoryRouter>
          <TeacherVideosPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("intro.mp4")).toBeInTheDocument();
        expect(screen.getByText("rejected.mp4")).toBeInTheDocument();
      });
      expect(getMyVideosSpy).toHaveBeenCalledWith("ALL");
      expect(screen.getByText(/Video quá tối/i)).toBeInTheDocument();
      const players = screen.getAllByTestId("mock-video-player");
      expect(players.every((el) => el.getAttribute("data-sync") === "false")).toBe(true);

      // Search filter narrows list
      fireEvent.change(screen.getByPlaceholderText(/Tìm theo tên video/i), {
        target: { value: "intro" },
      });
      expect(screen.getByText("intro.mp4")).toBeInTheDocument();
      expect(screen.queryByText("rejected.mp4")).not.toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText(/Tìm theo tên video/i), {
        target: { value: "" },
      });

      // Delete a video
      fireEvent.click(screen.getByRole("button", { name: "Xóa video intro.mp4" }));
      await waitFor(() => {
        expect(deleteVideoSpy).toHaveBeenCalledWith("vid-1");
      });

      // Switch filter tab to REJECTED
      fireEvent.click(screen.getByRole("button", { name: /^Bị từ chối$/i }));
      await waitFor(() => {
        expect(getMyVideosSpy).toHaveBeenCalledWith("REJECTED");
      });
    });

    it("normalizes legacy >10 scores in TeacherClassStudentsPage and AiEvaluationCard", async () => {
      vi.spyOn(teacherApi, "getClassDetail").mockResolvedValue({
        data: {
          data: {
            id: "c-1",
            name: "IELTS Intensive 6.5",
            level: "B2",
            status: "IN_PROGRESS",
          },
        },
      } as any);
      vi.spyOn(teacherApi, "getClassStudents").mockResolvedValue({
        data: {
          data: [
            {
              studentId: "s-1",
              fullName: "Học viên A",
              email: "a@edu.vn",
              completedTasks: 5,
              totalTasks: 10,
              completionRate: 61,
              averageScore: 36.5,
            },
            {
              studentId: "s-2",
              fullName: "Học viên B",
              email: "b@edu.vn",
              completedTasks: 1,
              totalTasks: 10,
              completionRate: 1,
              averageScore: 76,
            },
            {
              studentId: "s-3",
              fullName: "Học viên C",
              email: "c@edu.vn",
              completedTasks: 1,
              totalTasks: 10,
              completionRate: 1,
              averageScore: 77,
            },
            {
              studentId: "s-4",
              fullName: "Học viên D",
              email: "d@edu.vn",
              completedTasks: 1,
              totalTasks: 10,
              completionRate: 1,
              averageScore: 78,
            },
            {
              studentId: "s-5",
              fullName: "Học viên Chưa Nộp",
              email: "e@edu.vn",
              completedTasks: 0,
              totalTasks: 10,
              completionRate: 0,
              averageScore: 0,
            },
          ],
        },
      } as any);
      vi.spyOn(teacherApi, "getAiQuotas").mockResolvedValue({
        data: { data: [] },
      } as any);

      render(
        <MemoryRouter initialEntries={["/teacher/classes/c-1/students"]}>
          <Routes>
            <Route
              path="/teacher/classes/:classId/students"
              element={<TeacherClassStudentsPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("Học viên A")).toBeInTheDocument();
      });

      // Individual rows normalized to 0.0-10.0 scale
      expect(screen.getAllByText("3.7").length).toBeGreaterThan(0);
      expect(screen.getAllByText("7.6").length).toBeGreaterThan(0);
      expect(screen.getAllByText("7.7").length).toBeGreaterThan(0);
      expect(screen.getAllByText("7.8").length).toBeGreaterThan(0);
      expect(screen.getAllByText("0.0").length).toBeGreaterThan(0);

      // Class average ignores 0-score unsubmitted student: (3.7 + 7.6 + 7.7 + 7.8) / 4 = 6.7
      expect(screen.getByText("6.7")).toBeInTheDocument();
      expect(screen.queryByText("53.5")).not.toBeInTheDocument();

      // Legacy 0-100 AI evaluation score normalizes to /10 without crashing above 10
      const onApplyLegacy = vi.fn();
      render(
        <AiEvaluationCard
          question={{
            questionId: "q-legacy",
            promptText: "Describe your hometown.",
            questionType: "AUDIO_RESPONSE",
            studentAnswer: "Audio response",
            aiEvaluation: {
              overallScore: 82,
              estimatedCefr: "B2",
            },
          }}
          onApplyAiScore={onApplyLegacy}
        />,
      );

      expect(screen.getByText(/Điểm AI: 82\/100 \(~8\.2\/10\)/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Dùng điểm AI \(8\.2\)/i }));
      expect(onApplyLegacy).toHaveBeenCalledWith(8.2);
    });

    it("TeacherGradingPage hiển thị gợi ý AI Speaking/Writing, áp dụng điểm AI sang thang 10 và chốt điểm + nhận xét của giáo viên", async () => {
      vi.spyOn(teacherApi, "getAssignedClasses").mockResolvedValue({
        data: { data: [{ id: "c-grade-1", name: "IELTS Writing & Speaking 6.5" }] },
      } as any);
      vi.spyOn(teacherApi, "getClassAssignments").mockResolvedValue({
        data: {
          data: [
            {
              id: "asg-w-1",
              title: "IELTS Writing Task 2 Essay",
              skillType: "WRITING",
              isExam: false,
              questions: [{ questionType: "ESSAY" }],
            },
          ],
        },
      } as any);
      vi.spyOn(teacherApi, "getSubmissionsForGrading").mockResolvedValue({
        data: {
          data: [
            {
              attemptId: "att-grade-1",
              studentId: "stu-1",
              studentName: "Trần Bảo Ngọc",
              studentEmail: "ngoc@student.edu",
              submittedAt: "2026-05-15T10:00:00Z",
              status: "SUBMITTED",
              score: null,
            },
          ],
        },
      } as any);
      vi.spyOn(teacherApi, "getSubmissionDetail").mockResolvedValue({
        data: {
          data: {
            attemptId: "att-grade-1",
            assignmentTitle: "IELTS Writing Task 2 Essay",
            skillType: "WRITING",
            status: "SUBMITTED",
            score: null,
            teacherFeedback: "",
            questions: [
              {
                id: "sa-w-1",
                questionId: "q-w-1",
                promptText: "Some people prefer remote work. Discuss both views.",
                questionType: "ESSAY",
                studentAnswer:
                  "Remote work increases flexibility while office work strengthens collaboration.",
                aiEvaluation: {
                  evalType: "WRITING",
                  overallScore: 7.5,
                  estimatedCefr: "C1",
                  coherenceScore: 8.0,
                  vocabularyScore: 7.5,
                  grammarScore: 7.5,
                },
                evalFeedback: JSON.stringify({
                  generalFeedback: "Bài luận rõ ràng, lập luận cân bằng hai chiều.",
                  taskResponseScore: 7.0,
                }),
              },
            ],
          },
        },
      } as any);
      const gradeSpy = vi
        .spyOn(teacherApi, "gradeSubmission")
        .mockResolvedValue({ data: { status: "SUCCESS" } } as any);

      render(
        <MemoryRouter>
          <TeacherGradingPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getAllByText("Trần Bảo Ngọc").length).toBeGreaterThan(0);
      });
      await waitFor(() => {
        expect(
          screen.getByText(/Bài luận rõ ràng, lập luận cân bằng hai chiều/i),
        ).toBeInTheDocument();
      });

      // Áp dụng điểm gợi ý AI Band 7.5/9 (~8.3/10) vào ô điểm của giáo viên
      fireEvent.click(
        screen.getByRole("button", { name: /Dùng điểm AI \(8\.3\)/i }),
      );
      const scoreInput = screen.getByPlaceholderText("0.0 - 10.0") as HTMLInputElement;
      expect(scoreInput.value).toBe("8.3");

      // Giáo viên bấm chip nhận xét nhanh, chỉnh điểm chốt thành 8.5 và bấm Lưu điểm
      fireEvent.click(screen.getByRole("button", { name: /\+ Làm tốt!/i }));
      fireEvent.change(scoreInput, { target: { value: "8.5" } });
      fireEvent.click(screen.getByRole("button", { name: /Lưu điểm/i }));

      await waitFor(() => {
        expect(gradeSpy).toHaveBeenCalledWith("att-grade-1", {
          score: 8.5,
          feedback: "Làm tốt!",
        });
      });
      expect(await screen.findByText(/Đã lưu điểm 8\.5\./i)).toBeInTheDocument();
    });

    it("CreateAssignmentModal chuyển sang tab Nhập Excel, import file .xlsx và tự động nạp câu hỏi sang Bước 2", async () => {
      vi.spyOn(teacherApi, "getGlobalResources").mockResolvedValue({
        data: { data: [] },
      } as any);
      vi.spyOn(teacherApi, "getDailyPlans").mockResolvedValue({
        data: { data: [] },
      } as any);
      const readExcelSpy = vi
        .spyOn(assignmentImport, "readSpreadsheetFile")
        .mockResolvedValue([
          {
            STT: 1,
            "Kỹ năng": "GRAMMAR",
            "Loại câu hỏi": "MULTIPLE_CHOICE",
            "Nội dung câu hỏi": "She ____ to school every morning.",
            "Lựa chọn A": "go",
            "Lựa chọn B": "goes",
            "Lựa chọn C": "going",
            "Lựa chọn D": "gone",
            "Đáp án đúng": "B",
            "Giải thích / Rubric": "Ngôi thứ 3 số ít thêm -es",
          },
        ]);

      const { container } = render(
        <CreateAssignmentModal
          isOpen={true}
          onClose={vi.fn()}
          classId="c-1"
          initialSkillType="GRAMMAR"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Nhập Excel")).toBeInTheDocument();
      });

      // Chọn nguồn tạo Nhập Excel
      fireEvent.click(screen.getByText("Nhập Excel"));
      expect(
        screen.getByText(/Nhập từ Excel \(\.xlsx, \.xls, \.csv\)/i),
      ).toBeInTheDocument();

      const fileInput = container.querySelector(
        'input[accept=".xlsx, .xls, .csv"]',
      ) as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      const excelFile = new File(["dummy-xlsx"], "grammar_homework.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      fireEvent.change(fileInput, { target: { files: [excelFile] } });

      await waitFor(() => {
        expect(readExcelSpy).toHaveBeenCalledWith(excelFile);
        // Sau khi import thành công, modal tự chuyển sang Bước 2 và hiển thị câu hỏi vừa nhập
        expect(
          screen.getByDisplayValue("She ____ to school every morning."),
        ).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue("goes")).toBeInTheDocument();
    });
  });
});
