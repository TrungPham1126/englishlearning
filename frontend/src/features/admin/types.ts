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

export interface DailySubmissionTrend {
  date: string;
  submissions: number;
  graded: number;
}

export interface CompletionDistributionDto {
  high: number;    // >= 80%
  medium: number;  // 50% - 79%
  low: number;     // < 50%
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
  averageSkillScores?: Record<string, number>;
  completionDistribution?: CompletionDistributionDto;
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

// --- DATABASE & CLASSROOM STORAGE MANAGEMENT ---
export interface ClassroomDatabaseItem {
  id: string;
  name: string;
  level: string;
  status: string;
  teacherName: string;
  startDate: string;
  endDate: string;
  studentCount: number;
  lessonCount: number;
  dailyPlanCount: number;
  assignmentCount: number;
  examCount: number;
  attemptCount: number;
  answerCount: number;
  aiEvaluationCount: number;
  dailyProgressCount: number;
  videoWatchCount: number;
  submissionAudioCount: number;
  cheatingFlagCount: number;
  averageScore: number;
  estimatedSubmissionKb: number;
  eligibleForCleanPurge: boolean;
}

export interface AdminDatabaseOverview {
  totalClassrooms: number;
  completedClassrooms: number;
  totalEnrolledStudents: number;
  totalAssignments: number;
  totalExams: number;
  totalAttempts: number;
  totalStudentAnswers: number;
  totalAiEvaluations: number;
  totalDailyProgressRecords: number;
  totalSubmissionAudioFiles: number;
  estimatedSubmissionDataKb: number;
  classrooms: ClassroomDatabaseItem[];
}

export interface ClassroomPurgeResult {
  classroomId: string;
  classroomName: string;
  entireClassroomDeleted: boolean;
  deletedAiEvaluations: number;
  deletedStudentAnswers: number;
  deletedAttempts: number;
  deletedDailyProgress: number;
  deletedVideoWatchHistory: number;
  deletedVocabularyProgress: number;
  deletedR2MediaFiles: number;
  freedEstimatedKb: number;
  message: string;
  executedAt: string;
}

export interface StudentReportRow {
  studentId: string;
  fullName: string;
  email: string;
  phone?: string;
  enrolledAt: string;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  averageScore: number;
  totalAttempts: number;
  examAttempts: number;
  cheatingFlags: number;
  totalStudyMinutes: number;
  classification: string;
}

export interface AttemptReportRow {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  assignmentTitle: string;
  skillType: string;
  exam: boolean;
  attemptNumber: number;
  status: string;
  submittedAt: string;
  durationSeconds?: number;
  totalScore?: number;
  violationCount: number;
  cheatingFlagged: boolean;
  cheatingReason?: string;
  teacherFeedback?: string;
}

export interface ClassroomDetailedReport {
  classroomId: string;
  classroomName: string;
  description?: string;
  level: string;
  status: string;
  teacherName: string;
  teacherEmail: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  totalStudents: number;
  totalLessons: number;
  totalDailyPlans: number;
  totalAssignments: number;
  totalExams: number;
  totalAttempts: number;
  completedAttempts: number;
  flaggedCheatingAttempts: number;
  classAverageScore: number;
  averageCompletionRate: number;
  students: StudentReportRow[];
  submissions: AttemptReportRow[];
}

// --- CLOUDFLARE R2 STORAGE & COST REPORT ---
export interface R2CategoryBreakdown {
  categoryKey: string;
  label: string;
  prefix: string;
  objectCount: number;
  totalBytes: number;
  sizeMb: number;
  sharePercent: number;
  estimatedGrossStorageUsd: number;
}

export interface R2LargestObject {
  key: string;
  category: string;
  sizeBytes: number;
  sizeMb: number;
  lastModified?: string;
}

export interface R2CostReport {
  bucketName: string;
  endpoint?: string;
  publicUrl?: string;
  liveConnected: boolean;
  dataSourceMode: "LIVE_R2" | "DATABASE_ESTIMATE" | string;
  statusMessage: string;
  totalObjects: number;
  totalBytes: number;
  totalStorageGb: number;
  freeStorageGb: number;
  billableStorageGb: number;
  freeTierUsagePercent: number;
  classAOps: number;
  freeClassAOps: number;
  billableClassAOps: number;
  classBOps: number;
  freeClassBOps: number;
  billableClassBOps: number;
  deleteOps: number;
  storageCostUsd: number;
  classACostUsd: number;
  classBCostUsd: number;
  egressCostUsd: number;
  totalPayableUsd: number;
  totalPayableVnd: number;
  grossEquivalentUsd: number;
  grossEquivalentVnd: number;
  monthlyBudgetUsd: number;
  usdToVndRate: number;
  categoryBreakdowns: R2CategoryBreakdown[];
  largestObjects: R2LargestObject[];
  generatedAt: string;
}
