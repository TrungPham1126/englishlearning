// src/features/admin/api/adminApi.ts
import { axiosClient } from "@/lib/axiosClient";
import type { ApiResponse, PageResponse, UserSummaryDto } from "@/types/api";
import type {
  UserCreateByAdminRequest,
  UserUpdateRequest,
  ClassroomResponse,
  CreateClassroomRequest,
  NotificationBroadcastRequest,
  AdminDashboardStats,
  AuditLogDto,
  StudentEnrollmentItem,
  VideoModerationItem,
  AiStatsResponse,
  StudentQuotaItem,
} from "../types";

export const adminApi = {
  // --- USERS ---
  getUsers: async (
    page = 0,
    size = 20,
    role?: string,
    keyword?: string,
  ): Promise<PageResponse<UserSummaryDto>> => {
    let url = `/api/v1/admin/users?page=${page}&size=${size}`;
    if (role) url += `&role=${encodeURIComponent(role)}`;
    if (keyword && keyword.trim()) url += `&keyword=${encodeURIComponent(keyword.trim())}`;
    const res = await axiosClient.get<
      ApiResponse<PageResponse<UserSummaryDto>>
    >(url);
    return res.data.data;
  },
  createUser: async (
    data: UserCreateByAdminRequest,
  ): Promise<UserSummaryDto> => {
    const res = await axiosClient.post<ApiResponse<UserSummaryDto>>(
      "/api/v1/admin/users",
      data,
    );
    return res.data.data;
  },
  updateUser: async (
    id: string,
    data: UserUpdateRequest,
  ): Promise<UserSummaryDto> => {
    const res = await axiosClient.put<ApiResponse<UserSummaryDto>>(
      `/api/v1/admin/users/${id}`,
      data,
    );
    return res.data.data;
  },
  toggleUserStatus: async (id: string, active: boolean): Promise<void> => {
    await axiosClient.patch(
      `/api/v1/admin/users/${id}/status?active=${active}`,
    );
  },
  deleteUser: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v1/admin/users/${id}`);
  },

  // --- CLASSROOMS ---
  getClassrooms: async (
    page = 0,
    size = 20,
    status?: string,
  ): Promise<PageResponse<ClassroomResponse>> => {
    let url = `/api/admin/classrooms?page=${page}&size=${size}`;
    if (status) url += `&status=${status}`;
    const res = await axiosClient.get<
      ApiResponse<PageResponse<ClassroomResponse>>
    >(url);
    return res.data.data;
  },
  getClassroomById: async (id: string): Promise<ClassroomResponse> => {
    const res = await axiosClient.get<ApiResponse<ClassroomResponse>>(
      `/api/admin/classrooms/${id}`,
    );
    return res.data.data;
  },
  getClassStudents: async (
    classId: string,
  ): Promise<StudentEnrollmentItem[]> => {
    const res = await axiosClient.get<ApiResponse<StudentEnrollmentItem[]>>(
      `/api/admin/classrooms/${classId}/students`,
    );
    return res.data.data || [];
  },
  removeStudentFromClass: async (
    classId: string,
    studentId: string,
  ): Promise<void> => {
    await axiosClient.delete(
      `/api/admin/classrooms/${classId}/students/${studentId}`,
    );
  },
  createClassroom: async (
    data: CreateClassroomRequest,
  ): Promise<ClassroomResponse> => {
    const res = await axiosClient.post<ApiResponse<ClassroomResponse>>(
      "/api/admin/classrooms",
      data,
    );
    return res.data.data;
  },
  updateClassStatus: async (
    id: string,
    status: string,
  ): Promise<ClassroomResponse> => {
    const res = await axiosClient.put<ApiResponse<ClassroomResponse>>(
      `/api/admin/classrooms/${id}/status`,
      { status },
    );
    return res.data.data;
  },
  assignTeacher: async (
    id: string,
    teacherId: string,
  ): Promise<ClassroomResponse> => {
    const res = await axiosClient.put<ApiResponse<ClassroomResponse>>(
      `/api/admin/classrooms/${id}/assign-teacher`,
      { teacherId },
    );
    return res.data.data;
  },
  enrollStudent: async (
    id: string,
    studentIdentifier: string,
  ): Promise<void> => {
    await axiosClient.post(`/api/admin/classrooms/${id}/enroll`, {
      studentIdentifier,
    });
  },

  // --- NOTIFICATIONS ---
  broadcastNotification: async (
    data: NotificationBroadcastRequest,
  ): Promise<void> => {
    await axiosClient.post("/api/v1/notifications/broadcast", data);
  },

  // --- VIDEO MODERATION ---
  getPendingVideos: async (): Promise<VideoModerationItem[]> => {
    const res = await axiosClient.get<ApiResponse<VideoModerationItem[]>>(
      `/api/v1/videos?status=PENDING_REVIEW`,
    );
    return res.data.data || [];
  },
  getVideos: async (status?: string): Promise<VideoModerationItem[]> => {
    let url = "/api/v1/videos";
    if (status && status !== "ALL") url += `?status=${status}`;
    const res = await axiosClient.get<ApiResponse<VideoModerationItem[]>>(url);
    return res.data.data || [];
  },
  reviewVideo: async (
    id: string,
    approved: boolean,
    reason?: string,
  ): Promise<void> => {
    await axiosClient.patch(
      `/api/v1/videos/${id}/review?approved=${approved}&reason=${encodeURIComponent(reason || "")}`,
    );
  },

  // --- DASHBOARD ---
  getDashboardStats: async (): Promise<AdminDashboardStats> => {
    const res = await axiosClient.get<ApiResponse<AdminDashboardStats>>(
      "/api/v1/admin/dashboard/stats",
    );
    return res.data.data;
  },

  // --- AUDIT LOGS ---
  getAuditLogs: async (
    page = 0,
    size = 50,
  ): Promise<PageResponse<AuditLogDto>> => {
    const res = await axiosClient.get<ApiResponse<PageResponse<AuditLogDto>>>(
      `/api/v1/admin/audit-logs?page=${page}&size=${size}`,
    );
    return res.data.data;
  },

  // --- CURRICULUM (LESSON MANAGEMENT) ---
  getLessonsByClass: async (classId: string): Promise<any[]> => {
    const res = await axiosClient.get(
      `/api/curriculum/classes/${classId}/lessons`,
    );
    return res.data.data || [];
  },
  createLesson: async (data: {
    classId: string;
    title: string;
    objectives: string;
    content: string;
    orderIndex: number;
  }): Promise<any> => {
    const res = await axiosClient.post("/api/curriculum/lessons", data);
    return res.data.data;
  },
  deleteLesson: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/curriculum/lessons/${id}`);
  },
  deleteDocument: async (documentId: string): Promise<void> => {
    await axiosClient.delete(`/api/curriculum/documents/${documentId}`);
  },
  deleteVocabulary: async (vocabularyId: string): Promise<void> => {
    await axiosClient.delete(`/api/curriculum/vocabularies/${vocabularyId}`);
  },
  deleteGrammarTopic: async (topicId: string): Promise<void> => {
    await axiosClient.delete(`/api/curriculum/grammar/${topicId}`);
  },
  getLessonDetail: async (lessonId: string): Promise<any> => {
    const res = await axiosClient.get(`/api/curriculum/lessons/${lessonId}`);
    return res.data.data;
  },
  getVideoByLesson: async (lessonId: string): Promise<any> => {
    const res = await axiosClient.get(`/api/v1/videos/lesson/${lessonId}`);
    return res.data.data;
  },

  // ==========================================
  // --- AI COST & TOKEN MONITORING ---
  // ==========================================
  getAiUsageStats: async (): Promise<AiStatsResponse> => {
    const res = await axiosClient.get<ApiResponse<AiStatsResponse>>(
      "/api/v1/admin/ai-monitoring/stats",
    );
    return res.data.data;
  },
  getAiUserQuotas: async (): Promise<StudentQuotaItem[]> => {
    const res = await axiosClient.get<ApiResponse<StudentQuotaItem[]>>(
      "/api/v1/admin/ai-monitoring/quotas",
    );
    return res.data.data;
  },
  updateUserAiQuota: async (
    studentId: string,
    dailyLimit: number,
    isBlocked: boolean,
  ): Promise<void> => {
    await axiosClient.put(`/api/v1/admin/ai-monitoring/quotas/${studentId}`, {
      dailyLimit,
      isBlocked,
    });
  },
  toggleAiKillSwitch: async (): Promise<boolean> => {
    const res = await axiosClient.post<ApiResponse<boolean>>(
      "/api/v1/admin/ai-monitoring/kill-switch/toggle",
    );
    return res.data.data;
  },

  // ==========================================
  // --- GLOBAL RESOURCE LIBRARY ---
  // ==========================================
  getGlobalResources: async (type: string): Promise<any[]> => {
    const res = await axiosClient.get(`/api/v1/admin/resources?type=${type}`);
    return res.data.data;
  },
  uploadGlobalResource: async (formData: FormData): Promise<void> => {
    await axiosClient.post("/api/v1/admin/resources/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteGlobalResource: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v1/admin/resources/${id}`);
  },
};
