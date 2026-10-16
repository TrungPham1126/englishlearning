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

export interface LessonItem {
  id: string;
  orderIndex: number;
  title: string;
  objectives?: string;
  videoUrl?: string;
  hasVideo?: boolean;
  documentsCount?: number;
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

  deleteLesson: (lessonId: string) =>
    axiosClient.delete(`/api/curriculum/lessons/${lessonId}`),

  uploadLessonDocument: (lessonId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return axiosClient.post(
      `/api/curriculum/lessons/${lessonId}/documents?fileType=PDF`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
  },

  uploadLessonVideo: (lessonId: string, videoFile: File) => {
    const formData = new FormData();
    formData.append("file", videoFile);
    return axiosClient.post(`/api/v1/videos?lessonId=${lessonId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // 4. Lộ trình & Assignment
  getClassAssignments: (classId: string) =>
    axiosClient.get<{ data: any[] }>(
      `/api/v1/teacher/classrooms/${classId}/assignments`,
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
  getDailyProgressStats: (classId: string) =>
    axiosClient.get(
      `/api/v1/curriculum/daily-plans/classrooms/${classId}/progress-stats`,
    ),
  getGlobalResources: () =>
    axiosClient.get<{ data: any[] }>("/api/v1/admin/resources?type=DOC"),

  // 5. Chấm bài
  getSubmissionsForGrading: (assignmentId: string) =>
    axiosClient.get<{ data: any[] }>(
      `/api/v1/teacher/assignments/${assignmentId}/submissions`,
    ),

  getSubmissionDetail: (attemptId: string) =>
    axiosClient.get<{ data: any }>(`/api/v1/teacher/submissions/${attemptId}`),

  gradeSubmission: (
    attemptId: string,
    data: { score: number; feedback: string },
  ) =>
    axiosClient.post(`/api/v1/teacher/submissions/${attemptId}/grade`, {
      finalScore: data.score,
      feedback: data.feedback,
    }),

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
    axiosClient.get(`/api/v1/notifications?classId=${classId}`),

  // 8. Tổng hợp Neural Audio TTS
  synthesizeAudio: (data: { text: string; voice?: string; speed?: string }) =>
    axiosClient.post<{ data: string }>(
      "/api/v1/teacher/assignments/synthesize-audio",
      data,
      { timeout: 120000 },
    ),
};
