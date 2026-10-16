// src/features/student/types.ts

// ================= 1. GROQ SHADOWING DTOs =================
export interface KpiMetrics {
  pronunciation: number;
  fluency: number;
  completeness: number;
  prosody: number;
  wordsPerMinute: number;
}

export interface SentenceToken {
  word: string;
  color: "GREEN" | "YELLOW" | "RED" | "GRAY";
  hasPauseAfter: boolean;
  hasLinkingAfter: boolean;
  wordStatus?: "SPOKEN" | "MISSING" | "PARTIAL";
}

export interface PhonemeItem {
  ipa: string;
  score: number;
  note: string;
}

export interface WordPhonemeDetail {
  word: string;
  score: number;
  wordStatus?: "SPOKEN" | "MISSING" | "PARTIAL";
  phonemes: PhonemeItem[];
}

export interface ShadowingEvaluationResponse {
  overallScore: number;
  isPassed: boolean;
  passScore: number;
  statusMessage: string;
  evaluatedBy?: string;
  kpi: KpiMetrics;
  sentenceTokens: SentenceToken[];
  wordRows: WordPhonemeDetail[];
}

// ================= 2. IELTS AI (SPEAKING & WRITING) DTOs =================
export interface TaskAchievementDetail {
  score?: number;
  addressedPoints?: string[];
  missingPoints?: string[];
}

export interface SpeakingAiMistake {
  original: string;
  correction: string;
  type: string;
  explanation: string;
}

export interface SpeakingAiSuggestion {
  area: string;
  recommendation: string;
}

export interface SpeakingAiEvaluationResult {
  transcript: string;
  wordsPerMinute: number;
  isOffTopic?: boolean;
  taskAchievement?: TaskAchievementDetail;
  overallBand: number;
  estimatedCefr: string;
  pronunciationScore: number;
  fluencyScore: number;
  lexicalScore: number;
  grammarScore: number;
  coherenceScore: number;
  correctedText: string;
  mistakes: SpeakingAiMistake[];
  suggestions: SpeakingAiSuggestion[];
  generalFeedback: string;
}

export interface WritingAiEvaluationResult {
  wordCount: number;
  isOffTopic?: boolean;
  taskAchievement?: TaskAchievementDetail;
  overallBand: number;
  estimatedCefr: string;
  grammarScore: number;
  vocabularyScore: number;
  coherenceScore: number;
  correctedText: string;
  mistakes: SpeakingAiMistake[];
  suggestions: SpeakingAiSuggestion[];
  generalFeedback: string;
}

// ================= 3. KHÓA HỌC & GIÁO TRÌNH (CURRICULUM) =================
export interface MyCourseResponse {
  classId: string;
  className: string;
  level: string;
  teacherName: string;
  status: string;
  enrolledAt: string;
  progressPercentage?: number;
}

export interface LessonSummary {
  id: string;
  title: string;
  orderIndex: number;
  isCompleted?: boolean;
  objectives?: string;
}

export interface DocumentResponse {
  id: string;
  lessonId: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  fileType: "PDF" | "DOCX" | "PPTX" | "IMAGE" | "AUDIO";
  createdAt?: string;
}

export interface GrammarTopicResponse {
  id: string;
  lessonId: string;
  title: string;
  ruleSummary: string;
  formula?: string;
  examples?: string;
}

export interface VocabularyResponse {
  id: string;
  lessonId?: string;
  word: string;
  meaning: string;
  ipa?: string;
  partOfSpeech?: string;
  audioUrl?: string;
  exampleSentence?: string;
}

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

export interface VideoResponse {
  id: string;
  title: string;
  videoUrl?: string;
  hlsPlaylistUrl?: string;
  durationSeconds: number;
}

export interface VideoWatchHistory {
  watchedSeconds: number;
  completed: boolean;
}

// ================= 4. BÀI TẬP & NỘP BÀI (ASSIGNMENTS & ATTEMPTS) =================
export interface QuestionOptionDetail {
  id?: string;
  optionLabel?: string;
  optionText?: string;
  text?: string;
  isCorrect?: boolean;
}

