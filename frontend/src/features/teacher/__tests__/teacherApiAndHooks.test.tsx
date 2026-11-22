import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import axiosClient from "@/lib/axiosClient";
import { teacherApi, detectDocumentFileType } from "../api/teacherApi";
import { useCreateAssignmentForm } from "../components/assignment-modal/useCreateAssignmentForm";
import { useTeacherDailyPlan } from "../components/daily-plan/useTeacherDailyPlan";
import { useTeacherGrading } from "../components/grading/useTeacherGrading";

vi.mock("@/lib/axiosClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Teacher Module - teacherApi & Custom Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const audioElem = document.getElementById("main-assignment-audio");
    if (audioElem) audioElem.remove();
  });

  // =========================================================================
  // 1. teacherApi Tests
  // =========================================================================
  describe("teacherApi endpoints", () => {
    it("calls classroom, dashboard, student, and lesson endpoints with exact paths", async () => {
      (axiosClient.get as any).mockResolvedValue({ data: { data: [] } });
      (axiosClient.post as any).mockResolvedValue({ data: { data: {} } });
      (axiosClient.delete as any).mockResolvedValue({ data: {} });

      await teacherApi.getAssignedClasses();
      expect(axiosClient.get).toHaveBeenCalledWith("/api/teacher/classrooms");

      await teacherApi.getTeacherDashboardStats();
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/teacher/dashboard/stats");

      await teacherApi.getClassDetail("c-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/teacher/classrooms/c-1");

      await teacherApi.getClassStudents("c-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/teacher/classrooms/c-1/students");

      await teacherApi.getAiQuotas();
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/admin/ai-monitoring/quotas");

      await teacherApi.getClassLessons("c-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/curriculum/classes/c-1/lessons");

      await teacherApi.createLesson("c-1", {
        title: "Lesson 1",
        objectives: "Grammar",
        orderIndex: 1,
      });
      expect(axiosClient.post).toHaveBeenCalledWith("/api/curriculum/lessons", {
        title: "Lesson 1",
        objectives: "Grammar",
        orderIndex: 1,
        classId: "c-1",
      });

      await teacherApi.deleteLesson("l-1");
      expect(axiosClient.delete).toHaveBeenCalledWith("/api/curriculum/lessons/l-1");
    });

    it("uploads lesson document, lesson video, and assignment audio via multipart FormData", async () => {
      (axiosClient.post as any).mockResolvedValue({ data: { data: "https://cdn/audio.mp3" } });
      const file = new File(["dummy"], "doc.pdf", { type: "application/pdf" });

      await teacherApi.uploadLessonDocument("l-1", file);
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/curriculum/lessons/l-1/documents?fileType=PDF",
        expect.any(FormData),
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      await teacherApi.uploadLessonVideo("l-1", file);
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/v1/videos?lessonId=l-1",
        expect.any(FormData),
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      await teacherApi.uploadAudioFile(file);
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/v1/teacher/assignments/upload-audio",
        expect.any(FormData),
        { headers: { "Content-Type": "multipart/form-data" } }
      );
    });

    it("detects document types and calls lesson material & my-uploads CRUD endpoints", async () => {
      (axiosClient.get as any).mockResolvedValue({ data: { data: [] } });
      (axiosClient.post as any).mockResolvedValue({ data: { data: {} } });
      (axiosClient.put as any).mockResolvedValue({ data: { data: {} } });
      (axiosClient.delete as any).mockResolvedValue({ data: {} });

      expect(detectDocumentFileType(new File(["a"], "handout.docx"))).toBe("DOCX");
      expect(detectDocumentFileType(new File(["a"], "deck.pptx"))).toBe("PPTX");
      expect(detectDocumentFileType(new File(["a"], "listen.mp3"))).toBe("AUDIO");
      expect(detectDocumentFileType(new File(["a"], "diagram.png"))).toBe("IMAGE");
      expect(detectDocumentFileType(new File(["a"], "fallback.unknown"))).toBe("PDF");

      const docxFile = new File(["doc"], "notes.docx");
      const slideFile = new File(["ppt"], "slides.pptx");
      await teacherApi.uploadLessonDocument("l-1", docxFile);
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/curriculum/lessons/l-1/documents?fileType=DOCX",
        expect.any(FormData),
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      await teacherApi.uploadLessonDocument("l-1", slideFile);
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/curriculum/lessons/l-1/documents?fileType=PPTX",
        expect.any(FormData),
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      await teacherApi.getLessonDetail("l-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/curriculum/lessons/l-1");

      await teacherApi.updateLesson("l-1", { title: "Lesson 1B", objectives: "Obj", content: "Body", orderIndex: 2 });
      expect(axiosClient.put).toHaveBeenCalledWith("/api/curriculum/lessons/l-1", {
        title: "Lesson 1B",
        objectives: "Obj",
        content: "Body",
        orderIndex: 2,
      });

      await teacherApi.getLessonDocuments("l-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/curriculum/lessons/l-1/documents");

      await teacherApi.updateDocument("doc-1", { fileName: "Renamed.pdf", fileType: "PDF" });
      expect(axiosClient.put).toHaveBeenCalledWith("/api/curriculum/documents/doc-1", {
        fileName: "Renamed.pdf",
        fileType: "PDF",
      });

      await teacherApi.replaceDocumentFile("doc-1", docxFile, { fileName: "NewNotes.docx" });
      expect(axiosClient.put).toHaveBeenCalledWith(
        "/api/curriculum/documents/doc-1/file",
        expect.any(FormData),
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const replaceFormData = (axiosClient.put as any).mock.calls.find(
        (c: any[]) => c[0] === "/api/curriculum/documents/doc-1/file"
      )?.[1] as FormData;
      expect(replaceFormData.get("fileName")).toBe("NewNotes.docx");
      expect(replaceFormData.get("fileType")).toBe("DOCX");

      await teacherApi.deleteDocument("doc-1");
      expect(axiosClient.delete).toHaveBeenCalledWith("/api/curriculum/documents/doc-1");

      await teacherApi.getLessonVocabularies("l-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/curriculum/lessons/l-1/vocabularies");

      await teacherApi.addVocabulary("l-1", { word: "lucid", meaning: "rõ ràng", ipa: "/ˈluːsɪd/" });
      expect(axiosClient.post).toHaveBeenCalledWith("/api/curriculum/lessons/l-1/vocabularies", {
        word: "lucid",
        meaning: "rõ ràng",
        ipa: "/ˈluːsɪd/",
      });

      await teacherApi.updateVocabulary("v-1", { word: "lucid", meaning: "minh bạch", exampleSentence: "" });
      expect(axiosClient.put).toHaveBeenCalledWith("/api/curriculum/vocabularies/v-1", {
        word: "lucid",
        meaning: "minh bạch",
        exampleSentence: "",
      });

      await teacherApi.deleteVocabulary("v-1");
      expect(axiosClient.delete).toHaveBeenCalledWith("/api/curriculum/vocabularies/v-1");

      await teacherApi.getLessonGrammarTopics("l-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/curriculum/lessons/l-1/grammar");

      await teacherApi.addGrammarTopic("l-1", { title: "Present Simple", ruleSummary: "Habits" });
      expect(axiosClient.post).toHaveBeenCalledWith("/api/curriculum/lessons/l-1/grammar", {
        title: "Present Simple",
        ruleSummary: "Habits",
      });

      await teacherApi.updateGrammarTopic("g-1", { title: "Present Perfect", ruleSummary: "Experience", formula: "S + have/has + V3" });
      expect(axiosClient.put).toHaveBeenCalledWith("/api/curriculum/grammar/g-1", {
        title: "Present Perfect",
        ruleSummary: "Experience",
        formula: "S + have/has + V3",
      });

      await teacherApi.deleteGrammarTopic("g-1");
      expect(axiosClient.delete).toHaveBeenCalledWith("/api/curriculum/grammar/g-1");

      await teacherApi.getLessonVideo("l-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/videos/lesson/l-1");

      await teacherApi.getMyUploadedVideos();
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/videos/my-uploads");

      await teacherApi.getMyUploadedVideos("ALL");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/videos/my-uploads");

      await teacherApi.getMyUploadedVideos("REJECTED");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/videos/my-uploads?status=REJECTED");

      await teacherApi.deleteVideo("vid-1");
      expect(axiosClient.delete).toHaveBeenCalledWith("/api/v1/videos/vid-1");
    });

    it("calls assignment, daily plan, grading, exam, AI quiz, announcement, and TTS endpoints", async () => {
      (axiosClient.get as any).mockResolvedValue({ data: { data: [] } });
      (axiosClient.post as any).mockResolvedValue({ data: { data: {} } });
      (axiosClient.put as any).mockResolvedValue({ data: { data: {} } });
      (axiosClient.delete as any).mockResolvedValue({ data: {} });

      await teacherApi.getClassAssignments("c-1", { gradingOnly: true });
      expect(axiosClient.get).toHaveBeenCalledWith(
        "/api/v1/teacher/classrooms/c-1/assignments",
        { params: { gradingOnly: true } }
      );

      await teacherApi.createAssignment({ title: "HW 1" });
      expect(axiosClient.post).toHaveBeenCalledWith("/api/v1/teacher/assignments", {
        title: "HW 1",
      });

      await teacherApi.getAssignment("a-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/teacher/assignments/a-1");

      await teacherApi.updateAssignment("a-1", { title: "Updated" });
      expect(axiosClient.put).toHaveBeenCalledWith("/api/v1/teacher/assignments/a-1", {
        title: "Updated",
      });

      await teacherApi.deleteAssignment("a-1");
      expect(axiosClient.delete).toHaveBeenCalledWith("/api/v1/teacher/assignments/a-1");

      await teacherApi.createDailyPlan("c-1", { dayNumber: 1, title: "DAY 1" });
      expect(axiosClient.post).toHaveBeenCalledWith("/api/v1/curriculum/daily-plans", {
        dayNumber: 1,
        title: "DAY 1",
        classroomId: "c-1",
      });

      await teacherApi.updateDailyPlan("p-1", { title: "DAY 1 Updated" });
      expect(axiosClient.put).toHaveBeenCalledWith("/api/v1/curriculum/daily-plans/p-1", {
        title: "DAY 1 Updated",
      });

      await teacherApi.deleteDailyPlan("p-1");
      expect(axiosClient.delete).toHaveBeenCalledWith("/api/v1/curriculum/daily-plans/p-1");

      await teacherApi.addPlanItem("p-1", {
        sectionName: "Homework",
        title: "Task 1",
        itemType: "ASSIGNMENT",
        orderIndex: 1,
        assignmentId: "a-1",
      });
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/v1/curriculum/daily-plans/p-1/items",
        expect.objectContaining({ assignmentId: "a-1" })
      );

      await teacherApi.deletePlanItem("item-1");
      expect(axiosClient.delete).toHaveBeenCalledWith(
        "/api/v1/curriculum/daily-plans/items/item-1"
      );

      await teacherApi.getDailyPlans("c-1");
      expect(axiosClient.get).toHaveBeenCalledWith(
        "/api/v1/curriculum/daily-plans/classrooms/c-1"
      );

      await teacherApi.getDayAssignments("p-1");
      expect(axiosClient.get).toHaveBeenCalledWith(
        "/api/v1/curriculum/daily-plans/p-1/assignments"
      );

      await teacherApi.getDailyProgressStats("c-1");
      expect(axiosClient.get).toHaveBeenCalledWith(
        "/api/v1/curriculum/daily-plans/classrooms/c-1/progress-stats"
      );

      await teacherApi.getGlobalResources();
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/admin/resources?type=DOC");

      await teacherApi.getStudentClassroomSubmissions("c-1", "s-1");
      expect(axiosClient.get).toHaveBeenCalledWith(
        "/api/v1/teacher/classrooms/c-1/students/s-1/submissions"
      );

      await teacherApi.getSubmissionsForGrading("a-1");
      expect(axiosClient.get).toHaveBeenCalledWith(
        "/api/v1/teacher/assignments/a-1/submissions"
      );

      await teacherApi.getSubmissionDetail("att-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/teacher/submissions/att-1");

      await teacherApi.gradeSubmission("att-1", {
        score: 8.5,
        feedback: "Good work",
        answerScores: { q1: 4.5, q2: 4.0 },
      });
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/v1/teacher/submissions/att-1/grade",
        {
          finalScore: 8.5,
          feedback: "Good work",
          answerScores: { q1: 4.5, q2: 4.0 },
        }
      );

      await teacherApi.getClassExams("c-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/teacher/classrooms/c-1/exams");

      await teacherApi.getQuestionBank("c-1");
      expect(axiosClient.get).toHaveBeenCalledWith(
        "/api/v1/teacher/classrooms/c-1/question-bank"
      );

      await teacherApi.generateExamDraft({
        topic: "Travel",
        targetCefr: "B1",
        sections: [{ skillType: "READING", questionFormat: "MULTIPLE_CHOICE", questionCount: 5 }],
      });
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/v1/ai/exam/generate-draft",
        expect.objectContaining({ topic: "Travel", targetCefr: "B1" }),
        { timeout: 120000 }
      );

      await teacherApi.generateAiQuiz({
        topic: "Environment",
        level: "B2",
        questionCount: 5,
        lessonId: "l-1",
        exerciseType: "READING_MULTIPLE_CHOICE",
        skillType: "READING",
        assignmentType: "HOMEWORK",
      });
      expect(axiosClient.post).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/v1/ai/exercise/generate-quiz?targetCefr=B2&count=5&lessonId=l-1&exerciseType=READING_MULTIPLE_CHOICE&skillType=READING&assignmentType=HOMEWORK"
        ),
        "Environment",
        { headers: { "Content-Type": "text/plain" }, timeout: 120000 }
      );

      await teacherApi.publishAiQuiz("ex-1", "c-1");
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/v1/ai/exercise/ex-1/publish?classroomId=c-1"
      );

      await teacherApi.createClassAnnouncement("c-1", {
        title: "Welcome",
        content: "Class starts Monday",
      });
      expect(axiosClient.post).toHaveBeenCalledWith("/api/v1/notifications/broadcast", {
        title: "Welcome",
        message: "Class starts Monday",
        notificationType: "ANNOUNCEMENT",
        classroomId: "c-1",
      });

      await teacherApi.getClassAnnouncements("c-1");
      expect(axiosClient.get).toHaveBeenCalledWith("/api/v1/notifications/classrooms/c-1");

      await teacherApi.synthesizeAudio({
        text: "Hello class",
        voice: "af_heart",
        speed: "1.0x",
      });
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/api/v1/teacher/assignments/synthesize-audio",
        { text: "Hello class", voice: "af_heart", speed: "1.0x" },
        { timeout: 120000 }
      );
    });
  });

  // =========================================================================
  // 2. useCreateAssignmentForm Hook Tests
  // =========================================================================
  describe("useCreateAssignmentForm hook", () => {
    beforeEach(() => {
      vi.spyOn(teacherApi, "getGlobalResources").mockResolvedValue({
        data: { data: [{ id: "res-1", fileName: "IELTS_Reading.pdf" }] },
      } as any);
      vi.spyOn(teacherApi, "getDailyPlans").mockResolvedValue({
        data: {
          data: [
            {
              id: "plan-1",
              dayNumber: 1,
              title: "DAY 1",
              scheduledDate: "2026-05-10",
              items: [],
            },
          ],
        },
      } as any);
    });

    it("syncs initialDate, initialSkillType, and initialPlanId in CREATE mode", async () => {
      const { result } = renderHook(() =>
        useCreateAssignmentForm({
          isOpen: true,
          classId: "class-1",
          initialDate: "2026-05-10",
          initialSkillType: "LISTENING",
          initialPlanId: "plan-1",
          onClose: vi.fn(),
        })
      );

      await waitFor(() => {
        expect(result.current.dailyPlans.length).toBe(1);
      });

      expect(result.current.assignmentType).toBe("LISTENING");
      expect(result.current.scheduledDate).toBe("2026-05-10");
      expect(result.current.selectedPlanId).toBe("plan-1");
      expect(result.current.step).toBe(1);
    });

    it("adds, updates, and removes questions across CBT types and validates before saving", async () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useCreateAssignmentForm({
          isOpen: true,
          classId: "class-1",
          onClose,
        })
      );

      await waitFor(() => expect(result.current.dailyPlans.length).toBe(1));

      // Add a default question
      act(() => {
        result.current.handleAddBlankQuestion();
      });
      expect(result.current.questions.length).toBe(1);

      const qId = result.current.questions[0].id;

      // Try saving with empty prompt -> validation error alert
      await act(async () => {
        await result.current.handleFinalSave();
      });
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining("Cần sửa")
      );

      // Update question to valid MULTIPLE_CHOICE
      act(() => {
        result.current.handleUpdateQuestion(qId, "questionType", "MULTIPLE_CHOICE");
        result.current.handleUpdateQuestion(qId, "prompt", "What is the capital of France?");
        result.current.handleUpdateQuestion(qId, "options", [
          "Paris",
          "London",
          "Berlin",
          "Rome",
        ]);
        result.current.handleUpdateQuestion(qId, "correctAnswer", "Paris");
      });

      expect(result.current.questions[0].options).toEqual(["Paris", "London", "Berlin", "Rome"]);

      // Add a second question and remove it
      act(() => {
        result.current.handleAddBlankQuestion();
      });
      expect(result.current.questions.length).toBe(2);
      const q2Id = result.current.questions[1].id;
      act(() => {
        result.current.handleDeleteQuestion(q2Id);
      });
      expect(result.current.questions.length).toBe(1);
    });

    it("generates AI questions and synthesizes Kokoro TTS audio", async () => {
      vi.spyOn(teacherApi, "generateAiQuiz").mockResolvedValue({
        data: {
          data: {
            readingPassage: "Coffee is a popular drink.",
            questions: [
              {
                promptText: "What is popular?",
                questionType: "MULTIPLE_CHOICE",
                options: [
                  { optionText: "Coffee", isCorrect: true },
                  { optionText: "Tea", isCorrect: false },
                ],
                correctAnswer: "Coffee",
                explanation: "Stated in sentence 1.",
              },
            ],
          },
        },
      } as any);

      vi.spyOn(teacherApi, "synthesizeAudio").mockResolvedValue({
        data: { data: "/uploads/tts_sample.wav" },
      } as any);

      const { result } = renderHook(() =>
        useCreateAssignmentForm({
          isOpen: true,
          classId: "class-1",
          onClose: vi.fn(),
        })
      );

      await waitFor(() => expect(result.current.dailyPlans.length).toBe(1));

      await act(async () => {
        await result.current.handleGenerateAiQuestions("Coffee Culture");
      });

      expect(teacherApi.generateAiQuiz).toHaveBeenCalled();
      expect(result.current.questions.length).toBe(1);
      expect(result.current.questions[0].prompt).toBe("What is popular?");
      expect(result.current.readingPassageText).toBe("Coffee is a popular drink.");

      // Test Kokoro TTS synthesis for LISTENING
      act(() => {
        result.current.setAssignmentType("LISTENING");
        result.current.setMainTranscript("Welcome to the listening test.");
      });

      await act(async () => {
        await result.current.handleSynthesizeNeuralAudio();
      });

      expect(teacherApi.synthesizeAudio).toHaveBeenCalledWith({
        text: "Welcome to the listening test.",
        voice: "af_heart",
        speed: "1x",
      });
      expect(result.current.mainAudioUrl).toBe("/uploads/tts_sample.wav");
    });

    it("strips A./B. prefixes without corrupting correctAnswer and keeps READING_MATCHING as MULTIPLE_CHOICE & READING_YES_NO as TRUE_FALSE", async () => {
      const { result } = renderHook(() =>
        useCreateAssignmentForm({
          isOpen: true,
          classId: "class-1",
          onClose: vi.fn(),
        })
      );

      await waitFor(() => expect(result.current.dailyPlans.length).toBe(1));

      // Case 1: READING_MATCHING with 4 options and "B. went"-style answer
      act(() => {
        result.current.setAssignmentType("READING");
        result.current.setAiLevel("IELTS");
        result.current.setReadingPassageIelts(2);
        result.current.setSelectedSubFormat("READING_MATCHING");
      });

      vi.spyOn(teacherApi, "generateAiQuiz").mockResolvedValueOnce({
        data: {
          data: {
            rawResponseJson: JSON.stringify({
              readingPassage: "[Paragraph A] Solar growth.",
              questions: [
                {
                  questionType: "MULTIPLE_CHOICE",
                  prompt: "Best heading for Paragraph A?",
                  options: ["A. Decline", "B. Solar expansion", "C. Coal", "D. Mining"],
                  correctAnswer: "B. Solar expansion",
                  explanation: "Đoạn A nói về mở rộng điện mặt trời.",
                },
              ],
            }),
          },
        },
      } as any);

      await act(async () => {
        await result.current.handleGenerateAiQuestions("Solar Energy");
      });

      expect(teacherApi.generateAiQuiz).toHaveBeenLastCalledWith(
        expect.objectContaining({
          topic: "Passage 2: Solar Energy",
          level: "IELTS",
          exerciseType: "READING_MATCHING",
        })
      );
      expect(result.current.questions[0].questionType).toBe("MULTIPLE_CHOICE");
      expect(result.current.questions[0].options).toEqual([
        "Decline",
        "Solar expansion",
        "Coal",
        "Mining",
      ]);
      expect(result.current.questions[0].correctAnswer).toBe("Solar expansion");

      // Case 2: READING_YES_NO normalizes NOT GIVEN and YES
      act(() => {
        result.current.setSelectedSubFormat("READING_YES_NO");
      });

      vi.spyOn(teacherApi, "generateAiQuiz").mockResolvedValueOnce({
        data: {
          data: {
            rawResponseJson: JSON.stringify({
              readingPassage: "Short passage.",
              questions: [
                {
                  questionType: "TRUE_FALSE",
                  prompt: "Statement 1",
                  correctAnswer: "NOT GIVEN",
                  explanation: "Không có trong bài.",
                },
                {
                  questionType: "TRUE_FALSE",
                  prompt: "Statement 2",
                  correctAnswer: "YES",
                  explanation: "Khớp quan điểm tác giả.",
                },
              ],
            }),
          },
        },
      } as any);

      await act(async () => {
        await result.current.handleGenerateAiQuestions("Passage 3: Ethics");
      });

      expect(result.current.questions[0].questionType).toBe("TRUE_FALSE");
      expect(result.current.questions[0].options).toEqual(["TRUE", "FALSE", "NOT GIVEN"]);
      expect(result.current.questions[0].correctAnswer).toBe("NOT GIVEN");
      expect(result.current.questions[1].correctAnswer).toBe("TRUE");
    });

    it("loads EDIT mode initialData and preserves TRUE_FALSE, MATCHING, and MULTIPLE_CHOICE options on save", async () => {
      const updateSpy = vi
        .spyOn(teacherApi, "updateAssignment")
        .mockResolvedValue({ data: { data: { id: "assign-edit-1" } } } as any);
      const onClose = vi.fn();
      const onSuccess = vi.fn();

      const initialData = {
        id: "assign-edit-1",
        title: "Mixed CBT Assignment",
        description: "[READING PASSAGE]\nSample passage text.\n\nFollow instructions.",
        skillType: "READING",
        timeLimitMinutes: 40,
        maxAllowedErrorPercent: 25,
        maxAttempts: 2,
        dueDate: "2026-06-01T00:00:00.000Z",
        questions: [
          {
            id: "q-mc",
            promptText: "Choose the synonym of Rapid:",
            questionType: "MULTIPLE_CHOICE",
            correctAnswer: "Fast",
            points: 2,
            options: [
              { optionText: "Fast", isCorrect: true },
              { optionText: "Slow", isCorrect: false },
              { optionText: "   ", isCorrect: false },
            ],
          },
          {
            id: "q-tf",
            promptText: "The Earth orbits the Sun.",
            questionType: "TRUE_FALSE",
            correctAnswer: "TRUE",
            points: 1,
            options: [
              { optionText: "TRUE", isCorrect: true },
              { optionText: "FALSE", isCorrect: false },
              { optionText: "NOT GIVEN", isCorrect: false },
            ],
          },
          {
            id: "q-match",
            promptText: "Abundant",
            questionType: "MATCHING",
            correctAnswer: "",
            points: 1,
            options: [
              { optionText: "Abundant", matchText: "Plentiful", isCorrect: true },
            ],
          },
        ],
      };

      const { result } = renderHook(() =>
        useCreateAssignmentForm({
          isOpen: true,
          classId: "class-1",
          mode: "EDIT",
          initialData,
          onClose,
          onSuccess,
        })
      );

      await waitFor(() => {
        expect(result.current.step).toBe(2);
      });

      expect(result.current.readingPassageText).toBe("Sample passage text.");
      expect(result.current.questions).toHaveLength(3);
      // Verify fallbackMatchAns populated correctAnswer for MATCHING
      expect(result.current.questions[2].correctAnswer).toBe("Plentiful");

      await act(async () => {
        await result.current.handleFinalSave();
      });

      expect(updateSpy).toHaveBeenCalledTimes(1);
      const [updatedId, payload] = updateSpy.mock.calls[0];
      expect(updatedId).toBe("assign-edit-1");
      expect(payload.questions).toHaveLength(3);

      // 1. MULTIPLE_CHOICE filtered out blank option
      expect(payload.questions[0].options).toEqual([
        { optionText: "Fast", isCorrect: true },
        { optionText: "Slow", isCorrect: false },
      ]);

      // 2. TRUE_FALSE preserved 3 options
      expect(payload.questions[1].options).toEqual([
        { optionText: "TRUE", isCorrect: true },
        { optionText: "FALSE", isCorrect: false },
        { optionText: "NOT GIVEN", isCorrect: false },
      ]);

      // 3. MATCHING preserved optionText + matchText
      expect(payload.questions[2].options).toEqual([
        { optionText: "Abundant", matchText: "Plentiful", isCorrect: true },
      ]);

      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it("cleans up #main-assignment-audio DOM element when modal closes", async () => {
      const dummyAudio = document.createElement("audio");
      dummyAudio.id = "main-assignment-audio";
      const pauseSpy = vi.spyOn(dummyAudio, "pause").mockImplementation(() => {});
      document.body.appendChild(dummyAudio);

      const { rerender } = renderHook(
        ({ isOpen }) =>
          useCreateAssignmentForm({
            isOpen,
            classId: "class-1",
            onClose: vi.fn(),
          }),
        { initialProps: { isOpen: true } }
      );

      expect(document.getElementById("main-assignment-audio")).not.toBeNull();

      rerender({ isOpen: false });

      expect(pauseSpy).toHaveBeenCalled();
      expect(document.getElementById("main-assignment-audio")).toBeNull();
    });
  });

  // =========================================================================
  // 3. useTeacherDailyPlan Hook Tests
  // =========================================================================
  describe("useTeacherDailyPlan hook", () => {
    beforeEach(() => {
      vi.spyOn(teacherApi, "getDailyPlans").mockResolvedValue({
        data: {
          data: [
            {
              id: "plan-1",
              dayNumber: 1,
              title: "DAY 1: Intro",
              scheduledDate: "2026-05-01",
              estimatedMinutes: 45,
              items: [{ id: "item-1", title: "Task 1", itemType: "ASSIGNMENT" }],
            },
          ],
        },
      } as any);
      vi.spyOn(teacherApi, "getGlobalResources").mockResolvedValue({
        data: { data: [{ id: "res-1", fileName: "Vocab.pdf", resourceType: "DOC" }] },
      } as any);
      vi.spyOn(teacherApi, "getDailyProgressStats").mockResolvedValue({
        data: { data: [{ studentId: "s-1", fullName: "Alice", completionPercentage: 100 }] },
      } as any);
      vi.spyOn(teacherApi, "getClassAssignments").mockResolvedValue({
        data: { data: [{ id: "a-1", title: "Reading HW 1", skillType: "READING" }] },
      } as any);
    });

    it("loads daily plans, assignments, resources, and progress stats and guards against double-submit", async () => {
      let resolveCreatePlan: (v: any) => void;
      const createPlanSpy = vi.spyOn(teacherApi, "createDailyPlan").mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreatePlan = resolve;
          }) as any
      );

      const { result } = renderHook(() => useTeacherDailyPlan("class-1"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.plans).toHaveLength(1);
      expect(result.current.classAssignments).toHaveLength(1);
      expect(result.current.globalResources).toHaveLength(1);
      expect(result.current.progressStats).toHaveLength(1);

      act(() => {
        result.current.openCreateModal();
      });
      expect(result.current.showModal).toBe(true);
      expect(result.current.dayNumber).toBe(2);

      // Trigger two rapid form submissions before the first promise resolves
      const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
      act(() => {
        void result.current.handleSavePlan(fakeEvent);
        void result.current.handleSavePlan(fakeEvent);
      });

      expect(createPlanSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveCreatePlan!({ data: { data: { id: "plan-2" } } });
      });
      expect(result.current.showModal).toBe(false);
    });

    it("adds items to a daily plan with double-submit protection and handles view/edit/delete assignment", async () => {
      const addItemSpy = vi
        .spyOn(teacherApi, "addPlanItem")
        .mockResolvedValue({ data: {} } as any);
      const getAssignSpy = vi
        .spyOn(teacherApi, "getAssignment")
        .mockResolvedValue({
          data: { data: { id: "a-1", title: "Reading HW 1", questions: [] } },
        } as any);
      const deleteAssignSpy = vi
        .spyOn(teacherApi, "deleteAssignment")
        .mockResolvedValue({ data: {} } as any);

      const { result } = renderHook(() => useTeacherDailyPlan("class-1"));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.openAddItemModal("plan-1");
      });
      expect(result.current.showAddItemModal).toBe(true);
      expect(result.current.selectedAssignmentId).toBe("a-1");

      const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
      await act(async () => {
        await result.current.handleAddItemToPlan(fakeEvent);
      });

      expect(addItemSpy).toHaveBeenCalledWith("plan-1", {
        sectionName: "Bài tập cần làm",
        title: "Reading HW 1",
        itemType: "ASSIGNMENT",
        orderIndex: 2,
        assignmentId: "a-1",
      });

      await act(async () => {
        await result.current.handleViewAssignment("a-1");
      });
      expect(getAssignSpy).toHaveBeenCalledWith("a-1");
      expect(result.current.showAssignmentDetailsModal).toBe(true);

      await act(async () => {
        await result.current.handleEditAssignment("a-1");
      });
      expect(result.current.showEditAssignmentModal).toBe(true);

      await act(async () => {
        await result.current.handleDeleteAssignment("a-1", "Reading HW 1");
      });
      expect(deleteAssignSpy).toHaveBeenCalledWith("a-1");
    });
  });

  // =========================================================================
  // 4. useTeacherGrading Hook Tests
  // =========================================================================
  describe("useTeacherGrading hook", () => {
    it("filters gradable assignments, prevents stale detail race conditions, and saves grades", async () => {
      vi.spyOn(teacherApi, "getClassAssignments").mockResolvedValue({
        data: {
          data: [
            { id: "a-mc", title: "Grammar MC Only", skillType: "GRAMMAR", isExam: false, questions: [{ questionType: "MULTIPLE_CHOICE" }] },
            { id: "a-writing", title: "IELTS Writing Task 2", skillType: "WRITING", isExam: false, questions: [] },
            { id: "a-exam", title: "Midterm Exam", skillType: "READING", isExam: true, questions: [] },
          ],
        },
      } as any);

      const sub1 = {
        attemptId: "att-1",
        studentId: "s-1",
        studentName: "Nguyen Van A",
        studentEmail: "a@student.edu",
        submittedAt: "2026-05-10T08:00:00Z",
        status: "SUBMITTED",
        score: null,
      };
      const sub2 = {
        attemptId: "att-2",
        studentId: "s-2",
        studentName: "Tran Thi B",
        studentEmail: "b@student.edu",
        submittedAt: "2026-05-10T09:00:00Z",
        status: "COMPLETED",
        score: 8.0,
      };

      vi.spyOn(teacherApi, "getSubmissionsForGrading").mockResolvedValue({
        data: { data: [sub1, sub2] },
      } as any);

      let resolveFirst: (val: any) => void;
      let resolveSecond: (val: any) => void;

      vi.spyOn(teacherApi, "getSubmissionDetail")
        .mockImplementationOnce(
          () =>
            new Promise((r) => {
              resolveFirst = r;
            }) as any
        )
        .mockImplementationOnce(
          () =>
            new Promise((r) => {
              resolveSecond = r;
            }) as any
        );

      const gradeSpy = vi
        .spyOn(teacherApi, "gradeSubmission")
        .mockResolvedValue({ data: {} } as any);

      const { result } = renderHook(() => useTeacherGrading("class-1"));

      await waitFor(() => {
        expect(result.current.assignments).toHaveLength(2);
      });
      // Only a-writing and a-exam should be kept
      expect(result.current.assignments.map((a) => a.id)).toEqual(["a-writing", "a-exam"]);

      await waitFor(() => {
        expect(result.current.submissions).toHaveLength(2);
      });

      // Now click sub2 before sub1's initial detail request resolves
      act(() => {
        void result.current.handleSelectSubmission(sub2 as any);
      });

      // Resolve sub2 first, then resolve stale sub1
      await act(async () => {
        resolveSecond!({
          data: {
            data: {
              attemptId: "att-2",
              studentName: "Tran Thi B",
              skillType: "WRITING",
              isExam: true,
              score: 8.0,
              teacherFeedback: "Great job",
              questions: [
                { questionId: "q-1", questionType: "ESSAY", earnedPoints: 4.0, points: 5 },
              ],
            },
          },
        });
      });

      await act(async () => {
        resolveFirst!({
          data: {
            data: {
              attemptId: "att-1",
              studentName: "Nguyen Van A",
              skillType: "WRITING",
              score: 5.0,
              teacherFeedback: "Stale response",
              questions: [],
            },
          },
        });
      });

      // State must reflect sub2 ("Tran Thi B"), NOT stale sub1
      expect(result.current.submissionDetail?.attemptId).toBe("att-2");
      expect(result.current.inputScore).toBe("8");
      expect(result.current.feedback).toBe("Great job");
      expect(result.current.answerScores).toEqual({ "q-1": 4.0 });

      // Update per-question score and overall score, then save grade
      act(() => {
        result.current.handleUpdateQuestionScore("q-1", 4.5);
        result.current.setInputScore("9.0");
        result.current.setFeedback("Excellent revision");
      });

      const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
      await act(async () => {
        await result.current.handleSaveGrade(fakeEvent);
      });

      expect(gradeSpy).toHaveBeenCalledWith("att-2", {
        score: 9.0,
        feedback: "Excellent revision",
        answerScores: { "q-1": 4.5 },
      });
      expect(result.current.saveSuccess).toContain("9");

      // Test statusFilter and search
      expect(result.current.pendingCount).toBe(1);
      expect(result.current.completedCount).toBe(1);

      act(() => {
        result.current.setStatusFilter("PENDING");
      });
      expect(result.current.filteredSubmissions).toHaveLength(1);
      expect(result.current.filteredSubmissions[0].attemptId).toBe("att-1");
    });
  });

  // =========================================================================
  // 5. Non-blocking Daily Plan Assignment & Notification UX Tests
  // =========================================================================
  describe("Non-blocking daily plan assignment flow", () => {
    it("useCreateAssignmentForm CREATE mode closes modal immediately, emits PROCESSING then SUCCESS + daily-plan-updated", async () => {
      let resolveCreate!: (val: any) => void;
      const createPromise = new Promise((res) => {
        resolveCreate = res;
      });

      vi.spyOn(teacherApi, "getGlobalResources").mockResolvedValue({
        data: { data: [] },
      } as any);
      vi.spyOn(teacherApi, "getDailyPlans").mockResolvedValue({
        data: {
          data: [
            {
              id: "plan-1",
              dayNumber: 1,
              title: "DAY 1",
              scheduledDate: "2026-05-10",
              items: [],
            },
            {
              id: "plan-17",
              dayNumber: 17,
              title: "DAY 17",
              scheduledDate: "2026-05-26",
              items: [],
            },
          ],
        },
      } as any);
      const createAssignSpy = vi
        .spyOn(teacherApi, "createAssignment")
        .mockReturnValue(createPromise as any);
      const createPlanSpy = vi
        .spyOn(teacherApi, "createDailyPlan")
        .mockResolvedValue({
          data: {
            data: {
              id: "plan-18",
              dayNumber: 18,
              title: "DAY 18",
              scheduledDate: "2026-05-27",
              items: [],
            },
          },
        } as any);
      const addPlanItemSpy = vi
        .spyOn(teacherApi, "addPlanItem")
        .mockResolvedValue({ data: { data: { id: "item-new" } } } as any);

      const onClose = vi.fn();
      const onSuccess = vi.fn();

      const toastEvents: any[] = [];
      const planUpdatedEvents: any[] = [];
      const onToast = (e: Event) =>
        toastEvents.push((e as CustomEvent).detail);
      const onPlanUpdated = (e: Event) =>
        planUpdatedEvents.push((e as CustomEvent).detail);

      window.addEventListener("teacher-task-toast", onToast);
      window.addEventListener("daily-plan-updated", onPlanUpdated);

      try {
        const { result } = renderHook(() =>
          useCreateAssignmentForm({
            isOpen: true,
            mode: "CREATE",
            classId: "c-1",
            initialDate: "2026-05-27",
            onClose,
            onSuccess,
          }),
        );

        await waitFor(() => {
          expect(teacherApi.getDailyPlans).toHaveBeenCalledWith("c-1");
        });

        act(() => {
          result.current.setTitle("Listening Practice Day 18");
          result.current.handleAddBlankQuestion();
        });

        const qId = result.current.questions[0].id;
        act(() => {
          result.current.handleUpdateQuestion(qId, "questionType", "MULTIPLE_CHOICE");
          result.current.handleUpdateQuestion(qId, "prompt", "What does the speaker say?");
          result.current.handleUpdateQuestion(qId, "options", ["A", "B", "C", "D"]);
          result.current.handleUpdateQuestion(qId, "correctAnswer", "A");
        });

        let savePromise!: Promise<void>;
        act(() => {
          savePromise = result.current.handleFinalSave();
        });

        // Modal closes immediately and shows PROCESSING without waiting for backend
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(toastEvents[0]?.status).toBe("PROCESSING");
        expect(createAssignSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
          resolveCreate({
            data: {
              data: { id: "assign-18", title: "Listening Practice Day 18" },
            },
          });
          await savePromise;
        });

        // Should compute nextDayNumber = 18 (maxDayNum 17 + 1) because 2026-05-27 has no plan yet
        expect(createPlanSpy).toHaveBeenCalledWith(
          "c-1",
          expect.objectContaining({
            dayNumber: 18,
            scheduledDate: "2026-05-27",
          }),
        );
        expect(addPlanItemSpy).toHaveBeenCalledWith(
          "plan-18",
          expect.objectContaining({
            assignmentId: "assign-18",
            title: "Listening Practice Day 18",
          }),
        );
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(planUpdatedEvents).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ classId: "c-1", planId: "plan-18" }),
          ]),
        );
        expect(toastEvents.some((t) => t.status === "SUCCESS")).toBe(true);
      } finally {
        window.removeEventListener("teacher-task-toast", onToast);
        window.removeEventListener("daily-plan-updated", onPlanUpdated);
      }
    });

    it("useCreateAssignmentForm CREATE mode emits ERROR notification asking to re-assign when createAssignment fails", async () => {
      vi.spyOn(teacherApi, "getGlobalResources").mockResolvedValue({
        data: { data: [] },
      } as any);
      vi.spyOn(teacherApi, "getDailyPlans").mockResolvedValue({
        data: {
          data: [
            {
              id: "plan-1",
              dayNumber: 1,
              title: "DAY 1",
              scheduledDate: "2026-05-10",
              items: [],
            },
          ],
        },
      } as any);
      vi.spyOn(teacherApi, "createAssignment").mockRejectedValue({
        response: { data: { message: "Timeout lưu bài tập" } },
      });

      const onClose = vi.fn();
      const toastEvents: any[] = [];
      const localNotifications: any[] = [];
      const onToast = (e: Event) =>
        toastEvents.push((e as CustomEvent).detail);
      const onLocalNotif = (e: Event) =>
        localNotifications.push((e as CustomEvent).detail);

      window.addEventListener("teacher-task-toast", onToast);
      window.addEventListener("teacher-notification-local", onLocalNotif);

      try {
        const { result } = renderHook(() =>
          useCreateAssignmentForm({
            isOpen: true,
            mode: "CREATE",
            classId: "c-1",
            initialDate: "2026-05-10",
            initialPlanId: "plan-1",
            onClose,
            onSuccess: vi.fn(),
          }),
        );

        await waitFor(() => {
          expect(teacherApi.getDailyPlans).toHaveBeenCalledWith("c-1");
        });

        act(() => {
          result.current.setTitle("Grammar Drill Error Case");
          result.current.handleAddBlankQuestion();
        });

        const qId = result.current.questions[0].id;
        act(() => {
          result.current.handleUpdateQuestion(qId, "questionType", "MULTIPLE_CHOICE");
          result.current.handleUpdateQuestion(qId, "prompt", "Q1?");
          result.current.handleUpdateQuestion(qId, "options", ["Yes", "No"]);
          result.current.handleUpdateQuestion(qId, "correctAnswer", "Yes");
        });

        await act(async () => {
          await result.current.handleFinalSave();
        });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(toastEvents.map((t) => t.status)).toEqual(["PROCESSING", "ERROR"]);
        expect(
          toastEvents.find((t) => t.status === "ERROR")?.title,
        ).toContain("Cần gán lại");
        expect(localNotifications).toHaveLength(1);
        expect(localNotifications[0].title).toContain("Lỗi gán bài tập");
      } finally {
        window.removeEventListener("teacher-task-toast", onToast);
        window.removeEventListener("teacher-notification-local", onLocalNotif);
      }
    });

    it("useTeacherDailyPlan.handleAddItemToPlan closes modal immediately and sends SUCCESS notification without blocking", async () => {
      let resolveAddItem!: (val: any) => void;
      const addItemPromise = new Promise((res) => {
        resolveAddItem = res;
      });

      vi.spyOn(teacherApi, "getDailyPlans").mockResolvedValue({
        data: {
          data: [
            {
              id: "plan-5",
              dayNumber: 5,
              title: "DAY 5",
              scheduledDate: "2026-05-15",
              items: [],
            },
          ],
        },
      } as any);
      vi.spyOn(teacherApi, "getClassAssignments").mockResolvedValue({
        data: { data: [{ id: "assign-9", title: "Reading Passage 5" }] },
      } as any);
      vi.spyOn(teacherApi, "getGlobalResources").mockResolvedValue({
        data: { data: [] },
      } as any);
      const addPlanItemSpy = vi
        .spyOn(teacherApi, "addPlanItem")
        .mockReturnValue(addItemPromise as any);

      const toastEvents: any[] = [];
      const onToast = (e: Event) =>
        toastEvents.push((e as CustomEvent).detail);
      window.addEventListener("teacher-task-toast", onToast);

      try {
        const { result } = renderHook(() => useTeacherDailyPlan("c-1"));

        await waitFor(() => {
          expect(result.current.plans).toHaveLength(1);
        });

        act(() => {
          result.current.openAddItemModal("plan-5");
        });
        expect(result.current.showAddItemModal).toBe(true);
        expect(result.current.selectedAssignmentId).toBe("assign-9");

        const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
        let submitPromise!: Promise<void>;
        act(() => {
          submitPromise = result.current.handleAddItemToPlan(fakeEvent);
        });

        // Modal closes immediately & emits PROCESSING before backend promise resolves
        expect(result.current.showAddItemModal).toBe(false);
        expect(toastEvents[0]?.status).toBe("PROCESSING");
        expect(addPlanItemSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
          resolveAddItem({ data: { data: { id: "item-99" } } });
          await submitPromise;
        });

        expect(toastEvents.map((t) => t.status)).toEqual([
          "PROCESSING",
          "SUCCESS",
        ]);
      } finally {
        window.removeEventListener("teacher-task-toast", onToast);
      }
    });

    it("useCreateAssignmentForm switches aiQuestionCount to 1 for WRITING and shows friendly Vietnamese timeout message on ECONNABORTED", async () => {
      vi.spyOn(teacherApi, "getGlobalResources").mockResolvedValue({
        data: { data: [] },
      } as any);
      vi.spyOn(teacherApi, "getDailyPlans").mockResolvedValue({
        data: { data: [] },
      } as any);
      vi.spyOn(teacherApi, "generateAiQuiz").mockRejectedValue({
        code: "ECONNABORTED",
        message: "timeout of 120000ms exceeded",
      });

      const { result } = renderHook(() =>
        useCreateAssignmentForm({
          isOpen: true,
          mode: "CREATE",
          classId: "c-1",
          initialSkillType: "READING",
          onClose: vi.fn(),
          onSuccess: vi.fn(),
        }),
      );

      expect(result.current.aiQuestionCount).toBe(5);

      act(() => {
        result.current.setAssignmentType("WRITING");
      });
      await waitFor(() => {
        expect(result.current.aiQuestionCount).toBe(1);
      });

      act(() => {
        result.current.setAssignmentType("READING");
      });
      await waitFor(() => {
        expect(result.current.aiQuestionCount).toBe(5);
      });

      act(() => {
        result.current.setAiTopic("Climate Change and Renewable Policy");
      });

      await act(async () => {
        await result.current.handleGenerateAiQuestions();
      });

      expect(result.current.aiError).toBe(
        "Quá thời gian chờ phản hồi từ AI (timeout). Vui lòng thử lại hoặc giảm số câu/đề.",
      );
    });
  });
});
