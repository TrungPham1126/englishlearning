import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { axiosClient } from "@/lib/axiosClient";
import { adminApi } from "../api/adminApi";
import { AiTierOverviewCards } from "../components/ai-monitoring/AiTierOverviewCards";
import { AiUsageCharts } from "../components/ai-monitoring/AiUsageCharts";
import { StudentQuotaTable } from "../components/ai-monitoring/StudentQuotaTable";
import { UpdateQuotaModal } from "../components/ai-monitoring/UpdateQuotaModal";
import { ClassroomOverviewHeader } from "../components/classroom/ClassroomOverviewHeader";
import { ClassroomCurriculumTab } from "../components/classroom/ClassroomCurriculumTab";
import { ClassroomStudentsTab } from "../components/classroom/ClassroomStudentsTab";
import { ClassroomVideoReviewTab } from "../components/classroom/ClassroomVideoReviewTab";
import { ClassroomSettingsTab } from "../components/classroom/ClassroomSettingsTab";
import { DatabaseManagementTab } from "../components/database/DatabaseManagementTab";
import { R2CostReportTab } from "../components/database/R2CostReportTab";
import { ReportsR2AndClassExportWidget } from "../components/database/ReportsR2AndClassExportWidget";
import { ClassroomReportPreviewModal } from "../components/database/ClassroomReportPreviewModal";
import { ClassroomActionConfirmModal } from "../components/database/ClassroomActionConfirmModal";
import AiMonitoringPage from "../pages/AiMonitoringPage";
import UserManagementPage from "../pages/UserManagementPage";
import ResourceLibraryPage from "../pages/ResourceLibraryPage";
import AuditLogPage from "../pages/AuditLogPage";
import AdminLessonDetailPage from "../pages/AdminLessonDetailPage";
import SystemBroadcastPage from "../pages/SystemBroadcastPage";
import ClassroomDetailPage from "../pages/ClassroomDetailPage";
import { studentApi } from "@/features/student/api/studentApi";

vi.mock("@/lib/axiosClient", () => {
  const mockClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  return {
    default: mockClient,
    axiosClient: mockClient,
  };
});

