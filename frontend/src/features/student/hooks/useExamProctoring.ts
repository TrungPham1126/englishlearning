import { useCallback, useEffect, useRef, useState } from 'react';
import { studentApi } from '@/features/student/api/studentApi';
import type { AttemptResponse } from '@/features/student/types';

export interface ProctoringWarningState {
  count: number;
  max: number;
  reason: string;
}

interface UseExamProctoringOptions {
  attemptId?: string;
  active: boolean;
  strictFullscreen: boolean;
  maxViolations?: number;
  initialViolationCount?: number;
  onGetCurrentAnswers: () => Array<{
    questionId: string;
    selectedOptionId?: string;
    textAnswer?: string;
  }>;
  onCheatingLockout: (updatedAttempt: AttemptResponse) => void;
  onAttemptSynced?: (updatedAttempt: AttemptResponse) => void;
}

export function useExamProctoring({
  attemptId,
  active,
  strictFullscreen,
  maxViolations = 3,
  initialViolationCount = 0,
  onGetCurrentAnswers,
  onCheatingLockout,
  onAttemptSynced,
}: UseExamProctoringOptions) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    Boolean(typeof document !== 'undefined' && document.fullscreenElement),
  );
  const [violationCount, setViolationCount] = useState<number>(initialViolationCount);
  const [warningModal, setWarningModal] = useState<ProctoringWarningState | null>(null);

  const armedRef = useRef<boolean>(false);
  const recordingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const graceUntilRef = useRef<number>(0);
  const lastViolationAtRef = useRef<number>(0);
  const violationCountRef = useRef<number>(initialViolationCount);
  const onGetCurrentAnswersRef = useRef(onGetCurrentAnswers);
  const onCheatingLockoutRef = useRef(onCheatingLockout);
  const onAttemptSyncedRef = useRef(onAttemptSynced);

  violationCountRef.current = violationCount;
  onGetCurrentAnswersRef.current = onGetCurrentAnswers;
  onCheatingLockoutRef.current = onCheatingLockout;
  onAttemptSyncedRef.current = onAttemptSynced;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      armedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setViolationCount(initialViolationCount);
  }, [initialViolationCount]);

  useEffect(() => {
    if (!active) {
      armedRef.current = false;
      setWarningModal(null);
    }
  }, [active]);

  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    graceUntilRef.current = Date.now() + 1200;
    armedRef.current = true;
    try {
      if (typeof document !== 'undefined' && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
      return true;
    } catch {
      setIsFullscreen(Boolean(typeof document !== 'undefined' && document.fullscreenElement));
      return false;
    }
  }, []);

  const exitFullscreenSafely = useCallback(async () => {
    armedRef.current = false;
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen exit errors
    } finally {
      setIsFullscreen(false);
    }
  }, []);

  const triggerViolation = useCallback(
    async (eventType: string, reason: string) => {
      if (!active || !attemptId || !armedRef.current) return;
      const now = Date.now();
      if (now < graceUntilRef.current) return;
      if (recordingRef.current || now - lastViolationAtRef.current < 1500) return;

      recordingRef.current = true;
      lastViolationAtRef.current = now;

      try {
        const res = await studentApi.recordExamViolation(attemptId, {
          eventType,
          reason,
          currentAnswers: onGetCurrentAnswersRef.current(),
        });
        if (!isMountedRef.current) return;

        const nextCount = res.violationCount ?? violationCountRef.current + 1;
        const maxLimit = res.maxViolations || maxViolations || 3;
        violationCountRef.current = nextCount;
        setViolationCount(nextCount);
        onAttemptSyncedRef.current?.(res);

        if (res.isCheatingFlagged || nextCount >= maxLimit) {
          setWarningModal(null);
          await exitFullscreenSafely();
          if (isMountedRef.current) {
            onCheatingLockoutRef.current(res);
          }
        } else {
          setWarningModal({
            count: nextCount,
            max: maxLimit,
            reason,
          });
        }
      } catch (err) {
        console.error('Không thể ghi nhận vi phạm màn hình:', err);
      } finally {
        recordingRef.current = false;
      }
    },
    [active, attemptId, exitFullscreenSafely, maxViolations],
  );

  useEffect(() => {
    if (!active) return;

    const handleFullscreenChange = () => {
      const full = Boolean(document.fullscreenElement);
      setIsFullscreen(full);
      if (strictFullscreen && !full && armedRef.current) {
        void triggerViolation(
          'FULLSCREEN_EXIT',
          'Thoát khỏi chế độ toàn màn hình khi đang làm bài thi.',
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && armedRef.current) {
        void triggerViolation(
          'TAB_SWITCH',
          'Chuyển sang tab hoặc ứng dụng khác trong giờ thi.',
        );
      }
    };

    const handleWindowBlur = () => {
      if (armedRef.current && Date.now() >= graceUntilRef.current) {
        void triggerViolation(
          'WINDOW_BLUR',
          'Rời khỏi cửa sổ trình duyệt trong khi làm bài thi.',
        );
      }
    };

    const blockAction = (e: Event) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      if (
        e.key === 'F12' ||
        (ctrlOrMeta && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
        (ctrlOrMeta && key === 'u')
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('contextmenu', blockAction);
    document.addEventListener('copy', blockAction);
    document.addEventListener('cut', blockAction);
    document.addEventListener('paste', blockAction);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('contextmenu', blockAction);
      document.removeEventListener('copy', blockAction);
      document.removeEventListener('cut', blockAction);
      document.removeEventListener('paste', blockAction);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, strictFullscreen, triggerViolation]);

  const dismissWarningAndResume = useCallback(async () => {
    setWarningModal(null);
    await enterFullscreen();
  }, [enterFullscreen]);

  return {
    isFullscreen,
    violationCount,
    warningModal,
    enterFullscreen,
    exitFullscreenSafely,
    dismissWarningAndResume,
  };
}
