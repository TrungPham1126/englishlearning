import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentApi } from '@/features/student/api/studentApi';
import { normalizeScoreTo100 } from '@/features/student/utils/speakingScoring';
import {
  evaluateQuestionReviewOutcome,
  resolveRestoredOptionId,
  resolveSubmitAnswerPayload,
} from '@/features/student/utils/questionReviewScoring';
import type {
  AttemptResponse,
  QuestionResultDetail,
  DialogueSegment,
  ShadowingEvaluationResponse,
  SpeakingAiEvaluationResult,
} from '@/features/student/types';

export type PagePhase = 'CHECKING' | 'INTRO' | 'TESTING' | 'REVIEW' | 'EXHAUSTED';

export function useAssignmentTakeSession() {
  const params = useParams();
  const navigate = useNavigate();
  const assignmentId = params.assignmentId || params.id;

  const [phase, setPhase] = useState<PagePhase>('CHECKING');
  const [previousAttempts, setPreviousAttempts] = useState<AttemptResponse[]>([]);
  const [attempt, setAttempt] = useState<AttemptResponse | null>(null);

  // Chế độ Luyện tập vs Thi thử
  const [studyMode, setStudyMode] = useState<'PRACTICE' | 'TEST'>('PRACTICE');
  const [checkedQuestions, setCheckedQuestions] = useState<
    Record<
      string,
      {
        isChecked: boolean;
        isCorrect?: boolean;
        isContentCorrect?: boolean;
        isGrammarCorrect?: boolean;
        feedback?: string;
        contentAnalysis?: string;
        grammarAnalysis?: string;
        suggestedAnswer?: string;
        isEvaluating?: boolean;
      }
    >
  >({});
  const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(45 * 60);

  // Reading Passage & UI states
  const [readingMobileTab, setReadingMobileTab] = useState<'PASSAGE' | 'QUESTIONS'>('PASSAGE');
  const [showMobilePalette, setShowMobilePalette] = useState<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [fontSizeLevel, setFontSizeLevel] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const passageContainerRef = useRef<HTMLDivElement | null>(null);

  // Lưu trữ câu trả lời của học viên
  const [answers, setAnswers] = useState<
    Record<string, { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }>
  >({});

  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  // Audio Player State (Dành cho bài tập Listening)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingAiVoice, setIsPlayingAiVoice] = useState(false);
  const [showListeningScript, setShowListeningScript] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [listeningSegments, setListeningSegments] = useState<DialogueSegment[]>([]);
  const [isRepairingListeningAudio, setIsRepairingListeningAudio] = useState(false);
  const [customListeningAudioUrl, setCustomListeningAudioUrl] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheMapRef = useRef<Map<string, string>>(new Map());
  const ttsRequestSeqRef = useRef<number>(0);
  const pendingAutoPlayRef = useRef<boolean>(false);
  const createdBlobUrlsRef = useRef<string[]>([]);
  const handleSubmitTestRef = useRef<() => Promise<void>>(async () => {});
  const isSubmittingRef = useRef(false);
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  const stopAllVoicePlayback = useCallback(() => {
    ttsRequestSeqRef.current += 1;
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.onended = null;
        ttsAudioRef.current.onerror = null;
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      } catch {}
      ttsAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }, []);

  // 1. Kiểm tra trạng thái lượt làm bài ban đầu
  useEffect(() => {
    if (!assignmentId) return;
    let isMounted = true;

    const checkAttemptStatus = async () => {
      try {
        const history = await studentApi.getMyAttempts(assignmentId).catch(() => []);
        if (!isMounted) return;

        setPreviousAttempts(history);

        if (history.some((att) => Boolean(att.isExam))) {
          navigate(`/student/exams/${assignmentId}/take`, { replace: true });
          return;
        }

        const inProgressAtt = history.find((att) => att.status === 'IN_PROGRESS');
        if (inProgressAtt) {
          const detail = await studentApi
            .getAttemptDetail(inProgressAtt.attemptId)
            .catch(() => null);
          if (!isMounted) return;

          if (detail) {
            if (detail.isExam) {
              navigate(`/student/exams/${assignmentId}/take`, { replace: true });
              return;
            }
            setAttempt(detail);
            const restored: any = {};
            detail.questions?.forEach((q) => {
              restored[q.questionId] = {
                selectedOptionId: resolveRestoredOptionId(q),
                textAnswer: q.studentAnswer,
                audioUrl: q.audioUrl,
              };
            });
            setAnswers(restored);

            const limitMins = detail?.timeLimitMinutes && detail.timeLimitMinutes > 0 ? detail.timeLimitMinutes : 45;
            const totalDuration = limitMins * 60;
            if (detail.startedAt) {
              const elapsed = Math.floor(
                (Date.now() - new Date(detail.startedAt).getTime()) / 1000,
              );
              setRemainingSeconds(Math.max(60, totalDuration - elapsed));
            } else {
              setRemainingSeconds(totalDuration);
            }

            setPhase('TESTING');
            return;
          }
        }

        setPhase('INTRO');
      } catch {
        if (isMounted) setPhase('INTRO');
      }
    };

    checkAttemptStatus();
    return () => {
      isMounted = false;
    };
  }, [assignmentId]);

  // 2. Countdown Timer (luôn gọi phiên bản handleSubmitTest mới nhất qua ref, ngoài updater)
  useEffect(() => {
    if (phase !== 'TESTING') return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            void handleSubmitTestRef.current();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Danh sách câu hỏi
  const questions: QuestionResultDetail[] = useMemo(() => {
    return attempt?.questions || [];
  }, [attempt]);

  // Phân loại dạng bài
  const isReadingTest = useMemo(() => {
    const skill = String(attempt?.skillType || '').toUpperCase();
    if (skill === 'LISTENING') return false;
    const title = (attempt?.assignmentTitle || '').toLowerCase();
    const desc = `${attempt?.passage || ''} ${attempt?.assignmentDescription || ''} ${attempt?.description || ''}`.toLowerCase();
    return (
      skill === 'READING' ||
      title.includes('đọc hiểu') ||
      title.includes('reading') ||
      desc.includes('reading passage')
    );
  }, [attempt]);

  const isVocabTest = useMemo(() => {
    const skill = String((attempt as any)?.skillType || '').toUpperCase();
    const title = (attempt?.assignmentTitle || '').toLowerCase();
    return skill === 'VOCABULARY' || title.includes('từ vựng') || title.includes('vocabulary');
  }, [attempt]);

  const isListeningTest = useMemo(() => {
    if (isVocabTest) return false;
    const skill = String((attempt as any)?.skillType || '').toUpperCase();
    const title = (attempt?.assignmentTitle || '').toLowerCase();
    return (
      skill === 'LISTENING' ||
      title.includes('nghe') ||
      title.includes('listening') ||
      Boolean(attempt?.audioUrl)
    );
  }, [attempt, isVocabTest]);

  const isSpeakingTest = useMemo(() => {
    const skill = String(attempt?.skillType || '').toUpperCase();
    const hasSpeakingQuestion = questions.some((q) => {
      const type = String(q.questionType || '').toUpperCase();
      return type === 'SPEAKING' || type === 'AUDIO_RESPONSE';
    });
    if (skill === 'SPEAKING' || hasSpeakingQuestion) return true;
    if (
      skill === 'READING' ||
      skill === 'LISTENING' ||
      skill === 'WRITING' ||
      skill === 'VOCABULARY' ||
      skill === 'GRAMMAR'
    ) {
      return false;
    }
    const title = (attempt?.assignmentTitle || '').toLowerCase();
    const desc = (attempt?.assignmentDescription || attempt?.description || '').toLowerCase();
    return (
      title.includes('nói') ||
      title.includes('speaking') ||
      title.includes('shadow') ||
      title.includes('nhại') ||
      desc.includes('speaking') ||
      desc.includes('shadowing')
    );
  }, [attempt, questions]);

  const isGrammarTest = useMemo(() => {
    const skill = String((attempt as any)?.skillType || '').toUpperCase();
    const title = (attempt?.assignmentTitle || '').toLowerCase();
    return skill === 'GRAMMAR' || title.includes('ngữ pháp') || title.includes('grammar');
  }, [attempt]);

  // Nhận diện bài tập NỐI TỪ VỰNG (MATCHING)
  const isVocabMatching = useMemo(() => {
    const title = (attempt?.assignmentTitle || '').toLowerCase();
    const desc = ((attempt as any)?.assignmentDescription || (attempt as any)?.description || '').toLowerCase();
    return (
      title.includes('nối từ') ||
      title.includes('ghép cặp') ||
      title.includes('matching') ||
      desc.includes('nối từ') ||
      questions.some((q) => String(q.questionType || '').toUpperCase() === 'MATCHING')
    );
  }, [attempt, questions]);

  // Bóc tách bài đọc Reading
  const readingPassageText = useMemo(() => {
    if (!isReadingTest) return null;
    const rawDesc =
      attempt?.passage ||
      (attempt as any)?.assignmentDescription ||
      (attempt as any)?.description ||
      '';
    const hasExplicitPassageTag = /\[READING\s+PASSAGE\]/i.test(rawDesc);
    const cleaned = rawDesc
      .trim()
      .replace(/^\s*\[READING\s+PASSAGE\]\s*/i, '')
      .replace(/\n*\s*\[Loại:[^\n]*$/i, '')
      .trim();
    if (cleaned && (hasExplicitPassageTag || cleaned.length > 80)) {
      return cleaned;
    }
    return null;
  }, [isReadingTest, attempt]);

  // Số lượng câu đã trả lời
  const answeredQuestionsCount = useMemo(() => {
    return questions.filter((q) => {
      const a = answers[q.questionId];
      return Boolean(a?.selectedOptionId || (a?.textAnswer && a.textAnswer.trim().length > 0) || a?.audioUrl);
    }).length;
  }, [questions, answers]);

  // Chuỗi Streak
  const streakCount = useMemo(() => {
    let count = 0;
    for (let i = activeQuestionIdx; i >= 0; i--) {
      const q = questions[i];
      if (!q) break;
      const ck = checkedQuestions[q.questionId];
      if (ck?.isChecked && ck.isCorrect) count++;
      else break;
    }
    return count;
  }, [questions, checkedQuestions, activeQuestionIdx]);

  // Thống kê kết quả Review
  const reviewStats = useMemo(() => {
    if (phase !== 'REVIEW') return { correctCount: 0, totalQuestions: questions.length };
    const correctCount = questions.filter(
      (q) => evaluateQuestionReviewOutcome(q, answers[q.questionId]).isCorrect,
    ).length;
    return { correctCount, totalQuestions: questions.length };
  }, [questions, phase, answers]);

  // Đánh giá làm lại (Retake Evaluation)
  const retakeEvaluation = useMemo(() => {
    if (!attempt || phase !== 'REVIEW') return null;

    const hasEssay = questions.some((q) => {
      const type = String(q.questionType || '').toUpperCase();
      const p = (q.promptText || '').toLowerCase();
      return type === 'ESSAY' || type.includes('PARAGRAPH') || p.includes('bài luận');
    });

    if (hasEssay) {
      return {
        isEssay: true,
        canRetry: false,
        errorRate: 0,
        scorePercent: 0,
        message: 'Bài viết tự luận đã được nộp thành công và đang chờ giáo viên / AI chấm điểm.',
      };
    }

    const currentScore =
      attempt.score != null
        ? attempt.score
        : (attempt as any).totalScore != null
        ? (attempt as any).totalScore
        : reviewStats.totalQuestions > 0
        ? (reviewStats.correctCount / reviewStats.totalQuestions) * 10
        : 0;

    const scorePercent = Math.max(0, Math.min(100, (Number(currentScore) / 10) * 100));

    const maxAllowedError = attempt.maxAllowedErrorPercent != null
      ? attempt.maxAllowedErrorPercent
      : (attempt.passScore != null ? Math.max(0, 100 - (attempt.passScore <= 10 ? attempt.passScore * 10 : attempt.passScore)) : 20);
    const passThresholdScore = 100 - maxAllowedError;
    const maxAttemptsCount = attempt.maxAttempts != null && attempt.maxAttempts > 0 ? attempt.maxAttempts : 3;

    const completedAttempts = previousAttempts.filter((a) => a.status !== 'IN_PROGRESS');
    const getScore = (att: AttemptResponse) => normalizeScoreTo100(att.score ?? att.totalScore ?? 0);
    const prevHighest = completedAttempts.reduce((max, a) => Math.max(max, getScore(a)), 0);
    const effectiveScore = Math.max(scorePercent, prevHighest);
    const lowestErrorRate = Math.max(0, Math.round((100 - effectiveScore) * 10) / 10);

    const isPassed = lowestErrorRate <= maxAllowedError || effectiveScore >= passThresholdScore;
    const totalCompleted = completedAttempts.some((a) => a.attemptId === attempt.attemptId)
      ? completedAttempts.length
      : completedAttempts.length + 1;
    const isExhausted = !isPassed && totalCompleted >= maxAttemptsCount;
    const canRetry = !isPassed && totalCompleted < maxAttemptsCount;

    let message = isPassed
      ? `Chúc mừng! Bạn đã hoàn thành ĐẠT CHUẨN bài tập (${effectiveScore.toFixed(1)}/100 điểm, phạm vi sai ${lowestErrorRate}% ≤ ${maxAllowedError}% cho phép).`
      : isExhausted
      ? `Bạn đã làm đủ ${maxAttemptsCount} lần nhưng tỷ lệ sai (${lowestErrorRate}%) vượt quá mức cho phép (${maxAllowedError}%). Kết quả chính thức: NOT PASS (Không đạt) và không thể thử lại.`
      : `Kết quả bài làm chưa đạt chuẩn (Tỷ lệ sai ${lowestErrorRate}% > ${maxAllowedError}% cho phép). Bạn được phép làm lại tối đa ${maxAttemptsCount} lần (Còn ${Math.max(0, maxAttemptsCount - totalCompleted)} lượt).`;

    return {
      isEssay: false,
      canRetry,
      errorRate: isPassed ? 0 : lowestErrorRate,
      scorePercent: effectiveScore,
      message,
    };
  }, [attempt, phase, questions, reviewStats, previousAttempts]);

  // Cập nhật câu trả lời
  const updateAnswer = useCallback(
    (questionId: string, partial: { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }) => {
      setAnswers((prev) => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          ...partial,
        },
      }));
    },
    [],
  );

  const handleMatchingAnswers = useCallback(
    (questionId: string, partial: { selectedOptionId?: string; textAnswer?: string }) => {
      updateAnswer(questionId, partial);
    },
    [updateAnswer],
  );

  const toggleFlagQuestion = useCallback((questionId: string) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }, []);

  const scrollToQuestion = useCallback((questionId: string) => {
    const el = document.getElementById(`question-${questionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const idx = questions.findIndex((q) => q.questionId === questionId);
      if (idx !== -1) setActiveQuestionIdx(idx);
    }
  }, [questions]);

  // Helper chuẩn hóa audio URL
  const resolveAudioUrl = useCallback((url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url;
  }, []);

  const fallbackWebSpeech = useCallback(
    (text: string, reqId: number, onEnd?: () => void) => {
      if (!isMountedRef.current || reqId !== ttsRequestSeqRef.current) {
        return;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          utterance.rate = playbackRateRef.current || 0.95;
          utterance.onend = () => {
            if (isMountedRef.current && reqId === ttsRequestSeqRef.current && onEnd) {
              onEnd();
            }
          };
          utterance.onerror = () => {
            if (isMountedRef.current && reqId === ttsRequestSeqRef.current && onEnd) {
              onEnd();
            }
          };
          window.speechSynthesis.speak(utterance);
          return;
        } catch {
          if (isMountedRef.current && reqId === ttsRequestSeqRef.current && onEnd) {
            onEnd();
          }
        }
      } else if (isMountedRef.current && reqId === ttsRequestSeqRef.current && onEnd) {
        onEnd();
      }
    },
    [],
  );

  // Kokoro TTS / Web Speech API
  const speakText = useCallback(
    async (text: string, onEnd?: () => void) => {
      if (!text) {
        if (isMountedRef.current && onEnd) onEnd();
        return;
      }

      stopAllVoicePlayback();
      const reqId = ttsRequestSeqRef.current;
      const cleanText = text.trim();
      let audioUrl = ttsCacheMapRef.current.get(cleanText);

      if (!audioUrl) {
        try {
          const res = await studentApi.synthesizeTTS({
            text: cleanText,
            voice: 'af_heart',
            speed: 1.0,
          });
          if (res?.audioUrl) {
            audioUrl = res.audioUrl;
            ttsCacheMapRef.current.set(cleanText, audioUrl);
          }
        } catch (err) {
          console.warn('Kokoro TTS fallback:', err);
        }
      }

      if (!isMountedRef.current || reqId !== ttsRequestSeqRef.current) {
        return;
      }

      if (audioUrl) {
        try {
          const audio = new Audio(resolveAudioUrl(audioUrl));
          audio.playbackRate = playbackRateRef.current || 1.0;
          audio.defaultPlaybackRate = playbackRateRef.current || 1.0;
          (audio as any).preservesPitch = true;
          ttsAudioRef.current = audio;
          audio.onended = () => {
            if (ttsAudioRef.current === audio) ttsAudioRef.current = null;
            if (isMountedRef.current && reqId === ttsRequestSeqRef.current && onEnd) {
              onEnd();
            }
          };
          audio.onerror = () => {
            if (ttsAudioRef.current === audio) ttsAudioRef.current = null;
            fallbackWebSpeech(cleanText, reqId, onEnd);
          };
          await audio.play();
          if (!isMountedRef.current || reqId !== ttsRequestSeqRef.current) {
            audio.pause();
            if (ttsAudioRef.current === audio) ttsAudioRef.current = null;
          }
          return;
        } catch {
          if (!isMountedRef.current || reqId !== ttsRequestSeqRef.current) {
            return;
          }
          fallbackWebSpeech(cleanText, reqId, onEnd);
          return;
        }
      }

      fallbackWebSpeech(cleanText, reqId, onEnd);
    },
    [resolveAudioUrl, stopAllVoicePlayback, fallbackWebSpeech],
  );

  // Audio Player Controls
  const mainAudioUrl = customListeningAudioUrl || attempt?.audioUrl;

  const toggleAudioPlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(console.warn);
    }
  }, [isPlayingAudio]);

  const handleSeekAudio = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setAudioCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const handleSkipAudio = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    const target = Math.max(0, Math.min(audioDuration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = target;
    setAudioCurrentTime(target);
  }, [audioDuration]);

  const handleRateChange = useCallback((rate: number) => {
    playbackRateRef.current = rate;
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      audioRef.current.defaultPlaybackRate = rate;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.playbackRate = rate;
      ttsAudioRef.current.defaultPlaybackRate = rate;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Đồng bộ sự kiện từ audio element bài nghe
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const updateTime = () => {
      setAudioCurrentTime(el.currentTime);
      if (Number.isFinite(el.duration) && !isNaN(el.duration) && el.duration > 0) {
        setAudioDuration(el.duration);
      }
    };
    const updateMeta = () => {
      if (Number.isFinite(el.duration) && !isNaN(el.duration) && el.duration > 0) {
        setAudioDuration(el.duration);
      }
      el.playbackRate = playbackRateRef.current;
      el.defaultPlaybackRate = playbackRateRef.current;
    };
    const onPlay = () => setIsPlayingAudio(true);
    const onPause = () => setIsPlayingAudio(false);
    const onEnded = () => {
      setIsPlayingAudio(false);
      setAudioCurrentTime(0);
    };

    el.addEventListener('timeupdate', updateTime);
    el.addEventListener('loadedmetadata', updateMeta);
    el.addEventListener('durationchange', updateMeta);
    el.addEventListener('canplay', updateMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);

    if (mainAudioUrl && pendingAutoPlayRef.current) {
      pendingAutoPlayRef.current = false;
      el.load();
      el.playbackRate = playbackRateRef.current;
      el.defaultPlaybackRate = playbackRateRef.current;
      el.play().catch(console.warn);
    }

    return () => {
      el.removeEventListener('timeupdate', updateTime);
      el.removeEventListener('loadedmetadata', updateMeta);
      el.removeEventListener('durationchange', updateMeta);
      el.removeEventListener('canplay', updateMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
    };
  }, [mainAudioUrl, phase]);

  // Voice AI đoạn văn / tổng hợp audio gắn vào trình phát có thanh giây & tốc độ
  const toggleAiVoiceStream = useCallback(async () => {
    if (isPlayingAiVoice || isRepairingListeningAudio) {
      stopAllVoicePlayback();
      setIsPlayingAiVoice(false);
      setIsRepairingListeningAudio(false);
      return;
    }

    const script = (attempt?.listeningScript || attempt?.passage || '').trim();
    if (!script) return;

    const reqId = ttsRequestSeqRef.current + 1;
    ttsRequestSeqRef.current = reqId;
    setIsRepairingListeningAudio(true);

    let resolvedUrl: string | undefined;
    try {
      const firstQ = questions[0];
      if (firstQ?.questionId && typeof studentApi.repairQuestionAudio === 'function') {
        try {
          const rep = await studentApi.repairQuestionAudio(firstQ.questionId);
          resolvedUrl = rep?.url || (rep as any)?.audioUrl;
        } catch {
          // Fallback sang tổng hợp TTS trực tiếp từ listeningScript
        }
      }

      if (!isMountedRef.current || reqId !== ttsRequestSeqRef.current) {
        return;
      }

      if (!resolvedUrl && typeof studentApi.synthesizeTTS === 'function') {
        const cached = ttsCacheMapRef.current.get(script);
        if (cached) {
          resolvedUrl = cached;
        } else {
          const ttsRes = await studentApi.synthesizeTTS({
            text: script,
            voice: 'af_heart',
            speed: 1.0,
          });
          if (ttsRes?.audioUrl) {
            resolvedUrl = ttsRes.audioUrl;
            ttsCacheMapRef.current.set(script, resolvedUrl);
          }
        }
      }
    } catch (err) {
      console.warn('Không thể tổng hợp audio bài nghe:', err);
    }

    if (!isMountedRef.current || reqId !== ttsRequestSeqRef.current) {
      return;
    }

    setIsRepairingListeningAudio(false);

    if (resolvedUrl) {
      pendingAutoPlayRef.current = true;
      setCustomListeningAudioUrl(resolvedUrl);
      return;
    }

    setIsPlayingAiVoice(true);
    fallbackWebSpeech(script, reqId, () => {
      if (isMountedRef.current && reqId === ttsRequestSeqRef.current) {
        setIsPlayingAiVoice(false);
      }
    });
  }, [
    isPlayingAiVoice,
    isRepairingListeningAudio,
    attempt,
    questions,
    stopAllVoicePlayback,
    fallbackWebSpeech,
  ]);

  // Sửa lỗi audio tự động
  const handleRepairListeningAudio = useCallback(async () => {
    if (!attempt?.assignmentId) return;
    setIsRepairingListeningAudio(true);
    try {
      const firstQ = questions[0];
      if (firstQ?.questionId) {
        const res = await studentApi.repairQuestionAudio(firstQ.questionId);
        const repUrl = res?.url || (res as any)?.audioUrl;
        if (repUrl) {
          setCustomListeningAudioUrl(repUrl);
          if (audioRef.current) {
            audioRef.current.src = resolveAudioUrl(repUrl);
            audioRef.current.load();
          }
        }
      }
    } catch (err) {
      console.warn('Lỗi sửa audio:', err);
    } finally {
      setIsRepairingListeningAudio(false);
    }
  }, [attempt, questions, resolveAudioUrl]);

  // Kiểm tra đáp án tức thì (PRACTICE MODE)
  const handleCheckInstantAnswer = useCallback((questionId: string) => {
    const q = questions.find((item) => item.questionId === questionId);
    if (!q) return;

    const ans = answers[questionId];
    if (!ans) return;

    const { isCorrect } = evaluateQuestionReviewOutcome(q, ans);

    setCheckedQuestions((prev) => ({
      ...prev,
      [questionId]: {
        isChecked: true,
        isCorrect,
        suggestedAnswer: q.correctAnswer,
        feedback: isCorrect
          ? 'Chính xác! Bạn đã nắm vững kiến thức câu hỏi này.'
          : 'Chưa chính xác. Hãy đối chiếu gợi ý bên dưới để hoàn thiện đáp án nhé!',
      },
    }));
  }, [questions, answers]);

  // Bắt đầu làm bài mới
  const handleStartNewAttempt = useCallback(async () => {
    if (!assignmentId) return;

    const sampleAttempt = attempt || previousAttempts[0];
    const maxAllowedError = sampleAttempt?.maxAllowedErrorPercent != null
      ? sampleAttempt.maxAllowedErrorPercent
      : (sampleAttempt?.passScore != null ? Math.max(0, 100 - (sampleAttempt.passScore <= 10 ? sampleAttempt.passScore * 10 : sampleAttempt.passScore)) : 20);
    const passThresholdScore = 100 - maxAllowedError;
    const maxAttemptsCount = sampleAttempt?.maxAttempts != null && sampleAttempt.maxAttempts > 0 ? sampleAttempt.maxAttempts : 3;

    const completedAttempts = previousAttempts.filter((a) => a.status !== 'IN_PROGRESS');
    const getScore = (att: AttemptResponse) => normalizeScoreTo100(att.score ?? att.totalScore ?? 0);
    const highestScore = completedAttempts.reduce((max, a) => Math.max(max, getScore(a)), 0);
    const lowestErrorRate = Math.max(0, Math.round((100 - highestScore) * 10) / 10);

    if (completedAttempts.length > 0 && (lowestErrorRate <= maxAllowedError || highestScore >= passThresholdScore)) {
      alert(`Bài tập này đã ĐẠT CHUẨN (Điểm: ${highestScore.toFixed(1)}/100, sai ${lowestErrorRate}% ≤ ${maxAllowedError}% cho phép). Không thể làm lại bài đã đạt!`);
      return;
    }

    if (completedAttempts.length >= maxAttemptsCount) {
      alert(`Bạn đã làm đủ ${maxAttemptsCount} lần nhưng tỷ lệ sai (${lowestErrorRate}%) vượt quá mức cho phép (${maxAllowedError}%). Kết quả: NOT PASS và không thể thử lại.`);
      return;
    }

    setIsStarting(true);
    try {
      const newAtt = await studentApi.startAssignment(assignmentId);
      const detail = await studentApi.getAttemptDetail(newAtt.attemptId);
      if (detail.isExam) {
        navigate(`/student/exams/${assignmentId}/take`, { replace: true });
        return;
      }
      setAttempt(detail);
      setAnswers({});
      setCheckedQuestions({});
      setExpandedHints({});
      setFlaggedQuestions({});
      const limitMins = detail?.timeLimitMinutes && detail.timeLimitMinutes > 0 ? detail.timeLimitMinutes : 45;
      setRemainingSeconds(limitMins * 60);
      setPhase('TESTING');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Không thể bắt đầu lượt làm bài mới.');
    } finally {
      setIsStarting(false);
    }
  }, [assignmentId, attempt, previousAttempts]);

  // Nộp bài thi
  const handleSubmitTest = useCallback(async () => {
    if (!attempt || !assignmentId || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const payloadAnswers = questions.map((q) =>
        resolveSubmitAnswerPayload(q, answers[q.questionId]),
      );

      const res = await studentApi.submitAssignment(
        assignmentId,
        attempt.attemptId,
        payloadAnswers,
      );

      window.dispatchEvent(
        new CustomEvent("student-progress-updated", {
          detail: { assignmentId, attemptId: attempt.attemptId },
        }),
      );

      // Nạp lại chi tiết bài làm đã chấm, bảo toàn đáp án cục bộ khi câu hỏi chưa được lưu chi tiết
      const freshDetail = await studentApi.getAttemptDetail(res.attemptId || attempt.attemptId);
      setAttempt(freshDetail);

      setAnswers((prev) => {
        const merged: Record<
          string,
          { selectedOptionId?: string; textAnswer?: string; audioUrl?: string }
        > = { ...prev };
        freshDetail.questions?.forEach((q) => {
          const existing = prev[q.questionId];
          const serverSelectedOptionId = resolveRestoredOptionId(q);
          const serverTextAnswer =
            q.studentAnswer != null && String(q.studentAnswer).trim().length > 0
              ? q.studentAnswer
              : undefined;
          const serverAudioUrl = q.audioUrl || undefined;

          merged[q.questionId] = {
            selectedOptionId: serverSelectedOptionId || existing?.selectedOptionId,
            textAnswer: serverTextAnswer ?? existing?.textAnswer,
            audioUrl: serverAudioUrl || existing?.audioUrl,
          };
        });
        return merged;
      });

      setExpandedHints({});
      setIsSubmitModalOpen(false);
      setPhase('REVIEW');
      setShowListeningScript(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Có lỗi xảy ra khi nộp bài. Vui lòng thử lại!');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [attempt, assignmentId, questions, answers]);

  handleSubmitTestRef.current = handleSubmitTest;

  // Highlight văn bản
  const applyHighlight = useCallback((color: 'yellow' | 'green') => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('mark');
    span.className = color === 'yellow' ? 'bg-amber-200 dark:bg-amber-900/60 rounded px-1' : 'bg-emerald-200 dark:bg-emerald-900/60 rounded px-1';
    try {
      range.surroundContents(span);
      selection.removeAllRanges();
    } catch {}
  }, []);

  const removeAllHighlights = useCallback(() => {
    if (!passageContainerRef.current) return;
    const marks = passageContainerRef.current.querySelectorAll('mark');
    marks.forEach((m) => {
      const parent = m.parentNode;
      while (m.firstChild) parent?.insertBefore(m.firstChild, m);
      parent?.removeChild(m);
    });
  }, []);

  // Tải lên file ghi âm Speaking
  const handleUploadSpeaking = useCallback(
    async (
      questionId: string,
      blob: Blob,
      _result?: ShadowingEvaluationResponse | SpeakingAiEvaluationResult,
    ) => {
      if (!attempt) return;
      setIsUploadingAudio(true);
      try {
        await studentApi.uploadSpeakingAudio(attempt.attemptId, questionId, blob);
        const audioUrl = URL.createObjectURL(blob);
        createdBlobUrlsRef.current.push(audioUrl);
        updateAnswer(questionId, { audioUrl });
      } catch (err: any) {
        alert('Không thể tải lên file ghi âm: ' + (err.response?.data?.message || err.message));
      } finally {
        setIsUploadingAudio(false);
      }
    },
    [attempt, updateAnswer],
  );

  // Dọn dẹp audio, speechSynthesis và blob URL khi unmount để tránh memory leak
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      pendingAutoPlayRef.current = false;
      stopAllVoicePlayback();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      createdBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      createdBlobUrlsRef.current = [];
    };
  }, [stopAllVoicePlayback]);

  return {
    assignmentId,
    phase,
    setPhase,
    previousAttempts,
    attempt,
    questions,
    studyMode,
    setStudyMode,
    checkedQuestions,
    expandedHints,
    setExpandedHints,
    flaggedQuestions,
    toggleFlagQuestion,
    activeQuestionIdx,
    setActiveQuestionIdx,
    remainingSeconds,
    readingMobileTab,
    setReadingMobileTab,
    showMobilePalette,
    setShowMobilePalette,
    isSubmitModalOpen,
    setIsSubmitModalOpen,
    fontSizeLevel,
    setFontSizeLevel,
    passageContainerRef,
    answers,
    updateAnswer,
    handleMatchingAnswers,
    isStarting,
    isSubmitting,
    isUploadingAudio,
    isReadingTest,
    isListeningTest,
    isSpeakingTest,
    isVocabTest,
    isGrammarTest,
    isVocabMatching,
    readingPassageText,
    answeredQuestionsCount,
    streakCount,
    reviewStats,
    retakeEvaluation,
    scrollToQuestion,
    resolveAudioUrl,
    speakText,
    audioRef,
    mainAudioUrl,
    isPlayingAudio,
    toggleAudioPlay,
    audioCurrentTime,
    audioDuration,
    handleSeekAudio,
    handleSkipAudio,
    playbackRate,
    handleRateChange,
    audioVolume,
    setAudioVolume,
    isMuted,
    toggleMute,
    showListeningScript,
    setShowListeningScript,
    isPlayingAiVoice,
    toggleAiVoiceStream,
    listeningSegments,
    isRepairingListeningAudio,
    handleRepairListeningAudio,
    handleCheckInstantAnswer,
    handleStartNewAttempt,
    handleSubmitTest,
    applyHighlight,
    removeAllHighlights,
    handleUploadSpeaking,
    navigate,
  };
}

export default useAssignmentTakeSession;
