// src/features/student/pages/VocabularyPracticePage.tsx
import React, { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { studentApi } from '../api/studentApi';
import type { VocabularyResponse } from '../types';
import {
  VocabularySessionLayout,
  useVocabularySessionStore,
  type ExerciseQuestion,
  type PartOfSpeech,
} from '../vocabulary';
import { Loader2 } from 'lucide-react';

/**
 * Helper ánh xạ từ VocabularyResponse của Backend sang Multi-format ExerciseQuestion (6 dạng bài)
 */
function generateExercisesFromVocab(items: VocabularyResponse[]): ExerciseQuestion[] {
  const list: ExerciseQuestion[] = [];

  items.forEach((item, index) => {
    const pos = (item.partOfSpeech?.toLowerCase() || 'noun') as PartOfSpeech;
    const vocabItem = {
      id: item.id,
      word: item.word,
      ipa: item.ipa || '',
      partOfSpeech: pos,
      meaningVi: item.meaning,
      definitionEn: item.meaning,
      exampleEn: item.exampleSentence || `We use the word "${item.word}" in daily communication.`,
      exampleVi: `Chúng ta sử dụng từ "${item.word}" trong giao tiếp hàng ngày.`,
      audioUrlUk: item.audioUrl,
      audioUrlUs: item.audioUrl,
      synonyms: [],
      collocations: [],
      masteryLevel: 1,
    };


    // 2. TRẮC NGHIỆM MULTIPLE_CHOICE 4 lựa chọn
    const otherItems = items.filter((o) => o.id !== item.id);
    const distractors = otherItems
      .slice(0, 3)
      .map((d, dIdx) => ({ id: `dist-${dIdx}`, text: d.meaning, isCorrect: false }));

    const options = [
      { id: `correct-${item.id}`, text: item.meaning, isCorrect: true },
      ...distractors,
    ].sort(() => Math.random() - 0.5);

    list.push({
      id: `mc-${item.id}-${index}`,
      type: 'MULTIPLE_CHOICE',
      prompt: `Chọn nghĩa đúng của từ "${item.word}":`,
      vocabularyItem: vocabItem,
      options,
    });

    // 3. LISTEN_AND_TYPE (Nghe và gõ lại từ)
    list.push({
      id: `listen-${item.id}-${index}`,
      type: 'LISTEN_AND_TYPE',
      prompt: 'Nghe phát âm và gõ lại chính xác từ vựng:',
      audioUrl: item.audioUrl || '',
      expectedWord: item.word,
      vocabularyItem: vocabItem,
      hint: `${item.word.charAt(0)}... (${item.meaning})`,
    });

    // 4. FILL_IN_BLANK (Điền vào chỗ trống)
    if (item.exampleSentence && item.exampleSentence.toLowerCase().includes(item.word.toLowerCase())) {
      const regex = new RegExp(item.word, 'gi');
      const blankSentence = item.exampleSentence.replace(regex, '______');
      list.push({
        id: `blank-${item.id}-${index}`,
        type: 'FILL_IN_BLANK',
        prompt: 'Điền từ vựng thích hợp vào chỗ trống trong câu:',
        sentenceWithBlank: blankSentence,
        expectedWord: item.word,
        givenWordHint: item.word.toLowerCase(),
        vocabularyItem: vocabItem,
      });
    }

    // 5. PRONUNCIATION_DRILL (Luyện phát âm từ)
    list.push({
      id: `pronounce-${item.id}-${index}`,
      type: 'PRONUNCIATION_DRILL',
      prompt: `Đọc to từ "${item.word}" để AI kiểm tra phát âm:`,
      targetWord: item.word,
      targetIpa: item.ipa || item.word,
      passScore: 75,
      vocabularyItem: vocabItem,
    });
  });

  // 6. Thêm 1 bài WORD_MATCHING ghép cặp từ vựng nếu có từ 3 từ trở lên
  if (items.length >= 3) {
    const sliceItems = items.slice(0, 4);
    list.push({
      id: `matching-${Date.now()}`,
      type: 'WORD_MATCHING',
      prompt: 'Ghép cặp từ tiếng Anh với nghĩa tiếng Việt tương ứng:',
      vocabularyItem: {
        id: sliceItems[0]?.id || 'v0',
        word: 'Vocabulary Matching',
        ipa: '',
        partOfSpeech: 'phrase',
        meaningVi: 'Ghép cặp từ vựng',
        definitionEn: 'Match words with meanings',
        exampleEn: '',
        exampleVi: '',
        synonyms: [],
        collocations: [],
        masteryLevel: 1,
      },
      pairs: sliceItems.map((it) => ({
        id: it.id,
        leftText: it.word,
        rightText: it.meaning,
      })),
    });
  }

  return list;
}

export default function VocabularyPracticePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initSession = useVocabularySessionStore((s) => s.initSession);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    let isMounted = true;
    const limit = Number(searchParams.get('limit')) || 10;

    studentApi
      .getDueFlashcards(limit)
      .then((res) => {
        if (!isMounted) return;
        const vocabList = res?.content || [];
        // Nếu API trả về ít hoặc chưa có dữ liệu backend, tạo danh sách mẫu phong phú
        const finalItems = vocabList.length > 0 ? vocabList : [
          {
            id: 'v-1',
            word: 'Artificial',
            meaning: 'Nhân tạo, do con người tạo ra',
            ipa: 'ˌɑː.tɪˈfɪʃ.əl',
            partOfSpeech: 'adj',
            exampleSentence: 'Artificial intelligence is reshaping education every day.',
          },
          {
            id: 'v-2',
            word: 'Reshape',
            meaning: 'Định hình lại, tái cấu trúc',
            ipa: 'ˌriːˈʃeɪp',
            partOfSpeech: 'verb',
            exampleSentence: 'New technologies reshape our way of learning foreign languages.',
          },
          {
            id: 'v-3',
            word: 'Acquire',
            meaning: 'Tiếp thu, đạt được (kỹ năng, ngôn ngữ)',
            ipa: 'əˈkwaɪər',
            partOfSpeech: 'verb',
            exampleSentence: 'Students easily acquire speaking fluency with shadowing drills.',
          },
          {
            id: 'v-4',
            word: 'Fluency',
            meaning: 'Độ trôi chảy, lưu loát',
            ipa: 'ˈfluː.ən.si',
            partOfSpeech: 'noun',
            exampleSentence: 'Daily pronunciation practice improves speaking fluency dramatically.',
          },
        ];

        const exercises = generateExercisesFromVocab(finalItems);
        initSession(exercises, 5);
      })
      .catch(() => {
        // Fallback danh sách từ vựng mẫu nếu backend chưa kết nối
        const mockFallback: VocabularyResponse[] = [
          {
            id: 'v-1',
            word: 'Artificial',
            meaning: 'Nhân tạo, do con người tạo ra',
            ipa: 'ˌɑː.tɪˈfɪʃ.əl',
            partOfSpeech: 'adj',
            exampleSentence: 'Artificial intelligence is reshaping education every day.',
          },
          {
            id: 'v-2',
            word: 'Reshape',
            meaning: 'Định hình lại, tái cấu trúc',
            ipa: 'ˌriːˈʃeɪp',
            partOfSpeech: 'verb',
            exampleSentence: 'New technologies reshape our way of learning foreign languages.',
          },
          {
            id: 'v-3',
            word: 'Acquire',
            meaning: 'Tiếp thu, đạt được (kỹ năng, ngôn ngữ)',
            ipa: 'əˈkwaɪər',
            partOfSpeech: 'verb',
            exampleSentence: 'Students easily acquire speaking fluency with shadowing drills.',
          },
        ];
        initSession(generateExercisesFromVocab(mockFallback), 5);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initSession, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-blue-700 mb-3" />
        <p className="font-bold text-sm">Đang nạp bộ từ vựng và câu hỏi bài tập...</p>
      </div>
    );
  }

  return <VocabularySessionLayout onCloseSession={() => navigate(-1)} />;
}