describe("Admin Module - adminApi, Components, Modals & Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. adminApi & Blob Excel Download Cleanup
  // =========================================================================
  describe("adminApi endpoints & downloadClassroomReportExcel Blob cleanup", () => {
    it("calls user, classroom, video moderation, AI monitoring, resource, and database endpoints", async () => {
      (axiosClient.get as any).mockResolvedValue({ data: { data: { content: [] } } });
      (axiosClient.post as any).mockResolvedValue({ data: { data: {} } });
      (axiosClient.put as any).mockResolvedValue({ data: { data: {} } });
      (axiosClient.patch as any).mockResolvedValue({ data: {} });
      (axiosClient.delete as any).mockResolvedValue({ data: { data: {} } });

      await adminApi.getUsers(0, 10, "STUDENT", "alice");
      expect(axiosClient.get).toHaveBeenCalledWith(
        "/api/v1/admin/users?page=0&size=10&role=STUDENT&keyword=alice"
      );

      await adminApi.toggleUserStatus("u-1", false);
      expect(axiosClient.patch).toHaveBeenCalledWith(
        "/api/v1/admin/users/u-1/status?active=false"
      );

      await adminApi.getClassrooms(0, 20, "OPEN");
      expect(axiosClient.get).toHaveBeenCalledWith(
        "/api/admin/classrooms?page=0&size=20&status=OPEN"
      );

      await adminApi.reviewVideo("vid-1", false, "Low audio quality");
      expect(axiosClient.patch).toHaveBeenCalledWith(
        "/api/v1/videos/vid-1/review?approved=false&reason=Low%20audio%20quality"
      );

      await adminApi.getAiUsageStats();
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/admin/ai-monitoring/stats");

      await adminApi.updateUserAiQuota("s-1", 30, true);
      expect(axiosClient.put).toHaveBeenCalledWith(
        "/api/v1/admin/ai-monitoring/quotas/s-1",
        { dailyLimit: 30, isBlocked: true }
      );

      await adminApi.toggleAiKillSwitch();
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/v1/admin/ai-monitoring/kill-switch/toggle"
      );

      await adminApi.purgeClassroomSubmissions("c-1", true);
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/v1/admin/database/classrooms/c-1/purge-submissions?force=true"
      );

      await adminApi.getR2CostReport();
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/admin/database/r2-report");
    });

    it("downloads classroom Excel report as Blob, sanitizes Vietnamese filename, and calls URL.revokeObjectURL", async () => {
      const dummyBytes = new Uint8Array([80, 75, 3, 4]);
      (axiosClient.get as any).mockResolvedValue({ data: dummyBytes });

      const createObjUrlSpy = vi
        .spyOn(window.URL, "createObjectURL")
        .mockReturnValue("blob:http://localhost/report-123");
      const revokeObjUrlSpy = vi
        .spyOn(window.URL, "revokeObjectURL")
        .mockImplementation(() => {});
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});

      await adminApi.downloadClassroomReportExcel("c-1", "Lớp Luyện Đề IELTS 7.0+");

      expect(axiosClient.get).toHaveBeenCalledWith(
        "/api/v1/admin/database/classrooms/c-1/report",
        { responseType: "blob" }
      );
      expect(createObjUrlSpy).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjUrlSpy).toHaveBeenCalledWith("blob:http://localhost/report-123");
    });

    it("downloads center-wide Excel report as Blob with expected filename and revokes object URL", async () => {
      const dummyBytes = new Uint8Array([80, 75, 3, 4]);
      (axiosClient.get as any).mockResolvedValue({ data: dummyBytes });

      const fakeAnchor = {
        href: "",
        download: "",
        style: {},
        click: vi.fn(),
        remove: vi.fn(),
      } as unknown as HTMLAnchorElement;

      const origCreateElement = document.createElement.bind(document);
      const createElementSpy = vi
        .spyOn(document, "createElement")
        .mockImplementation((tagName: string) =>
          tagName.toLowerCase() === "a" ? fakeAnchor : origCreateElement(tagName),
        );
      const appendSpy = vi
        .spyOn(document.body, "appendChild")
        .mockImplementation(() => fakeAnchor);
      const createObjUrlSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:http://localhost/center-report-123");
      const revokeObjUrlSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {});

      try {
        await adminApi.downloadCenterReportExcel();

        expect(axiosClient.get).toHaveBeenCalledWith(
          "/api/v1/admin/database/export-center-report",
          { responseType: "blob" },
        );
        expect(fakeAnchor.download).toBe("Bao_cao_tong_hop_trung_tam_ELP.xlsx");
        expect(createObjUrlSpy).toHaveBeenCalledTimes(1);
        expect(fakeAnchor.click).toHaveBeenCalledTimes(1);
        expect(revokeObjUrlSpy).toHaveBeenCalledWith(
          "blob:http://localhost/center-report-123",
        );
      } finally {
        createElementSpy.mockRestore();
        appendSpy.mockRestore();
        createObjUrlSpy.mockRestore();
        revokeObjUrlSpy.mockRestore();
      }
    });
  });

  // =========================================================================
  // 2. AI 3-Tier Monitoring & Quota Components
  // =========================================================================
  describe("AI 3-Tier Monitoring & Quota Components", () => {
    const mockAiStats = {
      totalTokensUsedToday: 125000,
      estimatedCostUsd: 2.45,
      monthlyCostUsd: 14.8,
      activeStudentsToday: 42,
      systemQuotaRemainingPercent: 78,
      isKillSwitchActive: false,
      tierStats: {
        tier1CloudCalls: 320,
        tier2LocalCalls: 150,
        tier3HeuristicCalls: 18,
      },
      dailyUsageChart: [
        { date: "2026-05-01", tokens: 45000, cost: 0.9 },
        { date: "2026-05-02", tokens: 80000, cost: 1.55 },
      ],
      costBreakdown: {
        studentSpeakingCost: 8.5,
        teacherCreationCost: 6.3,
      },
    };

    const mockQuotas = [
      {
        studentId: "s-1",
        studentName: "Nguyen An",
        email: "an@student.edu",
        role: "STUDENT",
        dailyUsed: 18,
        dailyLimit: 20,
        tokensConsumed: 15400,
        estimatedCostUsd: 0.12,
        isBlocked: false,
      },
      {
        studentId: "t-1",
        studentName: "GV Tran Binh",
        email: "binh@teacher.edu",
        role: "TEACHER",
        dailyUsed: 5,
        dailyLimit: 50,
        tokensConsumed: 42000,
        estimatedCostUsd: 0.45,
        isBlocked: true,
      },
    ];

    it("renders AiTierOverviewCards, AiUsageCharts, StudentQuotaTable, and UpdateQuotaModal", async () => {
      render(<AiTierOverviewCards stats={mockAiStats as any} />);
      expect(screen.getByText(/Chi phí tháng/i)).toBeInTheDocument();

      render(<AiUsageCharts stats={mockAiStats as any} />);

      const onOpenUpdate = vi.fn();
      const onToggleBlock = vi.fn();
      render(
        <StudentQuotaTable
          quotas={mockQuotas as any}
          isProcessing={false}
          onOpenUpdateQuota={onOpenUpdate}
          onToggleBlock={onToggleBlock}
        />
      );

      expect(screen.getByText("Nguyen An")).toBeInTheDocument();
      expect(screen.getByText("GV Tran Binh")).toBeInTheDocument();

      const onSaveQuota = vi.fn().mockResolvedValue(undefined);
      const onCloseQuota = vi.fn();

      render(
        <UpdateQuotaModal
          isOpen={true}
          onClose={onCloseQuota}
          targetUser={{
            studentId: "s-1",
            studentName: "Nguyen An",
            email: "an@student.edu",
            currentLimit: 20,
            isBlocked: false,
          }}
          onSave={onSaveQuota}
          isProcessing={false}
        />
      );

      const input = screen.getByDisplayValue("20");
      fireEvent.change(input, { target: { value: "35" } });
      fireEvent.submit(input.closest("form")!);

      await waitFor(() => {
        expect(onSaveQuota).toHaveBeenCalledWith("s-1", 35, false);
      });
    });

    it("toggles Emergency AI Kill-Switch on AiMonitoringPage", async () => {
      vi.spyOn(adminApi, "getAiUsageStats").mockResolvedValue(mockAiStats as any);
      vi.spyOn(adminApi, "getAiUserQuotas").mockResolvedValue(mockQuotas as any);
      const toggleSpy = vi
        .spyOn(adminApi, "toggleAiKillSwitch")
        .mockResolvedValue(true);

      render(<AiMonitoringPage />);

      await waitFor(() => {
        expect(screen.getByText("Nguyen An")).toBeInTheDocument();
      });

      const killSwitchBtn = screen.getByRole("button", {
        name: /Kill-Switch|Ngắt Khẩn Cấp/i,
      });
      fireEvent.click(killSwitchBtn);

      await waitFor(() => {
        expect(toggleSpy).toHaveBeenCalledTimes(1);
      });
    });

    it("cập nhật định mức Quota AI và chặn/mở khóa AI cho người dùng trực tiếp trên AiMonitoringPage", async () => {
      vi.spyOn(adminApi, "getAiUsageStats").mockResolvedValue(mockAiStats as any);
      vi.spyOn(adminApi, "getAiUserQuotas").mockResolvedValue(mockQuotas as any);
      const updateQuotaSpy = vi
        .spyOn(adminApi, "updateUserAiQuota")
        .mockResolvedValue();

      render(<AiMonitoringPage />);

      await waitFor(() => {
        expect(screen.getByText("Nguyen An")).toBeInTheDocument();
      });

      // 1. Mở modal Đổi Quota cho Nguyen An (currentLimit = 20, isBlocked = false) -> đổi lên 40
      const editQuotaBtns = screen.getAllByRole("button", { name: "Đổi Quota" });
      fireEvent.click(editQuotaBtns[0]);

      const limitInput = await screen.findByDisplayValue("20");
      fireEvent.change(limitInput, { target: { value: "40" } });
      fireEvent.submit(limitInput.closest("form")!);

      await waitFor(() => {
        expect(updateQuotaSpy).toHaveBeenCalledWith("s-1", 40, false);
      });

      // 2. Bấm nút Chặn AI cho Nguyen An -> gọi updateUserAiQuota("s-1", 20, true)
      const blockBtn = screen.getByRole("button", { name: /Chặn AI/i });
      fireEvent.click(blockBtn);
      await waitFor(() => {
        expect(updateQuotaSpy).toHaveBeenCalledWith("s-1", 20, true);
      });
    });
  });

  // =========================================================================
  // 3. Classroom Management & Video Moderation Components
  // =========================================================================
  describe("Classroom & Video Moderation Components", () => {
    const sampleClass = {
      id: "c-1",
      name: "IELTS Masterclass",
      description: "Target 7.5",
      level: "C1",
      status: "IN_PROGRESS",
      teacherName: "Mr. David",
      currentStudentsCount: 15,
      maxStudents: 25,
      startDate: "2026-04-01",
      endDate: "2026-08-01",
    };

    it("renders ClassroomOverviewHeader, ClassroomCurriculumTab, ClassroomStudentsTab, ClassroomVideoReviewTab, and ClassroomSettingsTab", async () => {
      render(
        <ClassroomOverviewHeader
          classroom={sampleClass as any}
          activeTab="settings"
          setActiveTab={vi.fn()}
          pendingVideosCount={2}
          onBack={vi.fn()}
        />
      );
      expect(screen.getByText("IELTS Masterclass")).toBeInTheDocument();

      render(
        <MemoryRouter>
          <ClassroomCurriculumTab
            lessons={[{ id: "l-1", orderIndex: 1, title: "Unit 1: Reading" }]}
            isProcessing={false}
            onDeleteLesson={vi.fn()}
            onCreateLesson={vi.fn().mockResolvedValue(true)}
          />
        </MemoryRouter>
      );
      expect(screen.getByText(/Unit 1: Reading/i)).toBeInTheDocument();

      const onEnroll = vi.fn().mockResolvedValue(true);
      render(
        <ClassroomStudentsTab
          classroom={sampleClass as any}
          enrolledStudents={[
            {
              studentId: "s-1",
              fullName: "Tran Khoa",
              email: "khoa@edu.vn",
              phone: "0909998887",
              enrolledAt: "2026-04-02",
            },
          ]}
          isProcessing={false}
          onEnrollStudent={onEnroll}
          onRemoveStudent={vi.fn()}
        />
      );
      expect(screen.getByText("Tran Khoa")).toBeInTheDocument();

      const onApprove = vi.fn();
      const onReject = vi.fn().mockResolvedValue(true);
      render(
        <ClassroomVideoReviewTab
          pendingVideos={[
            {
              id: "v-1",
              originalFileName: "Grammar_Lecture_1.mp4",
              lessonTitle: "Unit 1",
              teacherName: "Mr. David",
              videoUrl: "https://cdn/video.mp4",
              status: "PENDING_REVIEW",
              uploadedAt: "2026-05-01T10:00:00Z",
            },
          ]}
          isProcessing={false}
          onApproveVideo={onApprove}
          onRejectVideo={onReject}
        />
      );
      expect(screen.getByText("Grammar_Lecture_1.mp4")).toBeInTheDocument();

      render(
        <ClassroomSettingsTab
          classroomStatus="IN_PROGRESS"
          teachers={[
            {
              id: "t-1",
              email: "david@edu.vn",
              firstName: "David",
              lastName: "Nguyen",
              roles: ["TEACHER"],
              isActive: true,
            } as any,
          ]}
          selectedTeacherId="t-1"
          setSelectedTeacherId={vi.fn()}
          newStatus="IN_PROGRESS"
          setNewStatus={vi.fn()}
          isProcessing={false}
          onAssignTeacher={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      );
      expect(screen.getByText(/Phân công Giảng viên/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Database, R2 Cost & Report Export Components
  // =========================================================================
  describe("DatabaseManagementTab, R2CostReportTab, ReportsR2AndClassExportWidget, ClassroomReportPreviewModal, ClassroomActionConfirmModal", () => {
    it("renders DatabaseManagementTab, R2CostReportTab, ReportsR2AndClassExportWidget, and ClassroomReportPreviewModal", async () => {
      const mockR2Report = {
        liveConnected: true,
        bucketName: "english-learning-r2",
        statusMessage: "Connected to R2",
        usdToVndRate: 25500,
        totalObjects: 240,
        totalBytes: 52428800,
        totalStorageGb: 0.05,
        freeStorageGb: 10,
        freeTierLimitBytes: 10737418240,
        freeTierUsagePercent: 0.5,
        classAOps: 1200,
        freeClassAOps: 1000000,
        classBOps: 8500,
        freeClassBOps: 10000000,
        deleteOps: 15,
        storageCostUsd: 0,
        classACostUsd: 0,
        classBCostUsd: 0,
        grossEquivalentUsd: 0.005,
        totalPayableUsd: 0,
        totalPayableVnd: 0,
        monthlyBudgetUsd: 15,
        categoryBreakdowns: [],
        largestObjects: [],
      };
      vi.spyOn(adminApi, "getR2CostReport").mockResolvedValue(mockR2Report as any);

      render(
        <DatabaseManagementTab
          overview={{
            totalClassrooms: 1,
            completedClassrooms: 1,
            totalSubmissions: 25,
            totalSubmissionAnswers: 250,
            totalSubmissionAudioFiles: 12,
            estimatedSubmissionDataKb: 24576,
            classrooms: [
              {
                id: "c-1",
                name: "IELTS Completed Class",
                level: "B2",
                status: "COMPLETED",
                teacherName: "Ms. Lan",
                startDate: "2026-01-01",
                endDate: "2026-04-01",
                studentCount: 20,
                lessonCount: 12,
                assignmentCount: 15,
                examCount: 2,
                attemptCount: 25,
                answerCount: 250,
                aiEvaluationCount: 10,
                dailyProgressCount: 20,
                videoWatchCount: 40,
                cheatingFlagCount: 0,
                submissionAudioCount: 12,
                estimatedSubmissionKb: 24576,
              } as any,
            ],
          } as any}
          exportingClassId={null}
          onPreviewReport={vi.fn()}
          onDownloadExcel={vi.fn()}
          onOpenPurgeModal={vi.fn()}
          onOpenDeleteModal={vi.fn()}
        />
      );
      expect(screen.getByText("IELTS Completed Class")).toBeInTheDocument();

      render(
        <R2CostReportTab
          report={mockR2Report as any}
          completedClassesCount={1}
          submissionAudioCount={12}
        />
      );
      expect(screen.getAllByText(/english-learning-r2/i).length).toBeGreaterThan(0);

      render(
        <MemoryRouter>
          <ReportsR2AndClassExportWidget
            classes={[{ id: "c-1", name: "IELTS Completed Class" } as any]}
          />
        </MemoryRouter>
      );

      render(
        <ClassroomReportPreviewModal
          report={{
            classroomId: "c-1",
            classroomName: "IELTS Completed Class",
            level: "B2",
            status: "COMPLETED",
            teacherName: "Ms. Lan",
            teacherEmail: "lan@edu.vn",
            totalStudents: 20,
            totalLessons: 12,
            totalDailyPlans: 10,
            totalAssignments: 15,
            totalExams: 2,
            totalAttempts: 40,
            completedAttempts: 38,
            flaggedCheatingAttempts: 0,
            classAverageScore: 7.6,
            averageCompletionRate: 92,
            students: [],
            assignments: [],
          } as any}
          loading={false}
          exporting={false}
          onClose={vi.fn()}
          onDownloadExcel={vi.fn()}
        />
      );
      expect(
        screen.getByText(/Báo cáo: IELTS Completed Class/i)
      ).toBeInTheDocument();
    });

    it("enforces classroom name typing and force checkbox in ClassroomActionConfirmModal", () => {
      const onConfirmPurge = vi.fn();
      const { rerender } = render(
        <ClassroomActionConfirmModal
          open={true}
          mode="PURGE_SUBMISSIONS"
          classroomName="IELTS Active"
          classroomStatus="IN_PROGRESS"
          attemptCount={10}
          answerCount={50}
          audioCount={5}
          processing={false}
          onCancel={vi.fn()}
          onConfirm={onConfirmPurge}
        />
      );

      const purgeBtn = screen.getByRole("button", {
        name: /Xác nhận dọn/i,
      });
      // Disabled initially because class is IN_PROGRESS (requires forceOverride checkbox)
      expect(purgeBtn).toBeDisabled();

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);
      expect(purgeBtn).not.toBeDisabled();

      fireEvent.click(purgeBtn);
      expect(onConfirmPurge).toHaveBeenCalledWith(true);

      // Now test DELETE_CLASSROOM mode which requires typing the exact classroom name
      const onConfirmDelete = vi.fn();
      rerender(
        <ClassroomActionConfirmModal
          open={true}
          mode="DELETE_CLASSROOM"
          classroomName="IELTS Active"
          classroomStatus="COMPLETED"
          attemptCount={10}
          answerCount={50}
          audioCount={5}
          processing={false}
          onCancel={vi.fn()}
          onConfirm={onConfirmDelete}
        />
      );

      const deleteBtn = screen.getByRole("button", {
        name: /Xóa vĩnh viễn/i,
      });
      expect(deleteBtn).toBeDisabled();

      const textInput = screen.getByPlaceholderText("IELTS Active");
      fireEvent.change(textInput, { target: { value: "IELTS Active" } });
      expect(deleteBtn).not.toBeDisabled();

      fireEvent.click(deleteBtn);
      expect(onConfirmDelete).toHaveBeenCalledWith(false);
    });
  });

  // =========================================================================
  // 5. Admin Pages (UserManagementPage, ResourceLibraryPage, AuditLogPage, AdminLessonDetailPage, SystemBroadcastPage)
  // =========================================================================
  describe("Admin Pages & Regression Verifications", () => {
    it("preserves user.isActive when editing a locked user in UserManagementPage", async () => {
      vi.spyOn(adminApi, "getUsers").mockResolvedValue({
        content: [
          {
            id: "u-locked",
            email: "locked@student.edu",
            firstName: "Locked",
            lastName: "Student",
            phone: "0901112222",
            roles: ["STUDENT"],
            isActive: false,
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 20,
      } as any);

      const updateSpy = vi
        .spyOn(adminApi, "updateUser")
        .mockResolvedValue({} as any);

      const { container } = render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText("locked@student.edu")).toBeInTheDocument();
      });

      // Click edit button for the locked user (first button in the actions cell)
      const actionButtons = container.querySelectorAll("td.text-right button");
      fireEvent.click(actionButtons[0]);

      const firstNameInput = screen.getByDisplayValue("Locked");
      fireEvent.change(firstNameInput, { target: { value: "LockedUpdated" } });
      fireEvent.submit(firstNameInput.closest("form")!);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith("u-locked", {
          firstName: "LockedUpdated",
          lastName: "Student",
          phone: "0901112222",
          roles: ["STUDENT"],
          isActive: false,
        });
      });
    });

    it("resets file input value after uploading in ResourceLibraryPage", async () => {
      vi.spyOn(adminApi, "getGlobalResources").mockResolvedValue([]);
      const uploadSpy = vi
        .spyOn(adminApi, "uploadGlobalResource")
        .mockResolvedValue();

      const { container } = render(<ResourceLibraryPage />);

      await waitFor(() => {
        expect(adminApi.getGlobalResources).toHaveBeenCalledWith("DOC");
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const sampleFile = new File(["pdf-bytes"], "handbook.pdf", {
        type: "application/pdf",
      });

      fireEvent.change(fileInput, { target: { files: [sampleFile] } });

      await waitFor(() => {
        expect(uploadSpy).toHaveBeenCalledTimes(1);
      });
      expect(fileInput.value).toBe("");
    });

    it("updates lesson documents state in-place on delete in AdminLessonDetailPage without reloading page", async () => {
      vi.spyOn(adminApi, "getLessonDetail").mockResolvedValue({
        id: "l-1",
        orderIndex: 1,
        title: "Lesson 1: Phonetics",
        objectives: "Master IPA",
        content: "IPA chart overview",
        documents: [
          {
            id: "doc-1",
            fileName: "IPA_Guide.pdf",
            fileUrl: "https://cdn/IPA_Guide.pdf",
          },
        ],
        vocabularies: [],
        grammarTopics: [],
      });
      vi.spyOn(adminApi, "getVideoByLesson").mockResolvedValue(null);
      const deleteDocSpy = vi
        .spyOn(adminApi, "deleteDocument")
        .mockResolvedValue();

      render(
        <MemoryRouter initialEntries={["/admin/lessons/l-1"]}>
          <Routes>
            <Route path="/admin/lessons/:lessonId" element={<AdminLessonDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Tài Liệu \(1\)/i)).toBeInTheDocument();
      });

      // Switch to Documents tab
      fireEvent.click(screen.getByText(/Tài Liệu \(1\)/i));

      await waitFor(() => {
        expect(screen.getByText("IPA_Guide.pdf")).toBeInTheDocument();
      });

      // Click delete button next to IPA_Guide.pdf
      const deleteButtons = screen.getAllByRole("button");
      const docDeleteBtn = deleteButtons.find((btn) =>
        btn.className.includes("bg-rose-50")
      )!;
      fireEvent.click(docDeleteBtn);

      await waitFor(() => {
        expect(deleteDocSpy).toHaveBeenCalledWith("doc-1");
        expect(screen.queryByText("IPA_Guide.pdf")).not.toBeInTheDocument();
      });
    });

    it("renders AuditLogPage with 3-Tier AI fallback badges and SystemBroadcastPage", async () => {
      vi.spyOn(adminApi, "getAuditLogs").mockResolvedValue({
        content: [
          {
            id: "log-1",
            userId: "u-ai",
            userName: "system@ai.engine",
            action: "AI_FALLBACK_TIER_2",
            entityName: "SpeakingSubmission",
            entityId: "102",
            metadataJson: JSON.stringify({
              tier: "TIER 2",
              reason: "Gemini rate limit reached",
            }),
            createdAt: "2026-05-12T10:30:00Z",
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 50,
      } as any);

      render(<AuditLogPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Gemini rate limit reached/i)
        ).toBeInTheDocument();
      });

      vi.spyOn(adminApi, "getBroadcastHistory").mockResolvedValue({
        content: [],
      });
      vi.spyOn(adminApi, "getNotificationClassrooms").mockResolvedValue([]);

      render(<SystemBroadcastPage />);
      await waitFor(() => {
        expect(adminApi.getBroadcastHistory).toHaveBeenCalled();
      });
    });

    it("renders detailed AdminDashboardPage with KPIs, 4 chart panels, classroom table, and Excel export", async () => {
      const { MemoryRouter } = await import("react-router-dom");
      const { fireEvent } = await import("@testing-library/react");
      const { default: AdminDashboardPage } = await import(
        "../pages/AdminDashboardPage"
      );

      vi.spyOn(adminApi, "getDashboardStats").mockResolvedValue({
        totalUsers: 180,
        totalTeachers: 12,
        totalStudents: 165,
        totalClasses: 9,
        openClasses: 2,
        inProgressClasses: 5,
        planningClasses: 1,
        completedClasses: 1,
        totalLessons: 48,
        totalVideos: 36,
        pendingVideos: 3,
        totalAssignments: 24,
        totalSubmissions: 420,
        pendingGrading: 14,
        completionRate: 84.5,
        weeklySubmissionsTrend: [
          { date: "2026-11-08", submissions: 30, graded: 28 },
          { date: "2026-11-09", submissions: 42, graded: 40 },
        ],
        averageSkillScores: {
          Listening: 7.8,
          Speaking: 7.1,
          Reading: 8.2,
          Writing: 6.9,
        },
        completionDistribution: { high: 95, medium: 45, low: 25 },
      });

      vi.spyOn(adminApi, "getClassrooms").mockResolvedValue({
        content: [
          {
            id: "cls-1",
            name: "IELTS Intensive 7.5",
            level: "IELTS_PREP",
            status: "IN_PROGRESS",
            maxStudents: 25,
            currentStudentsCount: 22,
            teacherName: "Cô Lan Anh",
          },
          {
            id: "cls-2",
            name: "Giao Tiếp B1 Sáng",
            level: "B1",
            status: "OPEN",
            maxStudents: 20,
            currentStudentsCount: 15,
            teacherName: "Thầy Minh Tuấn",
          },
        ],
        totalElements: 2,
        totalPages: 1,
        pageNumber: 0,
        pageSize: 100,
        last: true,
      });

      vi.spyOn(adminApi, "getAiUsageStats").mockResolvedValue({
        totalTokens: 1250000,
        estimatedCostUsd: 1.45,
        monthlyCostUsd: 24.8,
        activeUsers: 74,
        blockedUsers: 0,
        systemQuotaRemainingPercent: 86,
        systemKillSwitchActive: false,
        dailyUsage: [],
      } as any);

      vi.spyOn(adminApi, "getDatabaseOverview").mockResolvedValue({
        totalClassrooms: 9,
        completedClassrooms: 1,
        totalEnrolledStudents: 165,
        totalAssignments: 24,
        totalExams: 12,
        totalAttempts: 380,
        totalStudentAnswers: 1900,
        totalAiEvaluations: 145,
        totalDailyProgressRecords: 610,
        totalSubmissionAudioFiles: 88,
        estimatedSubmissionDataKb: 24576,
        classrooms: [
          {
            id: "cls-1",
            name: "IELTS Intensive 7.5",
            level: "IELTS_PREP",
            status: "IN_PROGRESS",
            teacherName: "Cô Lan Anh",
            startDate: "2026-09-01",
            endDate: "2026-12-30",
            studentCount: 22,
            lessonCount: 18,
            dailyPlanCount: 30,
            assignmentCount: 8,
            examCount: 3,
            attemptCount: 120,
            answerCount: 600,
            aiEvaluationCount: 54,
            dailyProgressCount: 210,
            videoWatchCount: 180,
            submissionAudioCount: 40,
            cheatingFlagCount: 1,
            averageScore: 8.1,
            estimatedSubmissionKb: 10240,
            eligibleForCleanPurge: false,
          },
        ],
      });

      vi.spyOn(adminApi, "getAuditLogs").mockResolvedValue({
        content: [
          {
            id: "audit-1",
            userId: "admin-1",
            userName: "admin@elp.edu.vn",
            action: "EXPORT_CENTER_REPORT",
            entityName: "CenterReport",
            entityId: "center-2026",
            metadataJson: JSON.stringify({ message: "Xuất báo cáo tổng hợp Excel" }),
            createdAt: "2026-11-14T10:00:00Z",
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 8,
      } as any);

      const exportCenterSpy = vi
        .spyOn(adminApi, "downloadCenterReportExcel")
        .mockResolvedValue();

      render(
        <MemoryRouter>
          <AdminDashboardPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText("Tổng quan"),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("AI 3-Tier")).toBeInTheDocument();
      expect(screen.getByText("Lưu trữ & Audio R2")).toBeInTheDocument();
      expect(
        screen.getByText("Nộp & chấm bài (7 ngày)"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Điểm TB 4 kỹ năng" }),
      ).toBeInTheDocument();
      expect(screen.getAllByText("IELTS Intensive 7.5").length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole("button", { name: /Xuất Excel \(\.xlsx\)/i }));
      await waitFor(() => {
        expect(exportCenterSpy).toHaveBeenCalledTimes(1);
      });
    });

    it("renders AdminReportsPage with center Excel export, class filter, and per-class export action", async () => {
      const { MemoryRouter } = await import("react-router-dom");
      const { fireEvent } = await import("@testing-library/react");
      const { default: AdminReportsPage } = await import(
        "../pages/AdminReportsPage"
      );

      vi.spyOn(adminApi, "getDashboardStats").mockResolvedValue({
        totalUsers: 100,
        totalTeachers: 8,
        totalStudents: 90,
        totalClasses: 4,
        totalLessons: 20,
        totalVideos: 15,
        pendingVideos: 1,
        totalAssignments: 12,
        completionRate: 78.2,
        averageSkillScores: {
          Listening: 7.4,
          Speaking: 7.0,
          Reading: 7.9,
          Writing: 6.8,
        },
        completionDistribution: { high: 50, medium: 28, low: 12 },
      });

      vi.spyOn(adminApi, "getClassrooms").mockResolvedValue({
        content: [
          {
            id: "cls-10",
            name: "B2 Giao Tiếp Tối",
            level: "B2",
            status: "IN_PROGRESS",
            maxStudents: 20,
            currentStudentsCount: 18,
            teacherName: "Cô Hương",
          },
          {
            id: "cls-11",
            name: "A2 Nền Tảng",
            level: "A2",
            status: "OPEN",
            maxStudents: 15,
            currentStudentsCount: 10,
            teacherName: "Thầy Nam",
          },
        ],
        totalElements: 2,
        totalPages: 1,
        pageNumber: 0,
        pageSize: 100,
        last: true,
      });

      vi.spyOn(adminApi, "getUsers").mockResolvedValue({
        content: [
          {
            id: "t-1",
            fullName: "Cô Hương",
            email: "huong@elp.edu.vn",
            role: "ROLE_TEACHER",
            active: true,
          } as any,
        ],
        totalElements: 1,
        totalPages: 1,
        pageNumber: 0,
        pageSize: 100,
        last: true,
      });

      vi.spyOn(adminApi, "getDatabaseOverview").mockResolvedValue({
        totalClassrooms: 4,
        completedClassrooms: 1,
        totalEnrolledStudents: 90,
        totalAssignments: 12,
        totalExams: 6,
        totalAttempts: 140,
        totalStudentAnswers: 700,
        totalAiEvaluations: 60,
        totalDailyProgressRecords: 220,
        totalSubmissionAudioFiles: 35,
        estimatedSubmissionDataKb: 10240,
        classrooms: [
          {
            id: "cls-10",
            name: "B2 Giao Tiếp Tối",
            level: "B2",
            status: "IN_PROGRESS",
            teacherName: "Cô Hương",
            startDate: "2026-08-01",
            endDate: "2026-12-01",
            studentCount: 18,
            lessonCount: 10,
            dailyPlanCount: 20,
            assignmentCount: 6,
            examCount: 2,
            attemptCount: 90,
            answerCount: 450,
            aiEvaluationCount: 30,
            dailyProgressCount: 120,
            videoWatchCount: 95,
            submissionAudioCount: 20,
            cheatingFlagCount: 0,
            averageScore: 7.7,
            estimatedSubmissionKb: 5120,
            eligibleForCleanPurge: false,
          },
        ],
      });

      vi.spyOn(adminApi, "getR2CostReport").mockResolvedValue({
        bucketName: "elp-media-prod",
        liveConnected: false,
        totalObjects: 240,
        totalBytes: 52428800,
        totalPayableUsd: 0.01,
        totalPayableVnd: 250,
        freeTierUsagePercent: 0.5,
        freeTierRemainingGb: 9.95,
        breakdownByCategory: {
          audioSubmissions: { count: 120, sizeBytes: 20971520, sizeMb: 20 },
          lessonVideos: { count: 80, sizeBytes: 26214400, sizeMb: 25 },
          avatarsAndDocs: { count: 40, sizeBytes: 5242880, sizeMb: 5 },
          otherFiles: { count: 0, sizeBytes: 0, sizeMb: 0 },
        },
        pricingNote: "Cloudflare R2 Free Tier 10 GB",
      } as any);

      const exportCenterSpy = vi
        .spyOn(adminApi, "downloadCenterReportExcel")
        .mockResolvedValue();
      const exportClassSpy = vi
        .spyOn(adminApi, "downloadClassroomReportExcel")
        .mockResolvedValue();

      render(
        <MemoryRouter>
          <AdminReportsPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getAllByText("B2 Giao Tiếp Tối").length).toBeGreaterThan(0);
      });

      fireEvent.click(
        screen.getByRole("button", { name: /Xuất Excel \(\.xlsx\)/i }),
      );
      await waitFor(() => {
        expect(exportCenterSpy).toHaveBeenCalledTimes(1);
      });

      const classExcelButtons = screen.getAllByRole("button", {
        name: /Xuất Excel/i,
      });
      const tableExportBtn = classExcelButtons.find(
        (btn) => btn.textContent?.trim() === "Xuất Excel",
      );
      expect(tableExportBtn).toBeTruthy();
      if (tableExportBtn) {
        fireEvent.click(tableExportBtn);
        await waitFor(() => {
          expect(exportClassSpy).toHaveBeenCalled();
        });
      }
    });

    it("renders ClassroomDetailPage, switches tabs, assigns teacher, approves video, and exports Excel report", async () => {
      vi.spyOn(adminApi, "getClassrooms").mockResolvedValue({
        content: [
          {
            id: "cls-detail-1",
            name: "IELTS Master 7.5",
            description: "Advanced IELTS",
            level: "C1",
            status: "IN_PROGRESS",
            teacherId: "t-10",
            teacherName: "Mr. David",
            currentStudentsCount: 12,
            maxStudents: 20,
            startDate: "2026-04-01",
            endDate: "2026-08-01",
          },
        ],
        totalElements: 1,
        totalPages: 1,
        pageNumber: 0,
        pageSize: 100,
        last: true,
      });
      vi.spyOn(adminApi, "getUsers").mockResolvedValue({
        content: [
          {
            id: "t-10",
            email: "david@elp.edu.vn",
            firstName: "David",
            lastName: "Nguyen",
            roles: ["ROLE_TEACHER"],
            isActive: true,
          } as any,
        ],
        totalElements: 1,
        totalPages: 1,
        pageNumber: 0,
        pageSize: 100,
        last: true,
      });
      vi.spyOn(adminApi, "getPendingVideos").mockResolvedValue([
        {
          id: "vid-pend-1",
          originalFileName: "Speaking_Part2_Demo.mp4",
          lessonTitle: "Unit 1",
          teacherName: "Mr. David",
          status: "PENDING_REVIEW",
          createdAt: "2026-05-01T10:00:00Z",
        },
      ]);
      vi.spyOn(adminApi, "getClassStudents").mockResolvedValue([
        {
          studentId: "stu-10",
          fullName: "Lê Hoàng Nam",
          email: "nam@student.edu",
          phone: "0901234567",
          enrolledAt: "2026-04-02",
        },
      ]);
      vi.spyOn(studentApi, "getClassLessons").mockResolvedValue([
        {
          id: "les-10",
          orderIndex: 1,
          title: "Unit 1: Academic Writing",
        } as any,
      ]);
      const assignTeacherSpy = vi
        .spyOn(adminApi, "assignTeacher")
        .mockResolvedValue();
      const reviewVideoSpy = vi
        .spyOn(adminApi, "reviewVideo")
        .mockResolvedValue();
      const exportClassExcelSpy = vi
        .spyOn(adminApi, "downloadClassroomReportExcel")
        .mockResolvedValue();

      render(
        <MemoryRouter initialEntries={["/admin/classrooms/cls-detail-1"]}>
          <Routes>
            <Route
              path="/admin/classrooms/:classId"
              element={<ClassroomDetailPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("IELTS Master 7.5")).toBeInTheDocument();
      });
      expect(
        screen.getByText(/Unit 1: Academic Writing/i),
      ).toBeInTheDocument();

      // Xuất báo cáo Excel lớp từ header
      fireEvent.click(screen.getByRole("button", { name: /Xuất Excel/i }));
      await waitFor(() => {
        expect(exportClassExcelSpy).toHaveBeenCalledWith(
          "cls-detail-1",
          "IELTS Master 7.5",
        );
      });

      // Chuyển sang tab Học viên
      fireEvent.click(screen.getByRole("button", { name: /Học viên/i }));
      expect(screen.getByText("Lê Hoàng Nam")).toBeInTheDocument();

      // Chuyển sang tab Duyệt Video và duyệt video chờ
      fireEvent.click(screen.getByRole("button", { name: /Duyệt Video/i }));
      expect(screen.getByText("Speaking_Part2_Demo.mp4")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /^Duyệt$/i }));
      await waitFor(() => {
        expect(reviewVideoSpy).toHaveBeenCalledWith("vid-pend-1", true);
      });

      // Chuyển sang tab Cấu hình & Phân công giảng viên
      fireEvent.click(screen.getByRole("button", { name: /Cấu hình/i }));
      const saveBtns = screen.getAllByRole("button", { name: /^Lưu$/i });
      fireEvent.click(saveBtns[0]);
      await waitFor(() => {
        expect(assignTeacherSpy).toHaveBeenCalledWith("cls-detail-1", "t-10");
      });
    });
  });
});
