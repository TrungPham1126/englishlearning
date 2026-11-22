// src/features/student/api/studentApi.ts
import { axiosClient } from "@/lib/axiosClient";
import { useAuthStore } from "@/store/useAuthStore";
import type { ApiResponse } from "@/types/api";
import type {
  MyCourseResponse,
  LessonSummary,
  LessonDetailResponse,
  VideoResponse,
  VideoWatchHistory,
  StudentAssignmentSummaryResponse,
  AttemptResponse,
  StudentSkillProfile,
  SpeakingAiEvaluationResult,
  ShadowingEvaluationResponse,
  WritingAiEvaluationResult,
  WritingTaskType,
  DailyHomeworkOverviewResponse,
  StudentStreakResponse,
  ReadingShortAnswerEvaluationResult,
  TtsRequest,
  TtsResponse,
  ExerciseAudioResponse,
  KokoroVoice,
} from "../types";

let cachedMyCourses: {
  userId: string;
  data: MyCourseResponse[];
  timestamp: number;
} | null = null;

function normalizeAttemptResponse(raw: AttemptResponse): AttemptResponse {
  if (!raw) return raw;
  return {
    ...raw,
    questions: Array.isArray(raw.questions) ? raw.questions : [],
  };
}

function normalizeShadowingEvaluation(
  raw: ShadowingEvaluationResponse,
): ShadowingEvaluationResponse {
  if (!raw) return raw;
  return {
    ...raw,
    sentenceTokens: Array.isArray(raw.sentenceTokens) ? raw.sentenceTokens : [],
    wordRows: Array.isArray(raw.wordRows)
      ? raw.wordRows.map((row) => ({
          ...row,
          phonemes: Array.isArray(row?.phonemes) ? row.phonemes : [],
        }))
      : [],
  };
}

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
  getMyCourses: async (forceRefresh = false): Promise<MyCourseResponse[]> => {
    const now = Date.now();
    const userId = useAuthStore.getState().user?.id || "anon";
    if (
      !forceRefresh &&
      cachedMyCourses &&
      cachedMyCourses.userId === userId &&
      now - cachedMyCourses.timestamp < 60000
    ) {
      return cachedMyCourses.data;
    }
    const res = await axiosClient.get<ApiResponse<MyCourseResponse[]>>(
      "/api/student/classrooms/my-courses",
    );
    const data = Array.isArray(res.data?.data) ? res.data.data : [];
    cachedMyCourses = { userId, data, timestamp: now };
    return data;
  },

  invalidateCoursesCache: () => {
    cachedMyCourses = null;
  },

  leaveCourse: async (classId: string): Promise<void> => {
    cachedMyCourses = null;
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
    const d = res.data.data;
    return {
      ...d,
      documents: Array.isArray(d?.documents) ? d.documents : [],
      vocabularies: Array.isArray(d?.vocabularies) ? d.vocabularies : [],
      grammarTopics: Array.isArray(d?.grammarTopics) ? d.grammarTopics : [],
    };
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
    return normalizeAttemptResponse(res.data.data);
  },

  submitAssignment: async (
    assignmentId: string,
    attemptId: string,
    answers: Array<{
      questionId: string;
      selectedOptionId?: string;
      textAnswer?: string;
    }>,
    extra?: {
      cheatingFlagged?: boolean;
      violationCount?: number;
      cheatingReason?: string;
      violationLogJson?: string;
    },
  ): Promise<AttemptResponse> => {
    const res = await axiosClient.post<ApiResponse<AttemptResponse>>(
      `/api/v1/student/assignments/${assignmentId}/attempts/${attemptId}/submit`,
      { assignmentId, answers, ...(extra || {}) },
    );
    return normalizeAttemptResponse(res.data.data);
  },

  recordExamViolation: async (
    attemptId: string,
    payload: {
      eventType: string;
      reason: string;
      currentAnswers?: Array<{
        questionId: string;
        selectedOptionId?: string;
        textAnswer?: string;
      }>;
    },
  ): Promise<AttemptResponse> => {
    const res = await axiosClient.post<ApiResponse<AttemptResponse>>(
      `/api/v1/student/assignments/attempts/${attemptId}/violation`,
      payload,
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
    options?: {
      speakingMode?: string;
      keyPoints?: string;
    },
  ): Promise<SpeakingAiEvaluationResult> => {
    const formData = new FormData();
    formData.append("topic", topic);
    formData.append("audio", audioBlob, "speaking.webm");
    formData.append("studentAnswerId", studentAnswerId);
    if (options?.speakingMode) {
      formData.append("speakingMode", options.speakingMode);
    }
    if (options?.keyPoints && options.keyPoints.trim().length > 0) {
      formData.append("keyPoints", options.keyPoints.trim());
    }

    const res = await axiosClient.post<ApiResponse<SpeakingAiEvaluationResult>>(
      "/api/v1/ai/speaking/evaluate",
      formData,
    );
    const d = res.data.data;
    return {
      ...d,
      mistakes: Array.isArray(d?.mistakes) ? d.mistakes : [],
      suggestions: Array.isArray(d?.suggestions) ? d.suggestions : [],
    };
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
    return normalizeShadowingEvaluation(res.data.data);
  },

  // 4.3. Chấm bài viết tự luận Writing (Task Achievement, Grammar, Cohesion)
  evaluateWritingAI: async (
    topic: string,
    essayText: string,
    studentAnswerId: string,
    options?: { writingTask?: WritingTaskType },
  ): Promise<WritingAiEvaluationResult> => {
    const writingTaskQuery = options?.writingTask
      ? `&writingTask=${encodeURIComponent(options.writingTask)}`
      : "";
    const res = await axiosClient.post<ApiResponse<WritingAiEvaluationResult>>(
      `/api/v1/ai/writing/evaluate?topic=${encodeURIComponent(topic)}&studentAnswerId=${encodeURIComponent(studentAnswerId)}${writingTaskQuery}`,
      essayText,
      { headers: { "Content-Type": "text/plain" } },
    );
    const d = res.data.data;
    return {
      ...d,
      mistakes: Array.isArray(d?.mistakes) ? d.mistakes : [],
      suggestions: Array.isArray(d?.suggestions) ? d.suggestions : [],
    };
  },

  // 4.4. Đánh giá phát âm từ vựng / câu qua Whisper AI (0 - 100 điểm)
  evaluatePronunciationAI: async (
    audioBlob: Blob,
    referenceText: string,
  ): Promise<{
    overallScore: number;
    feedback?: string;
    wordScores?: { word: string; score: number; isAccurate: boolean; note?: string }[];
  }> => {
    const formData = new FormData();
    const filename = audioBlob.type.includes("wav") ? "pronunciation.wav" : "pronunciation.webm";
    formData.append("audio", audioBlob, filename);
    formData.append("referenceText", referenceText);

    const res = await axiosClient.post<
      ApiResponse<{
        overallScore: number;
        feedback?: string;
        wordScores?: { word: string; score: number; isAccurate: boolean; note?: string }[];
      }>
    >("/api/v1/ai/pronunciation/whisper-evaluate", formData);
    return res.data.data;
  },

  // ================= 5. HỒ SƠ NĂNG LỰC (ANALYTICS) =================
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
      ? `/api/v1/curriculum/daily-plans/classrooms/${classroomId}/student-overview?selectedDayId=${encodeURIComponent(selectedDayId)}`
      : `/api/v1/curriculum/daily-plans/classrooms/${classroomId}/student-overview`;
    const res =
      await axiosClient.get<ApiResponse<DailyHomeworkOverviewResponse>>(url);
    const d = res.data.data;
    return {
      ...d,
      days: Array.isArray(d?.days) ? d.days : [],
      currentSelectedDay: d?.currentSelectedDay
        ? {
            ...d.currentSelectedDay,
            sections: Array.isArray(d.currentSelectedDay.sections)
              ? d.currentSelectedDay.sections.map((sec) => ({
                  ...sec,
                  items: Array.isArray(sec?.items) ? sec.items : [],
                }))
              : [],
          }
        : null,
    };
  },

  getClassDailyPlans: async (classroomId: string): Promise<any[]> => {
    const res = await axiosClient.get<ApiResponse<any[]>>(
      `/api/v1/curriculum/daily-plans/classrooms/${classroomId}`,
    );
    return res.data.data || [];
  },

  getMyStreak: async (): Promise<StudentStreakResponse> => {
    const res = await axiosClient.get<ApiResponse<StudentStreakResponse>>(
      "/api/v1/curriculum/daily-plans/my-streak",
    );
    const d = res.data?.data;
    const rawStreak = typeof d?.currentStreak === "number" ? d.currentStreak : 0;
    return {
      currentStreak: Number.isFinite(rawStreak) && rawStreak >= 0 ? Math.floor(rawStreak) : 0,
      lastActiveDate: d?.lastActiveDate ?? null,
      hasHomeworkToday: Boolean(d?.hasHomeworkToday),
      completedToday: Boolean(d?.completedToday),
      todayCompletedTasks:
        typeof d?.todayCompletedTasks === "number" && d.todayCompletedTasks >= 0
          ? d.todayCompletedTasks
          : 0,
      todayTotalTasks:
        typeof d?.todayTotalTasks === "number" && d.todayTotalTasks >= 0
          ? d.todayTotalTasks
          : 0,
    };
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

  repairQuestionAudio: async (
    questionId: string,
    payload?: Partial<TtsRequest>,
  ): Promise<ExerciseAudioResponse> => {
    const res = await axiosClient.post<ApiResponse<ExerciseAudioResponse>>(
      `/api/v1/ai/tts/questions/${questionId}/repair`,
      payload ?? {},
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
    return Array.isArray(res.data?.data) ? res.data.data : [];
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