export interface QuestionResultDetail {
  id: string;
  questionId: string;
  studentAnswerId?: string;
  promptText: string;
  questionType: string;
  maxPoints: number;
  earnedPoints?: number;
  studentAnswer?: string;
  audioUrl?: string;
  mediaUrl?: string;
  targetWord?: string;
  word?: string;
  ipa?: string;
  transcript?: string;
  selectedOptionId?: string;
  correctAnswer?: string;
  explanation?: string;
  isCorrect?: boolean;
  options?: QuestionOptionDetail[];
  evalFeedback?: string;
}

export interface AttemptResponse {
  attemptId: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentDescription?: string;
  description?: string;
  skillType?: string;
  audioUrl?: string;
  listeningScript?: string;
  passage?: string;
  attemptNumber: number;
  status: string;
  score?: number;
  totalScore?: number;
  aiFeedback?: string;
  teacherFeedback?: string;
  startedAt?: string;
  submittedAt?: string;
  questions?: QuestionResultDetail[];
}

export interface StudentAssignmentSummaryResponse {
  id: string;
  title: string;
  description: string;
  skillType: string;
  timeLimitMinutes?: number;
  dueDate?: string;
  maxAttempts: number;
  passScore: number;
  attemptsCount: number;
  highestScore: number;
  status: string;
}

export interface StudentSkillProfile {
  listeningScore: number;
  speakingScore: number;
  readingScore: number;
  writingScore: number;
  grammarScore: number;
  vocabularyScore: number;
  aiRecommendedPath?: string;
}

// ================= 5. DAILY STUDY PLAN (BÀI HỌC THEO NGÀY) =================
export interface TaskItemDto {
  id: string;
  title: string;
  itemType: string;
  orderIndex: number;
  assignmentId?: string;
  isDone: boolean;
}

export interface SectionGroupDto {
  sectionName: string;
  items: TaskItemDto[];
}

export interface DaySummaryDto {
  id: string;
  dayNumber: number;
  title: string;
  dateLabel: string;
  scheduledDate: string;
  estimatedMinutes?: number;
  isCompleted: boolean;
  isCurrentDay: boolean;
  isUnlocked: boolean;
}

export interface DayDetailDto {
  id: string;
  dayNumber: number;
  title: string;
  fullHeaderLabel: string;
  scheduledDate: string;
  estimatedMinutes?: number;
  isCompleted: boolean;
  sections: SectionGroupDto[];
}

export interface DailyHomeworkOverviewResponse {
  completionPercentage: number;
  totalDays: number;
  completedDays: number;
  days: DaySummaryDto[];
  currentSelectedDay: DayDetailDto | null;
}

export interface ReadingShortAnswerEvaluationResult {
  isContentCorrect: boolean;
  isGrammarCorrect: boolean;
  scoreOutOf10: number;
  contentFeedback?: string;
  grammarFeedback?: string;
  suggestedAnswer?: string;
  passageQuote?: string;
}

// ================= 6. KOKORO-82M TTS =================
export interface TtsRequest {
  text: string;
  voice?: string;
  speed?: number;
}

export interface TtsResponse {
  audioUrl: string;
  voice: string;
  speed: number;
  durationSeconds?: number;
  cached?: boolean;
}

export interface DialogueSegment {
  speaker: string;
  voice: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface ExerciseAudioResponse {
  id?: string;
  exerciseType: "SHADOWING" | "LISTENING";
  assignmentId: string;
  questionId: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED" | "BROKEN";
  url?: string;
  durationMs?: number;
  version: number;
  generatedBy?: "SYSTEM" | "TEACHER" | "STUDENT_REPAIR";
  errorMessage?: string;
  segments?: DialogueSegment[];
  updatedAt?: string;
}

export interface KokoroVoice {
  id: string;
  name: string;
  accent: string;
  gender: string;
  description: string;
  pipeline: string;
  isDefault: boolean;
}


