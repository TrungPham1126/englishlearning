// src/features/student/pages/StudentFlashcardsPage.tsx
import { useEffect, useState } from "react";
import { studentApi } from "../api/studentApi";
import type { VocabularyResponse } from "../types";
import { RotateCw, CheckCircle, Volume2 } from "lucide-react";

export default function StudentFlashcardsPage() {
  const [cards, setCards] = useState<VocabularyResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentApi
      .getDueFlashcards(30)
      .then((res) => setCards(res.content))
      .finally(() => setLoading(false));
  }, []);

  const handleReview = async (grade: 0 | 1 | 2 | 3) => {
    const currentCard = cards[currentIndex];
    if (!currentCard) return;

    try {
      await studentApi.reviewFlashcard(currentCard.id, grade);
      setShowAnswer(false);
      setCurrentIndex((prev) => prev + 1);
    } catch {
      alert("Không thể cập nhật tiến độ ôn tập");
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Đang tìm các từ vựng cần ôn tập...
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  if (!currentCard || currentIndex >= cards.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto">
        <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">
          Hoàn thành bài ôn hôm nay!
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Tuyệt vời! Bạn không còn từ vựng nào cần ôn tập vào lúc này.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
        <span>Tiến trình hôm nay</span>
        <span>
          {currentIndex + 1} / {cards.length} thẻ
        </span>
      </div>

      {/* Thẻ Flashcard */}
      <div className="relative min-h-[320px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col justify-between items-center text-center">
        <div className="w-full flex justify-between items-center text-slate-400">
          <span className="text-xs uppercase font-bold tracking-wider">
            {currentCard.partOfSpeech || "Vocabulary"}
          </span>
          <button
            onClick={() => {
              const utter = new SpeechSynthesisUtterance(currentCard.word);
              utter.lang = "en-US";
              window.speechSynthesis.speak(utter);
            }}
            className="hover:text-indigo-600 p-1"
          >
            <Volume2 size={20} />
          </button>
        </div>

        <div className="space-y-3 my-auto">
          <h2 className="text-3xl font-extrabold text-slate-800">
            {currentCard.word}
          </h2>
          {currentCard.ipa && (
            <p className="text-sm font-mono text-slate-400">
              /{currentCard.ipa}/
            </p>
          )}

          {showAnswer && (
            <div className="space-y-2 border-t border-slate-100 pt-4 animate-fade-in">
              <p className="text-lg font-bold text-indigo-600">
                {currentCard.meaning}
              </p>
              {currentCard.exampleSentence && (
                <p className="text-xs italic text-slate-500 max-w-sm">
                  "{currentCard.exampleSentence}"
                </p>
              )}
            </div>
          )}
        </div>

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Hiện Đáp Án
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2 w-full pt-4">
            <button
              onClick={() => handleReview(0)}
              className="flex flex-col items-center rounded-xl bg-rose-50 border border-rose-200 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <span>Quên (0)</span>
              <span className="text-[10px] text-rose-400 font-normal">
                Học lại
              </span>
            </button>
            <button
              onClick={() => handleReview(1)}
              className="flex flex-col items-center rounded-xl bg-amber-50 border border-amber-200 py-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              <span>Khó (1)</span>
              <span className="text-[10px] text-amber-400 font-normal">
                &lt; 1 ngày
              </span>
            </button>
            <button
              onClick={() => handleReview(2)}
              className="flex flex-col items-center rounded-xl bg-blue-50 border border-blue-200 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <span>Tốt (2)</span>
              <span className="text-[10px] text-blue-400 font-normal">
                3 ngày
              </span>
            </button>
            <button
              onClick={() => handleReview(3)}
              className="flex flex-col items-center rounded-xl bg-emerald-50 border border-emerald-200 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <span>Dễ (3)</span>
              <span className="text-[10px] text-emerald-400 font-normal">
                7 ngày
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
