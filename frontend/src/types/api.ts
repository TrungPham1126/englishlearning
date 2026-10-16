// src/types/api.ts

// com.englishlearning.common.dto.ApiResponse
export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

// com.englishlearning.common.dto.PageResponse
export interface PageResponse<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// com.englishlearning.auth.entity.RoleName
export type RoleName = "ROLE_ADMIN" | "ROLE_TEACHER" | "ROLE_STUDENT";

// com.englishlearning.auth.dto.UserSummaryDto
export interface UserSummaryDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  roles: RoleName[];
  targetCefr?: string;
  currentLevel?: string;
  isActive?: boolean;
}

// com.englishlearning.auth.dto.AuthResponse
export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserSummaryDto;
}

// com.englishlearning.curriculum.dto.DocumentResponse
export interface DocumentResponse {
  id: string;
  lessonId: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  fileType: "PDF" | "DOCX" | "PPTX" | "IMAGE" | "AUDIO";
  createdAt?: string;
}

// com.englishlearning.curriculum.dto.VocabularyResponse
export interface VocabularyResponse {
  id: string;
  lessonId: string;
  word: string;
  meaning: string;
  ipa?: string;
  exampleSentence?: string;
  partOfSpeech?: string;
}

// com.englishlearning.curriculum.dto.GrammarTopicResponse
export interface GrammarTopicResponse {
  id: string;
  lessonId: string;
  title: string;
  ruleSummary: string;
  formula?: string;
  examples?: string;
}

// com.englishlearning.curriculum.dto.LessonDetailResponse
export interface LessonDetailResponse {
  id: string;
  classId: string;
  title: string;
  objectives?: string;
  content?: string;
  orderIndex: number;
  updatedAt?: string;
  documents: DocumentResponse[];
  vocabularies: VocabularyResponse[];
  grammarTopics: GrammarTopicResponse[];
}

// com.englishlearning.submission.dto.AttemptResponse.QuestionResultDetail
export interface QuestionResultDetail {
  questionId: string;
  promptText: string;
  questionType:
    | "MULTIPLE_CHOICE"
    | "TRUE_FALSE"
    | "FILL_IN_BLANK"
    | "MATCHING"
    | "AUDIO_RESPONSE"
    | "ESSAY";
  maxPoints?: number;
  earnedPoints?: number;
  studentAnswer?: string;
  selectedOptionId?: string;
  correctAnswer?: string;
  explanation?: string;
  isCorrect?: boolean;
}

// com.englishlearning.submission.dto.AttemptResponse
export interface AttemptResponse {
  attemptId: string;
  assignmentId: string;
  assignmentTitle?: string;
  attemptNumber: number;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADING" | "COMPLETED" | "TIMED_OUT";
  score?: number;
  aiFeedback?: string;
  teacherFeedback?: string;
  startedAt: string;
  submittedAt?: string;
  questions?: QuestionResultDetail[];
}

// com.englishlearning.submission.dto.StudentAssignmentSummaryResponse
export interface StudentAssignmentSummaryResponse {
  id: string;
  title: string;
  description?: string;
  skillType:
    | "LISTENING"
    | "SPEAKING"
    | "READING"
    | "WRITING"
    | "VOCABULARY"
    | "GRAMMAR";
  timeLimitMinutes?: number;
  dueDate?: string;
  maxAttempts: number;
  passScore: number;
  attemptsCount: number;
  highestScore: number;
  status: "NOT_STARTED" | "COMPLETED" | "OVERDUE";
}

// com.englishlearning.classroom.dto.MyCourseResponse
export interface MyCourseResponse {
  classId: string;
  className: string;
  level: string;
  status: string;
  teacherName: string;
  enrolledAt: string;
  progressPercentage: number;
}
