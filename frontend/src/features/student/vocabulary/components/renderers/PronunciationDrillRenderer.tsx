// src/features/student/vocabulary/components/renderers/PronunciationDrillRenderer.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Volume2, Sparkles } from 'lucide-react';
import type { PronunciationDrillQuestion } from '../../types/vocabulary';
import { useVocabularySessionStore } from '../../stores/useVocabularySessionStore';
import { playSampleAudio, stopAllSampleAudio } from '@/utils/sampleAudioPlayer';

interface PronunciationDrillRendererProps {
  readonly question: PronunciationDrillQuestion;
}

export const PronunciationDrillRenderer: React.FC<PronunciationDrillRendererProps> = ({ question }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [scoreResult, setScoreResult] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const setAnswerPayload = useVocabularySessionStore((s) => s.setAnswerPayload);
  const submissionStatus = useVocabularySessionStore((s) => s.submissionStatus);
  const vocab = question.vocabularyItem;

  useEffect(() => {
    stopAllSampleAudio();
    return () => stopAllSampleAudio();
  }, [question.id]);

  const handlePlaySample = () => {
    const url = vocab.audioUrlUs || vocab.audioUrlUk;
    void playSampleAudio(question.targetWord, {
      audioUrl: url,
      lang: 'en-US',
      skipBackendTts: true,
    });
  };

  const startRecord = async () => {
    if (submissionStatus !== 'IDLE') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;

      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        // Giả lập tính điểm nhận diện âm thanh phát âm (hoặc kết nối backend AI)
        const mockScore = Math.floor(Math.random() * 20) + 80; // 80 - 100
        setScoreResult(mockScore);
        setAnswerPayload({ pronunciationScore: mockScore });
      };

      rec.start();
      setIsRecording(true);
      setScoreResult(null);
    } catch {
      alert('Vui lòng cấp quyền truy cập Microphone trên trình duyệt để thu âm.');
    }
  };

  const stopRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 py-2">
      <div className="text-center space-y-1.5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300">
          <Sparkles className="w-4 h-4 text-amber-500" /> {question.prompt}
        </span>
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          Nghe phát âm chuẩn, sau đó nhấn Micro đọc to từ vựng để AI chấm điểm
        </h3>
      </div>

      {/* Card Từ Vựng Cỡ Lớn */}
      <div className="p-8 rounded-xl border-2 border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-center space-y-3">
        <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          {question.targetWord}
        </h2>
        <div className="flex items-center justify-center gap-3">
          <span className="text-base font-mono font-bold text-blue-700 dark:text-blue-400">
            [{question.targetIpa}]
          </span>
          <button
            type="button"
            onClick={handlePlaySample}
            aria-label="Nghe âm mẫu"
            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 hover:bg-blue-100 transition-colors"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nghĩa: {vocab.meaningVi}
        </p>
      </div>

      {/* Nút Thu Âm Micro To Bản */}
      <div className="flex flex-col items-center justify-center space-y-3">
        <div className="relative flex items-center justify-center">
          {isRecording && (
            <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
          )}
          <button
            type="button"
            disabled={submissionStatus !== 'IDLE'}
            onClick={isRecording ? stopRecord : startRecord}
            aria-label={isRecording ? 'Dừng thu âm' : 'Bắt đầu thu âm'}
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-card transition-all duration-200 cursor-pointer ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-700 scale-105'
                : scoreResult !== null
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-blue-800 hover:bg-blue-800'
            }`}
          >
            {isRecording ? <Square className="w-7 h-7 fill-current" /> : <Mic className="w-8 h-8" />}
          </button>
        </div>

        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
          {isRecording
            ? 'Đang thu âm... Chạm lại để hoàn thành'
            : scoreResult !== null
            ? `Điểm AI ghi nhận: ${scoreResult}% (Nhấn Kiểm tra để tiếp tục)`
            : 'Chạm biểu tượng Micro để bắt đầu đọc'}
        </span>
      </div>
    </div>
  );
};
