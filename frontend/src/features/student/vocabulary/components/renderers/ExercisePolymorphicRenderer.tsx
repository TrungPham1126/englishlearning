// src/features/student/vocabulary/components/renderers/ExercisePolymorphicRenderer.tsx
import React from 'react';
import type { ExerciseQuestion } from '../../types/vocabulary';
import { MultipleChoiceRenderer } from './MultipleChoiceRenderer';
import { ListenAndTypeRenderer } from './ListenAndTypeRenderer';
import { FillInBlankRenderer } from './FillInBlankRenderer';
import { WordMatchingRenderer } from './WordMatchingRenderer';
import { PronunciationDrillRenderer } from './PronunciationDrillRenderer';

interface ExercisePolymorphicRendererProps {
  readonly question: ExerciseQuestion;
}

/**
 * Polymorphic Exercise Renderer:
 * Tự động ánh xạ và render component giao diện tối ưu theo đúng Discriminated Union `question.type`
 */
export const ExercisePolymorphicRenderer: React.FC<ExercisePolymorphicRendererProps> = ({ question }) => {
  switch (question.type) {
    case 'MULTIPLE_CHOICE':
      return <MultipleChoiceRenderer question={question} />;
    case 'LISTEN_AND_TYPE':
      return <ListenAndTypeRenderer question={question} />;
    case 'FILL_IN_BLANK':
      return <FillInBlankRenderer question={question} />;
    case 'WORD_MATCHING':
      return <WordMatchingRenderer question={question} />;
    case 'PRONUNCIATION_DRILL':
      return <PronunciationDrillRenderer question={question} />;
    default: {
      const _exhaustiveCheck: never = question;
      return (
        <div className="p-6 text-center text-rose-500 font-bold">
          Không hỗ trợ định dạng câu hỏi: {JSON.stringify(_exhaustiveCheck)}
        </div>
      );
    }
  }
};
