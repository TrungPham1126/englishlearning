import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Clock,
  Percent,
  RotateCcw,
  CheckCircle2,
  Edit3,
  Trash2,
  FileText,
  Volume2,
  Headphones,
  Mic,
  BookOpen,
  Award,
  RefreshCw,
  ArrowRight,
  Layers,
} from "lucide-react";
import { teacherApi } from "../../api/teacherApi";

export interface AssignmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: any | null;
  onEdit: (assignment: any) => void;
  onDelete: (assignmentId: string, title?: string) => void;
}

export const AssignmentDetailsModal: React.FC<AssignmentDetailsModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onEdit,
  onDelete,
}) => {
  const [detailData, setDetailData] = useState<any | null>(assignment);
  const [loading, setLoading] = useState<boolean>(false);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setDetailData(assignment);
    if (!isOpen || !assignment?.id) return;

    // Tự động nạp chi tiết từ database nếu questions bị rỗng hoặc chưa đủ thông tin
    if (!assignment.questions || assignment.questions.length === 0) {
      setLoading(true);
      teacherApi
        .getAssignment(assignment.id)
        .then((res: any) => {
          const fetched = res?.data?.data || res?.data;
          if (fetched) {
            setDetailData(fetched);
          }
        })
        .catch((err) => {
          console.error("Lỗi khi tải chi tiết bài tập:", err);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, assignment]);

  const activeAssignment = detailData || assignment;
  if (!isOpen || !activeAssignment) return null;

  const skill = String(activeAssignment.skillType || "READING").toUpperCase();
  const maxErr =
    activeAssignment.maxAllowedErrorPercent != null
      ? activeAssignment.maxAllowedErrorPercent
      : activeAssignment.passScore != null
      ? Math.max(
          0,
          100 -
            (activeAssignment.passScore <= 10
              ? activeAssignment.passScore * 10
              : activeAssignment.passScore)
        )
      : 20;
  const passScoreVal =
    activeAssignment.passScore != null
      ? activeAssignment.passScore
      : (100 - maxErr) / 10;
  const timeLimit = activeAssignment.timeLimitMinutes || 30;
  const maxAttempts = activeAssignment.maxAttempts || 3;
  const questions: any[] = activeAssignment.questions || [];

  const handlePlayAudio = (url: string) => {
    if (!url) return;
    if (playingAudioUrl === url && audioPlayerRef.current) {
      if (audioPlayerRef.current.paused) {
        audioPlayerRef.current.play();
      } else {
        audioPlayerRef.current.pause();
        setPlayingAudioUrl(null);
      }
      return;
    }
    setPlayingAudioUrl(url);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = url;
      audioPlayerRef.current.play().catch(console.error);
    }
  };

  const getSkillBadge = (s: string) => {
    switch (s) {
      case "LISTENING":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
          icon: Headphones,
          label: "Nghe Hiểu (Listening)",
        };
      case "SPEAKING":
        return {
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
          icon: Mic,
          label: "Luyện Nói (Speaking)",
        };
      case "WRITING":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
          icon: Edit3,
          label: "Luyện Viết (Writing)",
        };
      case "VOCABULARY":
      case "VOCAB":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
          icon: BookOpen,
          label: "Từ Vựng (Vocabulary)",
        };
      case "GRAMMAR":
        return {
          bg: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
          icon: FileText,
          label: "Ngữ Pháp (Grammar)",
        };
      default:
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
          icon: FileText,
          label: "Đọc Hiểu (Reading)",
        };
    }
  };

  const badge = getSkillBadge(skill);
  const Icon = badge.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
      <audio
        ref={audioPlayerRef}
        onEnded={() => setPlayingAudioUrl(null)}
        className="hidden"
      />

      <div className="relative flex flex-col w-full max-w-4xl h-[90vh] max-h-[850px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white shadow-md">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${badge.bg}`}
                >
                  {badge.label}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {questions.length} câu hỏi
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {activeAssignment.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(activeAssignment);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Edit3 size={14} />
              <span>Chỉnh Sửa</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(activeAssignment.id, activeAssignment.title);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold transition cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Xóa</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Bar Thống Kê Cấu Hình Khảo Thí */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock size={13} className="text-blue-500" />
                Thời Gian Làm Bài
              </span>
              <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                {timeLimit} phút
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Percent size={13} className="text-amber-500" />
                Phạm Vi Sai Cho Phép
              </span>
              <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                Sai tối đa ≤ {maxErr}%
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Award size={13} className="text-emerald-500" />
                Điểm Đạt Chuẩn (PASS)
              </span>
              <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                ≥{" "}
                {passScoreVal <= 10
                  ? (passScoreVal * 10).toFixed(0)
                  : passScoreVal.toFixed(0)}
                /100 pts
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <RotateCcw size={13} className="text-blue-600 dark:text-blue-400" />
                Số Lần Làm Tối Đa
              </span>
              <p className="text-sm font-extrabold text-blue-800 dark:text-blue-300">
                {maxAttempts} lần làm bài
              </p>
            </div>
          </div>

          {/* 2. Audio Player (Listening/Speaking) */}
          {activeAssignment.audioUrl && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Volume2 size={15} className="text-emerald-500" />
                File Âm Thanh Bài Nghe / Mẫu:
              </span>
              <audio controls src={activeAssignment.audioUrl} className="w-full h-10" />
            </div>
          )}

          {/* 3. Reading Passage / Script */}
          {activeAssignment.listeningScript && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Listening Transcript:
              </span>
              <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto p-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 font-mono">
                {activeAssignment.listeningScript}
              </div>
            </div>
          )}

          {/* 4. Danh Sách Câu Hỏi & Đáp Án */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <FileText size={16} className="text-blue-600" />
                <span>Nội Dung Câu Hỏi &amp; Đáp Án ({questions.length} câu)</span>
              </h3>
              {loading && (
                <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                  <RefreshCw size={13} className="animate-spin" />
                  Đang tải từ DB...
                </span>
              )}
            </div>

            {loading && questions.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-blue-500" />
                <p className="text-xs text-slate-500">Đang truy vấn nội dung câu hỏi từ cơ sở dữ liệu...</p>
              </div>
            ) : questions.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Chưa có câu hỏi nào trong bài tập này.
              </p>
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => {
                  const opts: any[] = q.options || [];
                  const resolvedAnswer = (q.correctAnswer || "").trim().toLowerCase();
                  const isMatching = String(q.questionType).toUpperCase() === "MATCHING";
                  const isPlayingThis = playingAudioUrl === q.mediaUrl;

                  return (
                    <div
                      key={q.id || idx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 text-xs font-black shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                                {q.promptText || q.prompt || "(Không có nội dung câu hỏi)"}
                              </p>
                              {q.mediaUrl && (
                                <button
                                  type="button"
                                  onClick={() => handlePlayAudio(q.mediaUrl)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                                    isPlayingThis
                                      ? "bg-emerald-600 text-white animate-pulse"
                                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                  }`}
                                  title="Nghe phát âm từ vựng"
                                >
                                  <Volume2 size={12} />
                                  <span>{isPlayingThis ? "Đang phát" : "Phát âm"}</span>
                                </button>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              {q.questionType} • {q.points || 1} điểm
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Matching Format: Display Word <-> Definition explicitly */}
                      {isMatching ? (
                        <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-slate-900/40 border border-indigo-200 dark:border-indigo-900/40 space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                              <Layers size={13} /> Cặp ghép:
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-800">
                              {q.promptText || q.prompt}
                            </span>
                            <ArrowRight size={13} className="text-indigo-600 dark:text-indigo-400" />
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                              {q.correctAnswer}
                            </span>
                          </div>
                          {q.explanation && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                              Phiên âm & Gợi ý: {q.explanation}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Options for Multiple Choice */}
                          {opts.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {opts.map((opt, oIdx) => {
                                const optText = opt.optionText || opt || "";
                                const optLabel =
                                  opt.optionLabel || String.fromCharCode(65 + oIdx);
                                const isMatch =
                                  opt.isCorrect ||
                                  optText.trim().toLowerCase() === resolvedAnswer ||
                                  optLabel.toLowerCase() === resolvedAnswer;

                                return (
                                  <div
                                    key={opt.id || oIdx}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                      isMatch
                                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold"
                                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                                    }`}
                                  >
                                    <span
                                      className={`w-5 h-5 flex items-center justify-center rounded text-[11px] font-black shrink-0 ${
                                        isMatch
                                          ? "bg-emerald-600 text-white"
                                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                      }`}
                                    >
                                      {optLabel}
                                    </span>
                                    <span className="flex-1 truncate">{optText}</span>
                                    {isMatch && (
                                      <CheckCircle2
                                        size={14}
                                        className="text-emerald-600 shrink-0"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Correct Answer & Explanation */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-1 text-xs">
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                              <CheckCircle2 size={13} />
                              <span>Đáp án đúng:</span>
                              <span className="font-mono bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                {q.correctAnswer}
                              </span>
                            </div>
                            {q.explanation && (
                              <p className="text-slate-500 dark:text-slate-400 text-[11px] italic pl-5">
                                Giải thích: {q.explanation}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
