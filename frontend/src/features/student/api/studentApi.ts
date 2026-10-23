// src/features/student/api/studentApi.ts
import { axiosClient } from "@/lib/axiosClient";
import type { ApiResponse, PageResponse } from "@/types/api";
import type {
  MyCourseResponse,
  LessonSummary,
  LessonDetailResponse,
  VideoResponse,
  VideoWatchHistory,
  StudentAssignmentSummaryResponse,
  AttemptResponse,
  StudentSkillProfile,
  VocabularyResponse,
  SpeakingAiEvaluationResult,
  ShadowingEvaluationResponse,
  WritingAiEvaluationResult,
  DailyHomeworkOverviewResponse,
  ReadingShortAnswerEvaluationResult,
  TtsRequest,
  TtsResponse,
  ExerciseAudioResponse,
  KokoroVoice,
} from "../types";

export const studentApi = {
  updateProfile: async (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    currentLevel?: string;
    targetCefr?: string;
    avatarUrl?: string;
  }) => {
    const res = await axiosClient.put("/api/v1/auth/me", data);
    return res.data.data;
  },

  updateAvatar: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axiosClient.post("/api/v1/users/avatar", formData);
    return res.data.data;
  },

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axiosClient.post("/api/v1/users/avatar", formData);
    return res.data.data;
  },




  // ================= 1. LỚP HỌC (CLASSROOMS) =================
  getMyCourses: async (): Promise<MyCourseResponse[]> => {
    const res = await axiosClient.get<ApiResponse<MyCourseResponse[]>>(
      "/api/student/classrooms/my-courses",
    );
    return res.data.data || [];
  },

  leaveCourse: async (classId: string): Promise<void> => {
    await axiosClient.post(`/api/student/classrooms/${classId}/leave`);
  },

  // ================= 2. GIÁO TRÌNH & BÀI HỌC (CURRICULUM) =================
  getClassLessons: async (classId: string): Promise<LessonSummary[]> => {
    const res = await axiosClient.get<ApiResponse<LessonSummary[]>>(
      `/api/curriculum/classes/${classId}/lessons`,
    );
    return res.data.data || [];
  },

  getLessonDetail: async (lessonId: string): Promise<LessonDetailResponse> => {
    const res = await axiosClient.get<ApiResponse<LessonDetailResponse>>(
      `/api/curriculum/lessons/${lessonId}`,
    );
    return res.data.data;
  },

  getVideoByLesson: async (lessonId: string): Promise<VideoResponse> => {
    const res = await axiosClient.get<ApiResponse<VideoResponse>>(
      `/api/v1/videos/lesson/${lessonId}`,
    );
    return res.data.data;
  },

  getVideoProgress: async (videoId: string): Promise<VideoWatchHistory> => {
    const res = await axiosClient.get<ApiResponse<VideoWatchHistory>>(
      `/api/v1/videos/${videoId}/progress`,
    );
    return res.data.data;
  },

  updateVideoProgress: async (
    videoId: string,
    watchedSeconds: number,
    completed: boolean = false,
  ): Promise<void> => {
    await axiosClient.post(`/api/v1/videos/${videoId}/progress`, {
      watchedSeconds,
      completed,
    });
  },

  // ================= 3. BÀI TẬP & NỘP BÀI (ASSIGNMENTS & ATTEMPTS) =================
  getClassAssignments: async (
    classId: string,
  ): Promise<StudentAssignmentSummaryResponse[]> => {
    const res = await axiosClient.get<
      ApiResponse<StudentAssignmentSummaryResponse[]>
    >(`/api/v1/student/classrooms/${classId}/assignments`);
    return res.data.data || [];
  },

  startAssignment: async (assignmentId: string): Promise<AttemptResponse> => {
    const res = await axiosClient.post<ApiResponse<AttemptResponse>>(
      `/api/v1/student/assignments/${assignmentId}/start`,
    );
    return res.data.data;
  },

  startAttempt: async (assignmentId: string): Promise<AttemptResponse> => {
    return studentApi.startAssignment(assignmentId);
  },

  getMyAttempts: async (assignmentId: string): Promise<AttemptResponse[]> => {
    const res = await axiosClient.get<ApiResponse<AttemptResponse[]>>(
      `/api/v1/student/assignments/${assignmentId}/attempts`,
    );
    return res.data.data || [];
  },

  getAttemptDetail: async (attemptId: string): Promise<AttemptResponse> => {
    const res = await axiosClient.get<ApiResponse<AttemptResponse>>(
      `/api/v1/student/assignments/attempts/${attemptId}`,
    );
    return res.data.data;
  },

  submitAssignment: async (
    assignmentId: string,
    attemptId: string,
    answers: Array<{
      questionId: string;
      selectedOptionId?: string;
      textAnswer?: string;
    }>,
  ): Promise<AttemptResponse> => {
    const res = await axiosClient.post<ApiResponse<AttemptResponse>>(
      `/api/v1/student/assignments/${assignmentId}/attempts/${attemptId}/submit`,
      { assignmentId, answers },
    );
    return res.data.data;
  },

  uploadSpeakingAudio: async (
    attemptId: string,
    questionId: string,
    audioBlob: Blob,
  ): Promise<AttemptResponse> => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    const res = await axiosClient.post<ApiResponse<AttemptResponse>>(
      `/api/v1/student/assignments/attempts/${attemptId}/questions/${questionId}/audio`,
      formData,
    );
    return res.data.data;
  },

  // ================= 4. CÁC ENGINE CHẤM AI (SPEAKING, SHADOWING, WRITING) =================

  // 4.1. Chấm IELTS Speaking tự do (LLaMA / Gemini)
  evaluateSpeakingAI: async (
    topic: string,
    audioBlob: Blob,
    studentAnswerId: string,
  ): Promise<SpeakingAiEvaluationResult> => {
    const formData = new FormData();
    formData.append("topic", topic);
    formData.append("audio", audioBlob, "speaking.webm");
    formData.append("studentAnswerId", studentAnswerId);

    const res = await axiosClient.post<ApiResponse<SpeakingAiEvaluationResult>>(
      "/api/v1/ai/speaking/evaluate",
      formData,
    );
    return res.data.data;
  },

  // 4.2. Chấm đọc theo câu Shadowing (Groq Whisper-large-v3 + LLaMA 3.3 70B <2s)
  evaluateShadowingAI: async (
    audioBlob: Blob,
    studentAnswerId?: string,
    referenceSentence?: string,
  ): Promise<ShadowingEvaluationResponse> => {
    const formData = new FormData();
    const filename = audioBlob.type.includes("wav") ? "shadowing.wav" : "shadowing.webm";
    formData.append("audio", audioBlob, filename);
    if (studentAnswerId && studentAnswerId !== "undefined" && studentAnswerId !== "null" && studentAnswerId.trim() !== "") {
      formData.append("studentAnswerId", studentAnswerId.trim());
    }
    if (referenceSentence && referenceSentence.trim() !== "") {
      formData.append("referenceSentence", referenceSentence.trim());
    }

    const res = await axiosClient.post<
      ApiResponse<ShadowingEvaluationResponse>
    >("/api/v1/ai/speaking/shadowing-evaluate", formData);
    return res.data.data;
  },

  // 4.3. Chấm bài viết tự luận Writing (Task Achievement, Grammar, Cohesion)
  evaluateWritingAI: async (
    topic: string,
    essayText: string,
    studentAnswerId: string,
  ): Promise<WritingAiEvaluationResult> => {
    const res = await axiosClient.post<ApiResponse<WritingAiEvaluationResult>>(
      `/api/v1/ai/writing/evaluate?topic=${encodeURIComponent(topic)}&studentAnswerId=${studentAnswerId}`,
      essayText,
      { headers: { "Content-Type": "text/plain" } },
    );
    return res.data.data;
  },

  // ================= 5. TỪ VỰNG FLASHCARDS (SPACED REPETITION) =================
  getDueFlashcards: async (
    limit: number = 20,
  ): Promise<PageResponse<VocabularyResponse>> => {
    const res = await axiosClient.get<
      ApiResponse<PageResponse<VocabularyResponse>>
    >(`/api/v1/student/vocabularies/due?limit=${limit}`);
    return res.data.data;
  },

  reviewFlashcard: async (
    vocabularyId: string,
    grade: 0 | 1 | 2 | 3,
  ): Promise<void> => {
    await axiosClient.post(
      `/api/v1/student/vocabularies/${vocabularyId}/review`,
      { grade },
    );
  },

  // ================= 6. HỒ SƠ NĂNG LỰC (ANALYTICS) =================
  getSkillProfile: async (): Promise<StudentSkillProfile> => {
    const res = await axiosClient.get<ApiResponse<StudentSkillProfile>>(
      "/api/v1/analytics/my-profile",
    );
    return res.data.data;
  },
  // ================= 7. BÀI TẬP HÀNG NGÀY (DAILY HOMEWORK) =================
  getDailyHomeworkOverview: async (
    classroomId: string,
    selectedDayId?: string,
  ): Promise<DailyHomeworkOverviewResponse> => {
    const url = selectedDayId
      ? `/api/v1/curriculum/daily-plans/classrooms/${classroomId}/student-overview?selectedDayId=${selectedDayId}`
      : `/api/v1/curriculum/daily-plans/classrooms/${classroomId}/student-overview`;
    const res =
      await axiosClient.get<ApiResponse<DailyHomeworkOverviewResponse>>(url);
    return res.data.data;
  },

  getClassDailyPlans: async (classroomId: string): Promise<any[]> => {
    const res = await axiosClient.get<ApiResponse<any[]>>(
      `/api/v1/curriculum/daily-plans/classrooms/${classroomId}`,
    );
    return res.data.data || [];
  },

  markDailyPlanComplete: async (planId: string): Promise<void> => {
    await axiosClient.post(`/api/v1/curriculum/daily-plans/${planId}/complete`);
  },

  // 8. ĐÁNH GIÁ ĐỌC HIỂU CÂU TRẢ LỜI NGẮN (READING SHORT ANSWER AI)
  evaluateReadingShortAnswerAI: async (
    passage: string,
    question: string,
    studentAnswer: string,
    expectedAnswer?: string,
  ): Promise<ReadingShortAnswerEvaluationResult> => {
    const res = await axiosClient.post<ApiResponse<ReadingShortAnswerEvaluationResult>>(
      "/api/v1/ai/reading/evaluate-short-answer",
      { passage, question, studentAnswer, expectedAnswer },
    );
    return res.data.data;
  },

  // 9. KOKORO-82M NEURAL TTS SYNTHESIZER & SELF-HEALING
  synthesizeTTS: async (params: TtsRequest): Promise<TtsResponse> => {
    const res = await axiosClient.post<ApiResponse<TtsResponse>>(
      "/api/v1/ai/tts",
      params,
    );
    return res.data.data;
  },

  repairQuestionAudio: async (questionId: string): Promise<ExerciseAudioResponse> => {
    const res = await axiosClient.post<ApiResponse<ExerciseAudioResponse>>(
      `/api/v1/ai/tts/questions/${questionId}/repair`
    );
    return res.data.data;
  },

  getQuestionAudioStatus: async (questionId: string): Promise<ExerciseAudioResponse> => {
    const res = await axiosClient.get<ApiResponse<ExerciseAudioResponse>>(
      `/api/v1/ai/tts/questions/${questionId}/status`
    );
    return res.data.data;
  },

  getKokoroVoices: async (): Promise<KokoroVoice[]> => {
    const res = await axiosClient.get<ApiResponse<KokoroVoice[]>>(
      "/api/v1/ai/tts/voices"
    );
    return res.data.data;
  },

  // 10. THÔNG BÁO HỆ THỐNG & LỚP HỌC (NOTIFICATIONS)
  getMyNotifications: async (page: number = 0, size: number = 30): Promise<any[]> => {
    const res: any = await axiosClient.get(`/api/v1/notifications?page=${page}&size=${size}`);
    const rawData = res.data?.data ?? res.data;
    const rawList = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData?.content)
      ? rawData.content
      : [];

    const dedupMap = new Map<string, any>();
    for (const item of rawList) {
      const text = (item.message || item.content || "").trim();
      const key = `${(item.title || "").trim()}||${text}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, item);
      } else {
        const existing = dedupMap.get(key)!;
        if ((!existing.isRead && item.isRead) || (!existing.recipientUserId && item.recipientUserId)) {
          dedupMap.set(key, { ...item, isRead: Boolean(existing.isRead || item.isRead) });
        }
      }
    }
    return Array.from(dedupMap.values());
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    try {
      await axiosClient.put(`/api/v1/notifications/${id}/read`);
    } catch {
      await axiosClient.patch(`/api/v1/notifications/${id}/read`);
    }
  },

  markAllNotificationsAsRead: async (): Promise<void> => {
    try {
      await axiosClient.put("/api/v1/notifications/read-all");
    } catch {
      await axiosClient.patch("/api/v1/notifications/read-all");
    }
  },
};
