export interface GradingSubmission {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  score?: number | null;
  status: string;
  submittedAt?: string;
  attemptNumber?: number;
}

export interface GradingQuestion {
  id?: string;
  promptText: string;
  questionType?: string;
  mediaUrl?: string;
  studentAnswer?: string;
  audioUrl?: string;
  correctAnswer?: string;
  evalFeedback?: string | null;
  transcript?: string;
  points?: number;
}

export interface GradingSubmissionDetail {
  attemptId: string;
  assignmentTitle: string;
  assignmentDescription?: string;
  skillType?: string;
  score?: number | null;
  teacherFeedback?: string;
  aiFeedback?: string;
  status: string;
  questions?: GradingQuestion[];
}

export interface AiFeedbackParsed {
  bandScore?: number | string;
  generalFeedback?: string;
  grammarCorrections?: string[] | string;
  pronunciationNotes?: string;
  [key: string]: any;
}
