// src/features/student/vocabulary/types/vocabulary.ts

export type PartOfSpeech = 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';

export interface VocabularyItem {
  readonly id: string;
  readonly word: string;
  readonly ipa: string;
  readonly partOfSpeech: PartOfSpeech;
  readonly meaningVi: string;
  readonly definitionEn: string;
  readonly exampleEn: string;
  readonly exampleVi: string;
  readonly audioUrlUk?: string;
  readonly audioUrlUs?: string;
  readonly imageUrl?: string;
  readonly synonyms: readonly string[];
  readonly collocations: readonly string[];
  readonly masteryLevel: number; // 0 (New) -> 5 (Mastered)
}

export type ExerciseType =
  | 'MULTIPLE_CHOICE'
  | 'LISTEN_AND_TYPE'
  | 'FILL_IN_BLANK'
  | 'WORD_MATCHING'
  | 'PRONUNCIATION_DRILL';

export interface BaseExerciseQuestion {
  readonly id: string;
  readonly vocabularyItem: VocabularyItem;
  readonly prompt: string;
  readonly hint?: string;
}

export interface FlashcardQuestion extends BaseExerciseQuestion {
  readonly type: 'FLASHCARD';
  readonly frontContent: 'word' | 'meaning';
}

export interface MultipleChoiceOption {
  readonly id: string;
  readonly text: string;
  readonly isCorrect: boolean;
}

export interface MultipleChoiceQuestion extends BaseExerciseQuestion {
  readonly type: 'MULTIPLE_CHOICE';
  readonly options: readonly MultipleChoiceOption[];
}

export interface ListenAndTypeQuestion extends BaseExerciseQuestion {
  readonly type: 'LISTEN_AND_TYPE';
  readonly audioUrl: string;
  readonly expectedWord: string;
  readonly acceptableAlternates?: readonly string[];
}

export interface FillInBlankQuestion extends BaseExerciseQuestion {
  readonly type: 'FILL_IN_BLANK';
  readonly sentenceWithBlank: string; // e.g. "Artificial intelligence is ______ how we acquire foreign languages."
  readonly expectedWord: string;
  readonly givenWordHint?: string; // e.g. "reshape"
}

export interface MatchingPair {
  readonly id: string;
  readonly leftText: string;
  readonly rightText: string;
}

export interface WordMatchingQuestion extends BaseExerciseQuestion {
  readonly type: 'WORD_MATCHING';
  readonly pairs: readonly MatchingPair[];
}

export interface PronunciationDrillQuestion extends BaseExerciseQuestion {
  readonly type: 'PRONUNCIATION_DRILL';
  readonly targetWord: string;
  readonly targetIpa: string;
  readonly passScore: number; // Default 75
}

/**
 * Discriminated Union cho 6 dạng bài tập Multi-format
 */
export type ExerciseQuestion =
  | MultipleChoiceQuestion
  | ListenAndTypeQuestion
  | FillInBlankQuestion
  | WordMatchingQuestion
  | PronunciationDrillQuestion;

export type SubmissionStatus = 'IDLE' | 'CHECKING' | 'CORRECT' | 'WRONG';

export interface SessionResultMetrics {
  readonly totalQuestions: number;
  readonly correctCount: number;
  readonly wrongCount: number;
  readonly accuracyRate: number;
  readonly maxStreak: number;
  readonly timeSpentSeconds: number;
  readonly learnedVocabIds: readonly string[];
}
