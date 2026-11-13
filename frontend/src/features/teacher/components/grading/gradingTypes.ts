export interface GradingSubmission {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  score?: number | null;
  status: string;
  submittedAt?: string;
  attemptNumber?: number;
  violationCount?: number;
  isCheatingFlagged?: boolean;
  cheatingReason?: string | null;
}

export interface AiEvaluationDetail {
  id?: string;
  evalType?: string | null;
  overallScore?: number | null;
  pronunciationScore?: number | null;
  fluencyScore?: number | null;
  grammarScore?: number | null;
  vocabularyScore?: number | null;
  coherenceScore?: number | null;
  estimatedCefr?: string | null;
  sttTranscript?: string | null;
  correctedText?: string | null;
  mistakesJson?: string | null;
  suggestionsJson?: string | null;
}

export interface GradingOption {
  id: string;
  optionLabel?: string;
  optionText: string;
  matchText?: string;
  isCorrect?: boolean;
}

export interface GradingQuestion {
  id?: string;
  questionId?: string;
  studentAnswerId?: string;
  promptText: string;
  questionType?: string;
  skillType?: string | null;
  mediaUrl?: string;
  studentAnswer?: string;
  selectedOptionId?: string | null;
  audioUrl?: string;
  correctAnswer?: string;
  isCorrect?: boolean | null;
  options?: GradingOption[];
  evalFeedback?: string | null;
  aiEvaluation?: AiEvaluationDetail | null;
  transcript?: string;
  explanation?: string | null;
  points?: number;
  maxPoints?: number | null;
  earnedPoints?: number | null;
}

export interface GradingSubmissionDetail {
  attemptId: string;
  assignmentId?: string;
  assignmentTitle: string;
  assignmentDescription?: string;
  skillType?: string;
  score?: number | null;
  teacherFeedback?: string;
  aiFeedback?: string;
  status: string;
  isExam?: boolean;
  examSkills?: string | null;
  strictFullscreen?: boolean;
  maxViolations?: number;
  violationCount?: number;
  isCheatingFlagged?: boolean;
  cheatingReason?: string | null;
  violationLogJson?: string | null;
  answersPersisted?: boolean;
  questions?: GradingQuestion[];
}

export interface AiFeedbackParsed {
  bandScore?: number | string;
  generalFeedback?: string;
  grammarCorrections?: string[] | string;
  pronunciationNotes?: string;
  [key: string]: any;
}
