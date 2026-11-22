import axiosClient from "@/lib/axiosClient";

export interface ClassroomItem {
  id: string;
  name: string;
  description: string;
  level: string;
  status: string;
  startDate: string;
  endDate: string;
  maxStudents: number;
  currentStudentsCount: number;
}

export interface StudentProgressItem {
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  enrolledAt: string;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  averageScore: number;
  weaknesses?: string[];
  attendanceScore?: number;
  totalStudyMinutes?: number;
  dailyProgress?: Record<string, number>;
}

export type DocumentFileType = "PDF" | "DOCX" | "PPTX" | "IMAGE" | "AUDIO";

export interface LessonDocumentItem {
  id: string;
  lessonId: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes?: number | null;
  fileType: DocumentFileType | string;
  createdAt?: string | null;
}

export interface LessonVocabularyItem {
  id: string;
  lessonId?: string;
  word: string;
  meaning: string;
  ipa?: string;
  audioUrl?: string | null;
  exampleSentence?: string;
  partOfSpeech?: string;
}

export interface LessonGrammarItem {
  id: string;
  lessonId?: string;
  title: string;
  ruleSummary: string;
  formula?: string | null;
  examples?: string | null;
}

export interface LessonDetailItem {
  id: string;
  classId: string;
  title: string;
  objectives?: string | null;
  content?: string | null;
  orderIndex: number;
  updatedAt?: string | null;
  documents: LessonDocumentItem[];
  vocabularies: LessonVocabularyItem[];
  grammarTopics: LessonGrammarItem[];
}

