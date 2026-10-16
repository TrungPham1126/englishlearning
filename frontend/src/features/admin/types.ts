// src/features/admin/types.ts

// --- USER MANAGEMENT ---
export interface UserCreateByAdminRequest {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roles: string[]; // VD: ["ROLE_STUDENT", "ROLE_TEACHER"]
}

export interface UserUpdateRequest {
  firstName: string;
  lastName: string;
  phone?: string;
  isActive?: boolean;
  roles: string[];
}

// --- CLASSROOM MANAGEMENT ---
export interface ClassroomResponse {
  id: string;
  name: string;
  description?: string;
  level: string;
  status: string;
  startDate?: string;
  endDate?: string;
  maxStudents?: number;
  currentStudentsCount: number;
  teacherId?: string;
  teacherName?: string;
  createdAt?: string;
}

export interface CreateClassroomRequest {
  name: string;
  description?: string;
  level: string;
  startDate?: string;
  endDate?: string;
  maxStudents?: number;
  teacherId?: string;
}

// --- NOTIFICATION ---
export interface NotificationBroadcastRequest {
  title: string;
  message: string;
  notificationType: string;
  redirectUrl?: string;
}
// src/features/admin/types.ts
// ... (Giữ nguyên các DTO cũ)

export interface DailySubmissionTrend {
  date: string;
  submissions: number;
  graded: number;
}

// --- DASHBOARD STATS ---
export interface AdminDashboardStats {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  openClasses?: number;
  inProgressClasses?: number;
  planningClasses?: number;
  completedClasses?: number;
  totalLessons: number;
  totalVideos: number;
  pendingVideos: number;
  totalAssignments: number;
  totalSubmissions?: number;
  pendingGrading?: number;
  completionRate?: number;
  weeklySubmissionsTrend?: DailySubmissionTrend[];
}

// --- AI MONITORING STATS ---
export interface DailyTokenUsage {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface CostBreakdown {
  studentSpeakingCost: number;
  teacherCreationCost: number;
  studentSpeakingTokens: number;
  teacherCreationTokens: number;
}

export interface AiEngineStats {
  engineName: string;
  primaryRole: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  totalRequests: number;
  pricingModel: string;
  isHealthy: boolean;
}

export interface StudentQuotaItem {
  studentId: string;
  studentName?: string;
  email: string;
  role?: "STUDENT" | "TEACHER" | string;
  serviceEngine?: string;
  dailyUsed: number;
  dailyLimit: number;
  isBlocked: boolean;
  promptTokensUsed?: number;
  completionTokensUsed?: number;
  totalTokensUsed?: number;
  estimatedCostUsd?: number;
}

export interface AiStatsResponse {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  monthlyCostUsd: number;
  activeUsers: number;
  blockedUsers: number;
  systemQuotaRemainingPercent: number;
  systemKillSwitchActive: boolean;
  dailyUsage: DailyTokenUsage[];
  costBreakdown: CostBreakdown;
  geminiStats?: AiEngineStats;
  groqStats?: AiEngineStats;
  studentQuotas: StudentQuotaItem[];
}

export interface StudentEnrollmentItem {
  studentId: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  enrolledAt: string;
  completedTasks?: number;
  totalTasks?: number;
  completionRate?: number;
  averageScore?: number;
  weaknesses?: string[];
  attendanceScore?: number;
}

export interface VideoModerationItem {
  id: string;
  originalFileName: string;
  hlsPlaylistUrl?: string;
  rawStorageUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  sizeBytes?: number;
  status: "DRAFT" | "PROCESSING" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";
  rejectionReason?: string;
  lesson?: {
    id: string;
    title: string;
    orderIndex?: number;
    classroom?: {
      id: string;
      name: string;
      level?: string;
    };
  };
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
}

// --- AUDIT LOGS ---
export interface AuditLogDto {
  id: string;
  userId: string;
  userName?: string;
  action: string;
  entityName: string;
  entityId: string;
  ipAddress: string;
  metadataJson: string;
  createdAt: string;
}