export interface LessonVideoItem {
  id: string;
  originalFileName?: string | null;
  rawStorageUrl?: string | null;
  hlsPlaylistUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
  status: string;
  rejectionReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lesson?: {
    id: string;
    title: string;
    orderIndex?: number;
    classroom?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface LessonItem {
  id: string;
  classId?: string;
  orderIndex: number;
  title: string;
  objectives?: string;
  content?: string;
  videoUrl?: string;
  hasVideo?: boolean;
  videoId?: string | null;
  videoStatus?: string | null;
  videoRejectionReason?: string | null;
  documentsCount?: number;
  vocabulariesCount?: number;
  grammarTopicsCount?: number;
}

export function detectDocumentFileType(file: File): DocumentFileType {
  const name = (file.name || "").trim().toLowerCase();
  const mime = (file.type || "").trim().toLowerCase();

  if (name.endsWith(".pdf") || mime === "application/pdf") {
    return "PDF";
  }
  if (
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt") ||
    mime.includes("word") ||
    mime === "text/plain"
  ) {
    return "DOCX";
  }
  if (
    name.endsWith(".ppt") ||
    name.endsWith(".pptx") ||
    mime.includes("presentation") ||
    mime.includes("powerpoint")
  ) {
    return "PPTX";
  }
  if (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name)
  ) {
    return "IMAGE";
  }
  if (
    mime.startsWith("audio/") ||
    /\.(mp3|wav|m4a|ogg|aac)$/i.test(name)
  ) {
    return "AUDIO";
  }
  return "PDF";
}

export interface StudentSubmissionItem {
  attemptId: string;
  assignmentId: string;
  assignmentTitle: string;
  skillType?: string | null;
  questionTypes?: string[];
  attemptNumber?: number;
  status: string;
  score?: number | null;
  teacherFeedback?: string | null;
  submittedAt?: string | null;
  dayNumber?: number | null;
  dayTitle?: string | null;
  scheduledDate?: string | null;
  hasAiEvaluation?: boolean;
  aiScore?: number | null;
  aiCefr?: string | null;
  aiEvalType?: string | null;
  previewText?: string | null;
  hasAudio?: boolean;
  isExam?: boolean;
  violationCount?: number;
  isCheatingFlagged?: boolean;
  cheatingReason?: string | null;
}

export interface QuestionBankItem {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  skillType?: string | null;
  questionType: string;
  promptText: string;
  mediaUrl?: string | null;
  transcript?: string | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  points?: number | null;
  options?: Array<{
    optionText: string;
    matchText?: string | null;
    isCorrect?: boolean | null;
  }>;
}

export interface AiExamSectionConfig {
  skillType: string;
  questionFormat: string;
  questionCount: number;
  pointsPerQuestion?: number;
}

export interface AiExamGeneratePayload {
  title?: string;
  topic: string;
  targetCefr: string;
  customInstructions?: string;
  sections: AiExamSectionConfig[];
}

export interface AiExamDraftResponse {
  title: string;
  description: string;
  listeningScript?: string | null;
  examSkills: string[];
  questions: Array<{
    skillType: string;
    questionType: string;
    promptText: string;
    transcript?: string | null;
    correctAnswer?: string | null;
    explanation?: string | null;
    points?: number;
    options?: Array<{
      optionText: string;
      matchText?: string | null;
      isCorrect?: boolean;
    }>;
  }>;
}

export const teacherApi = {
  // 1. Quản lý lớp học
  getAssignedClasses: () =>
    axiosClient.get<{ data: ClassroomItem[] }>("/api/teacher/classrooms"),
  getTeacherDashboardStats: () =>
    axiosClient.get<{ data: any }>("/api/v1/teacher/dashboard/stats"),
  getClassDetail: (classId: string) =>
    axiosClient.get<{ data: ClassroomItem }>(`/api/teacher/classrooms/${classId}`),

  // 2. Danh sách học sinh & AI Quota
  getClassStudents: (classId: string) =>
    axiosClient.get<{ data: any[] }>(
      `/api/teacher/classrooms/${classId}/students`,
    ),

  getAiQuotas: () =>
    axiosClient.get<{ data: any[] }>("/api/v1/admin/ai-monitoring/quotas"),

  // 3. Bài giảng & Tài nguyên
  getClassLessons: (classId: string) =>
    axiosClient.get<{ data: LessonItem[] }>(
      `/api/curriculum/classes/${classId}/lessons`,
    ),

  createLesson: (
    classId: string,
    data: { title: string; objectives: string; orderIndex?: number; content?: string },
  ) => axiosClient.post(`/api/curriculum/lessons`, { ...data, classId }),

  getLessonDetail: (lessonId: string) =>
    axiosClient.get<{ data: LessonDetailItem }>(
      `/api/curriculum/lessons/${lessonId}`,
    ),

  updateLesson: (
    lessonId: string,
    data: { title: string; objectives?: string; content?: string; orderIndex?: number },
  ) => axiosClient.put(`/api/curriculum/lessons/${lessonId}`, data),

  deleteLesson: (lessonId: string) =>
    axiosClient.delete(`/api/curriculum/lessons/${lessonId}`),

  uploadLessonDocument: (
    lessonId: string,
    file: File,
    fileType?: DocumentFileType,
  ) => {
    const resolvedType = fileType || detectDocumentFileType(file);
    const formData = new FormData();
    formData.append("file", file);
    return axiosClient.post(
      `/api/curriculum/lessons/${lessonId}/documents?fileType=${resolvedType}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
  },

  getLessonDocuments: (lessonId: string) =>
    axiosClient.get<{ data: LessonDocumentItem[] }>(
      `/api/curriculum/lessons/${lessonId}/documents`,
    ),

  updateDocument: (
    documentId: string,
    data: { fileName: string; fileType?: DocumentFileType },
  ) =>
    axiosClient.put<{ data: LessonDocumentItem }>(
      `/api/curriculum/documents/${documentId}`,
      data,
    ),

  replaceDocumentFile: (
    documentId: string,
    file: File,
    options?: { fileName?: string; fileType?: DocumentFileType },
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (options?.fileName && options.fileName.trim()) {
      formData.append("fileName", options.fileName.trim());
    }
    const resolvedType = options?.fileType || detectDocumentFileType(file);
    formData.append("fileType", resolvedType);
    return axiosClient.put<{ data: LessonDocumentItem }>(
      `/api/curriculum/documents/${documentId}/file`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
  },

  deleteDocument: (documentId: string) =>
    axiosClient.delete(`/api/curriculum/documents/${documentId}`),

  getLessonVocabularies: (lessonId: string) =>
    axiosClient.get<{ data: LessonVocabularyItem[] }>(
      `/api/curriculum/lessons/${lessonId}/vocabularies`,
    ),

  addVocabulary: (
    lessonId: string,
    data: {
      word: string;
      meaning: string;
      ipa?: string;
      exampleSentence?: string;
      partOfSpeech?: string;
    },
  ) =>
    axiosClient.post<{ data: LessonVocabularyItem }>(
      `/api/curriculum/lessons/${lessonId}/vocabularies`,
      data,
    ),

  updateVocabulary: (
    vocabId: string,
    data: {
      word: string;
      meaning: string;
      ipa?: string;
      exampleSentence?: string;
      partOfSpeech?: string;
    },
  ) =>
    axiosClient.put<{ data: LessonVocabularyItem }>(
      `/api/curriculum/vocabularies/${vocabId}`,
      data,
    ),

  deleteVocabulary: (vocabId: string) =>
    axiosClient.delete(`/api/curriculum/vocabularies/${vocabId}`),

  getLessonGrammarTopics: (lessonId: string) =>
    axiosClient.get<{ data: LessonGrammarItem[] }>(
      `/api/curriculum/lessons/${lessonId}/grammar`,
    ),

  addGrammarTopic: (
    lessonId: string,
    data: {
      title: string;
      ruleSummary: string;
      formula?: string;
      examples?: string;
    },
  ) =>
    axiosClient.post<{ data: LessonGrammarItem }>(
      `/api/curriculum/lessons/${lessonId}/grammar`,
      data,
    ),

  updateGrammarTopic: (
    topicId: string,
    data: {
      title: string;
      ruleSummary: string;
      formula?: string;
      examples?: string;
    },
  ) =>
    axiosClient.put<{ data: LessonGrammarItem }>(
      `/api/curriculum/grammar/${topicId}`,
      data,
    ),

  deleteGrammarTopic: (topicId: string) =>
    axiosClient.delete(`/api/curriculum/grammar/${topicId}`),

  getLessonVideo: (lessonId: string) =>
    axiosClient.get<{ data: LessonVideoItem | null }>(
      `/api/v1/videos/lesson/${lessonId}`,
    ),

  getMyUploadedVideos: (status?: string) => {
    const url =
      status && status !== "ALL"
        ? `/api/v1/videos/my-uploads?status=${encodeURIComponent(status)}`
        : "/api/v1/videos/my-uploads";
    return axiosClient.get<{ data: LessonVideoItem[] }>(url);
  },

  deleteVideo: (videoId: string) =>
    axiosClient.delete(`/api/v1/videos/${videoId}`),

  uploadLessonVideo: (
    lessonId: string,
    videoFile: File,
    onUploadProgress?: (percent: number) => void,
  ) => {
    const formData = new FormData();
    formData.append("file", videoFile);
    if (!onUploadProgress) {
      return axiosClient.post(`/api/v1/videos?lessonId=${lessonId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return axiosClient.post(`/api/v1/videos?lessonId=${lessonId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && progressEvent.total > 0) {
          onUploadProgress(
            Math.min(100, Math.round((progressEvent.loaded * 100) / progressEvent.total)),
          );
        }
      },
    });
  },

  // 4. Lộ trình & Assignment
  getClassAssignments: (classId: string, params?: { gradingOnly?: boolean }) =>
    axiosClient.get<{ data: any[] }>(
      `/api/v1/teacher/classrooms/${classId}/assignments`,
      { params },
    ),

  uploadAudioFile: (audioFile: File) => {
    const formData = new FormData();
    formData.append("file", audioFile);
    return axiosClient.post<{ data: string }>(
      "/api/v1/teacher/assignments/upload-audio",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
  },

  createAssignment: (data: any) =>
    axiosClient.post(`/api/v1/teacher/assignments`, data),

  getAssignment: (id: string) =>
    axiosClient.get<{ data: any }>(`/api/v1/teacher/assignments/${id}`),

  updateAssignment: (id: string, data: any) =>
    axiosClient.put(`/api/v1/teacher/assignments/${id}`, data),

  deleteAssignment: (id: string) =>
    axiosClient.delete(`/api/v1/teacher/assignments/${id}`),

  createDailyPlan: (classId: string, data: any) =>
    axiosClient.post(`/api/v1/curriculum/daily-plans`, {
      ...data,
      classroomId: classId,
    }),

  updateDailyPlan: (planId: string, data: any) =>
    axiosClient.put(`/api/v1/curriculum/daily-plans/${planId}`, data),

  deleteDailyPlan: (planId: string) =>
    axiosClient.delete(`/api/v1/curriculum/daily-plans/${planId}`),

  addPlanItem: (
    planId: string,
    data: {
      sectionName: string;
      title: string;
      itemType: string;
      orderIndex?: number;
      assignmentId?: string;
    },
  ) => axiosClient.post(`/api/v1/curriculum/daily-plans/${planId}/items`, data),

  deletePlanItem: (itemId: string) =>
    axiosClient.delete(`/api/v1/curriculum/daily-plans/items/${itemId}`),

  getDailyPlans: (classId: string) =>
    axiosClient.get(
      `/api/v1/curriculum/daily-plans/classrooms/${classId}`,
    ),
  getDayAssignments: (planId: string) =>
    axiosClient.get<{ data: any[] }>(
      `/api/v1/curriculum/daily-plans/${planId}/assignments`,
    ),
  getDailyProgressStats: (classId: string) =>
    axiosClient.get(
      `/api/v1/curriculum/daily-plans/classrooms/${classId}/progress-stats`,
    ),
  getGlobalResources: () =>
    axiosClient.get<{ data: any[] }>("/api/v1/admin/resources?type=DOC"),

  // 5. Chấm bài
  getStudentClassroomSubmissions: (classId: string, studentId: string) =>
    axiosClient.get<{ data: StudentSubmissionItem[] }>(
      `/api/v1/teacher/classrooms/${classId}/students/${studentId}/submissions`,
    ),

  getSubmissionsForGrading: (assignmentId: string) =>
    axiosClient.get<{ data: any[] }>(
      `/api/v1/teacher/assignments/${assignmentId}/submissions`,
    ),

  getSubmissionDetail: (attemptId: string) =>
    axiosClient.get<{ data: any }>(`/api/v1/teacher/submissions/${attemptId}`),

  gradeSubmission: (
    attemptId: string,
    data: {
      score: number;
      feedback: string;
      answerScores?: Record<string, number>;
    },
  ) =>
    axiosClient.post(`/api/v1/teacher/submissions/${attemptId}/grade`, {
      finalScore: data.score,
      feedback: data.feedback,
      ...(data.answerScores ? { answerScores: data.answerScores } : {}),
    }),

  // 5b. Bài thi & Ngân hàng câu hỏi của lớp
  getClassExams: (classId: string) =>
    axiosClient.get<{ data: any[] }>(
      `/api/v1/teacher/classrooms/${classId}/exams`,
    ),

  getQuestionBank: (classId: string) =>
    axiosClient.get<{ data: QuestionBankItem[] }>(
      `/api/v1/teacher/classrooms/${classId}/question-bank`,
    ),

  generateExamDraft: (payload: AiExamGeneratePayload) =>
    axiosClient.post<{ data: AiExamDraftResponse }>(
      `/api/v1/ai/exam/generate-draft`,
      payload,
      { timeout: 120000 },
    ),

  // 6. AI Lab
  generateAiQuiz: (data: {
    topic: string;
    level: string;
    questionCount: number;
    lessonId?: string;
    exerciseType?: string;
    skillType?: string;
    assignmentType?: string;
  }) => {
    const params = new URLSearchParams();
    params.append("targetCefr", data.level || "B2");
    params.append("count", String(data.questionCount || 5));
    if (data.lessonId && data.lessonId.trim()) {
      params.append("lessonId", data.lessonId.trim());
    }
    if (data.exerciseType && data.exerciseType.trim()) {
      params.append("exerciseType", data.exerciseType.trim());
    }
    if (data.skillType && data.skillType.trim()) {
      params.append("skillType", data.skillType.trim());
    }
    if (data.assignmentType && data.assignmentType.trim()) {
      params.append("assignmentType", data.assignmentType.trim());
    }

    return axiosClient.post(
      `/api/v1/ai/exercise/generate-quiz?${params.toString()}`,
      data.topic || "General English Practice",
      { headers: { "Content-Type": "text/plain" }, timeout: 120000 },
    );
  },

  publishAiQuiz: (exerciseId: string, classroomId: string) =>
    axiosClient.post(
      `/api/v1/ai/exercise/${exerciseId}/publish?classroomId=${classroomId}`,
    ),

  // 7. Thông báo lớp
  createClassAnnouncement: (
    classId: string,
    data: { title: string; content: string },
  ) =>
    axiosClient.post(`/api/v1/notifications/broadcast`, {
      title: data.title,
      message: data.content,
      notificationType: "ANNOUNCEMENT",
      classroomId: classId,
    }),

  getClassAnnouncements: (classId: string) =>
    axiosClient.get(`/api/v1/notifications/classrooms/${classId}`),

  // 8. Tổng hợp Neural Audio TTS
  synthesizeAudio: (data: { text: string; voice?: string; speed?: string }) =>
    axiosClient.post<{ data: string }>(
      "/api/v1/teacher/assignments/synthesize-audio",
      data,
      { timeout: 120000 },
    ),
};
