import { useState, useEffect, useCallback, useMemo } from "react";
import { studentApi } from "@/features/student/api/studentApi";
import { isGradingRubricOrMetaText } from "@/utils/sampleAudioPlayer";
import { detectItemCategory } from "@/features/student/components/SkillAccordion";
import { normalizeScoreTo100 } from "@/features/student/utils/speakingScoring";
import type {
  AttemptResponse,
  DaySpeakingGroup,
  FullSpeakingAiResult,
  MyCourseResponse,
  ShadowingEvaluationResponse,
  SpeakingAssignmentItem,
} from "@/features/student/types";

export interface UseSpeakingDailyPlansOptions {
  routeAssignmentId?: string;
  routeAttemptId?: string;
}

export function useSpeakingDailyPlans(options?: UseSpeakingDailyPlansOptions) {
  const routeAssignmentId = options?.routeAssignmentId;
  const routeAttemptId = options?.routeAttemptId;

  // Khóa học & Lớp học
  const [courses, setCourses] = useState<MyCourseResponse[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Danh sách các Ngày (Day 1, Day 2, Day 3...) có bài Speaking
  const [daysList, setDaysList] = useState<DaySpeakingGroup[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Bài tập Speaking đang chọn
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Lần nộp bài của bài tập đang chọn
  const [attempts, setAttempts] = useState<AttemptResponse[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<AttemptResponse | null>(null);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  // Báo cáo AI cho câu hỏi đang chọn
  const [aiReport, setAiReport] = useState<FullSpeakingAiResult | null>(null);
  const [shadowingReport, setShadowingReport] = useState<ShadowingEvaluationResponse | null>(null);
  const [reportQuestionId, setReportQuestionId] = useState<string | null>(null);

  // Trạng thái thao tác
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Trích xuất báo cáo AI cho 1 câu hỏi cụ thể
  const extractAndSetAiReportForQuestion = useCallback(
    (q: any, attempt: AttemptResponse | null) => {
      if (!q) return;
      setShadowingReport(null);
      setAiReport(null);
      setReportQuestionId(q.questionId);

      // 1. Thử lấy từ evalFeedback lưu trực tiếp trên câu trả lời
      if (q.evalFeedback) {
        try {
          const parsed = JSON.parse(q.evalFeedback);
          if (parsed.kpi || parsed.sentenceTokens || parsed.overallScore !== undefined) {
            setShadowingReport(parsed);
            return;
          } else if (parsed.overallBand !== undefined || parsed.pronunciationScore !== undefined) {
            setAiReport(parsed);
            return;
          }
        } catch {}
      }

      // 2. Thử lấy từ aiFeedback của cả attempt
      if (attempt?.aiFeedback) {
        try {
          const parsed = JSON.parse(attempt.aiFeedback);
          if (parsed.kpi || parsed.sentenceTokens) {
            setShadowingReport(parsed);
          } else {
            setAiReport(parsed);
          }
        } catch {}
      }
    },
    [],
  );

  // Áp dụng chi tiết một attempt vào state và tự động trích xuất đánh giá AI
  const applyAttemptDetail = useCallback(
    (detail: AttemptResponse) => {
      setCurrentAttempt(detail);
      setSelectedQuestionIndex(0);
      setShadowingReport(null);
      setAiReport(null);
      setReportQuestionId(null);

      const questions = detail.questions || [];
      if (questions.length > 0) {
        const firstQ = questions[0];
        extractAndSetAiReportForQuestion(firstQ, detail);
      }
    },
    [extractAndSetAiReportForQuestion],
  );

  // Tải chi tiết bài tập & khởi tạo attempt nếu chưa có
  const selectAndLoadAssignment = useCallback(
    async (asgId: string, targetAttemptId?: string) => {
      try {
        const rawList = await studentApi.getMyAttempts(asgId).catch(() => []);
        const byNewest = (a: AttemptResponse, b: AttemptResponse) =>
          (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0);
        const sortedAttempts = [...rawList].sort(byNewest);

        if (sortedAttempts.length > 0) {
          setAttempts(sortedAttempts);

          let target: AttemptResponse | undefined;
          if (targetAttemptId) {
            target = sortedAttempts.find((a) => a.attemptId === targetAttemptId);
          }

          if (!target) {
            // Quy tắc: Luôn ưu tiên hiển thị lượt làm có ĐIỂM CAO NHẤT (highest score)
            const getScore = (att: AttemptResponse) =>
              normalizeScoreTo100(att.score ?? att.totalScore ?? 0);
            const completedAttempts = sortedAttempts.filter(
              (a) => a.status !== "IN_PROGRESS" && (a.score !== undefined || a.totalScore !== undefined),
            );
            if (completedAttempts.length > 0) {
              target = [...completedAttempts].sort((a, b) => getScore(b) - getScore(a))[0];
            } else {
              target =
                sortedAttempts.find((a) => a.status !== "IN_PROGRESS") ||
                sortedAttempts[0];
            }
          }

          const detail = await studentApi
            .getAttemptDetail(target.attemptId)
            .catch(() => target!);
          applyAttemptDetail(detail);

          // Cập nhật trạng thái trực tiếp của task đang chọn vào daysList
          const completedAttempts = sortedAttempts.filter((a) => a.status !== "IN_PROGRESS");
          const bestScore = completedAttempts.length > 0
            ? completedAttempts.reduce(
                (max, a) => Math.max(max, normalizeScoreTo100(a.score ?? a.totalScore ?? 0)),
                0,
              )
            : null;
          setDaysList((prev) =>
            prev.map((d) => ({
              ...d,
              speakingTasks: d.speakingTasks.map((t) =>
                t.id === asgId
                  ? {
                      ...t,
                      isCompleted: completedAttempts.length > 0,
                      highestScore: bestScore,
                      attemptsCount: sortedAttempts.length,
                    }
                  : t,
              ),
            })),
          );
        } else {
          // Chưa có lần làm nào -> Tự động khởi tạo attempt mới để học sinh làm bài ngay trên trang!
          const newAttempt = await studentApi
            .startAssignment(asgId)
            .catch(() => null);

          if (newAttempt) {
            const detail = await studentApi
              .getAttemptDetail(newAttempt.attemptId)
              .catch(() => newAttempt);
            setAttempts([detail]);
            applyAttemptDetail(detail);
          } else {
            setCurrentAttempt(null);
            setAttempts([]);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải hoặc khởi tạo bài tập:", err);
        setCurrentAttempt(null);
      }
    },
    [applyAttemptDetail],
  );

  // Hàm tải lộ trình ngày và gom nhóm bài tập Speaking theo Ngày (DAY 1, DAY 2, DAY 3...)
  const fetchDailyPlansAndSpeaking = useCallback(
    async (classId: string, isMounted: boolean = true) => {
      try {
        // 1. Tải lộ trình Daily Plan của lớp học
        const [rawDailyPlans, overviewRes, classAsgs] = await Promise.all([
          studentApi.getClassDailyPlans(classId).catch(() => []),
          studentApi.getDailyHomeworkOverview(classId).catch(() => null),
          studentApi.getClassAssignments(classId).catch(() => []),
        ]);

        const daysSummaryList = overviewRes?.days || [];
        const todayDate = new Date().toISOString().slice(0, 10);

        // Map lưu trữ các Ngày cùng danh sách bài tập Speaking của ngày đó
        const daysMap = new Map<string, DaySpeakingGroup>();

        // 2. Duyệt qua rawDailyPlans để lấy cấu trúc từng Ngày (Day 1, Day 2...)
        rawDailyPlans.forEach((plan: any) => {
          const dayNum = plan.dayNumber ?? 1;
          const planKey = plan.id || `day-${dayNum}`;
          const titleClean = plan.title || `DAY ${dayNum}`;
          const dateStr = plan.scheduledDate || "";
          const isToday =
            dateStr === todayDate ||
            daysSummaryList.find((d) => d.id === plan.id)?.isCurrentDay ||
            false;

          const tasksForThisDay: SpeakingAssignmentItem[] = [];

          // Trích xuất các items của Day
          const items = Array.isArray(plan.items) ? plan.items : [];
          items.forEach((item: any) => {
            const type = (item.itemType || "").toUpperCase();
            const titleLower = (item.title || "").toLowerCase();
            const secLower = (item.sectionName || "").toLowerCase();
            const descLower = (item.assignment?.description || "").toLowerCase();

            const isShadow =
              titleLower.includes("shadow") ||
              titleLower.includes("nhại") ||
              secLower.includes("shadow") ||
              descLower.includes("shadow") ||
              descLower.includes("nhại");
            // Chỉ nhận bài thực sự thuộc kỹ năng Speaking (theo skillType / loại mục),
            // không đoán theo từ khóa trong mô tả để tránh nhận nhầm bài từ vựng, đọc...
            const itemAsgId = item.assignment?.id || item.assignmentId;
            const asgSkill = (
              item.assignment?.skillType ||
              item.skillType ||
              classAsgs.find((a: any) => a.id === itemAsgId)?.skillType ||
              ""
            ).toUpperCase();
            const isSpeak =
              asgSkill === "SPEAKING" ||
              (!asgSkill && (type === "SPEAKING" || type === "PRONUNCIATION"));

            const asgId =
              item.assignment?.id ||
              item.assignmentId ||
              (item.assignment ? item.assignment.id : null);

            // Đồng bộ với trang Lộ trình: chỉ tính bài nằm trong nhóm Kỹ năng Speaking
            const inSpeakingGroup = detectItemCategory(item.itemType, item.sectionName || "") === "SPEAKING";

            if (isSpeak && inSpeakingGroup && asgId) {
              if (!tasksForThisDay.some((t) => t.id === asgId)) {
                tasksForThisDay.push({
                  id: asgId,
                  title: item.title,
                  isShadowing: isShadow,
                  description: item.assignment?.description,
                  dueDate: dateStr,
                  isCompleted: false,
                  attemptsCount: 0,
                });
              }
            }
          });

          daysMap.set(planKey, {
            id: plan.id,
            dayNumber: dayNum,
            title: titleClean,
            scheduledDate: dateStr,
            isCompleted: false,
            isCurrentDay: isToday,
            speakingTasks: tasksForThisDay,
          });
        });

        // 3. Chỉ dùng bài trong Daily Plan (đồng bộ với trang Lộ trình), không gán thêm bài lớp ngoài kế hoạch.

        // 4. Lấy danh sách các Ngày và đồng bộ trạng thái thực tế từ classAsgs (đã fetch sẵn ở Bước 1)
        // LOẠI BỎ HOÀN TOÀN vòng lặp tuần tự N+1 gọi getMyAttempts() gây nghẽn 5s trên mạng ngrok!
        const daysArray = Array.from(daysMap.values()).sort(
          (a, b) => a.dayNumber - b.dayNumber,
        );

        const asgsMap = new Map<string, any>(
          (Array.isArray(classAsgs) ? classAsgs : []).map((a: any) => [a.id, a]),
        );

        for (const day of daysArray) {
          for (let i = 0; i < day.speakingTasks.length; i++) {
            const task = day.speakingTasks[i];
            const asgInfo = asgsMap.get(task.id);
            if (asgInfo) {
              const isComp = asgInfo.attemptsCount > 0 && asgInfo.status === "COMPLETED";
              const bestScore =
                asgInfo.highestScore > 0
                  ? normalizeScoreTo100(asgInfo.highestScore)
                  : null;
              day.speakingTasks[i] = {
                ...task,
                isCompleted: isComp,
                highestScore: bestScore,
                attemptsCount: asgInfo.attemptsCount || 0,
              };
            }
          }
          day.isCompleted =
            day.speakingTasks.length > 0 &&
            day.speakingTasks.every((t) => t.isCompleted);
        }

        const validDays = daysArray.filter((d) => d.speakingTasks.length > 0);
        const displayDays = validDays.length > 0 ? validDays : daysArray;

        if (!isMounted) return;
        setDaysList(displayDays);

        let activeDay = displayDays.find((d) => d.isCurrentDay) || displayDays[0];

        if (routeAssignmentId) {
          const foundDay = displayDays.find((d) =>
            d.speakingTasks.some((t) => t.id === routeAssignmentId),
          );
          if (foundDay) activeDay = foundDay;
        }

        if (activeDay) {
          setSelectedDayId(activeDay.id);

          let activeAsgId: string | null = routeAssignmentId || null;
          if (!activeAsgId || !activeDay.speakingTasks.some((t) => t.id === activeAsgId)) {
            activeAsgId = activeDay.speakingTasks[0]?.id || null;
          }

          setSelectedAssignmentId(activeAsgId);

          if (activeAsgId) {
            await selectAndLoadAssignment(activeAsgId, routeAttemptId);
          } else {
            setCurrentAttempt(null);
            setAttempts([]);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải lộ trình Daily Plan:", err);
      }
    },
    [routeAssignmentId, routeAttemptId, selectAndLoadAssignment],
  );

  // 1. Tải danh sách khóa học và các Ngày học
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      setLoading(true);
      try {
        const myCourses = await studentApi.getMyCourses().catch(() => []);
        if (!isMounted) return;
        setCourses(myCourses);

        if (myCourses.length === 0) {
          setLoading(false);
          return;
        }

        const classId = myCourses[0].classId;
        setSelectedClassId(classId);

        await fetchDailyPlansAndSpeaking(classId, isMounted);
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu bài tập Speaking:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [fetchDailyPlansAndSpeaking]);

  // Chuyển Ngày
  const handleSelectDay = async (dayGroup: DaySpeakingGroup) => {
    if (dayGroup.id === selectedDayId) return;
    setSelectedDayId(dayGroup.id);
    setActionMessage(null);
    setErrorMessage(null);

    const firstTask = dayGroup.speakingTasks[0];
    if (firstTask) {
      setSelectedAssignmentId(firstTask.id);
      setSwitching(true);
      try {
        await selectAndLoadAssignment(firstTask.id);
      } finally {
        setSwitching(false);
      }
    } else {
      setSelectedAssignmentId(null);
      setCurrentAttempt(null);
      setAttempts([]);
    }
  };

  // Chuyển bài tập
  const handleSelectAssignment = async (asgId: string) => {
    if (asgId === selectedAssignmentId || switching) return;
    setSwitching(true);
    setSelectedAssignmentId(asgId);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      await selectAndLoadAssignment(asgId);
    } finally {
      setSwitching(false);
    }
  };

  // Chọn 1 attempt từ lịch sử
  const handleSelectAttempt = async (attempt: AttemptResponse) => {
    if (switching || attempt.attemptId === currentAttempt?.attemptId) return;
    setSwitching(true);
    try {
      const detail = await studentApi.getAttemptDetail(attempt.attemptId);
      applyAttemptDetail(detail);
    } catch {
      applyAttemptDetail(attempt);
    } finally {
      setSwitching(false);
    }
  };

  // Luyện tập lại bài tập (Theo cấu hình phạm vi sai & số lần của giáo viên)
  const handleStartNewAttempt = async () => {
    if (!selectedAssignmentId || switching) return;

    const sampleAttempt = currentAttempt || attempts[0];
    const maxAllowedError = sampleAttempt?.maxAllowedErrorPercent != null
      ? sampleAttempt.maxAllowedErrorPercent
      : (sampleAttempt?.passScore != null ? Math.max(0, 100 - (sampleAttempt.passScore <= 10 ? sampleAttempt.passScore * 10 : sampleAttempt.passScore)) : 20);
    const passThresholdScore = 100 - maxAllowedError;
    const maxAttemptsCount = sampleAttempt?.maxAttempts != null && sampleAttempt.maxAttempts > 0 ? sampleAttempt.maxAttempts : 3;

    const getScore = (att: AttemptResponse) =>
      normalizeScoreTo100(att.score ?? att.totalScore ?? 0);
    const completedAttempts = attempts.filter((a) => a.status !== "IN_PROGRESS");
    const highestScore = completedAttempts.reduce(
      (max, a) => Math.max(max, getScore(a)),
      0,
    );

    // 1. Nếu bài đã đạt chuẩn -> Không cho làm lại nữa
    if (highestScore >= passThresholdScore) {
      setErrorMessage(
        `Bài tập này đã ĐẠT CHUẨN (${highestScore.toFixed(1)}/100 điểm ≥ chuẩn ${passThresholdScore} điểm, phạm vi sai ≤ ${maxAllowedError}%). Theo quy định, bạn không được làm lại bài đã đạt!`,
      );
      return;
    }

    // 2. Chỉ cho phép làm tối đa maxAttemptsCount lần nếu điểm dưới chuẩn
    if (completedAttempts.length >= maxAttemptsCount) {
      setErrorMessage(
        `Bạn đã thực hiện đủ ${maxAttemptsCount} lần làm bài nhưng điểm số chưa đạt chuẩn (${highestScore.toFixed(1)} < ${passThresholdScore} điểm). Kết quả chính thức: NOT PASS (Không đạt) và không thể thử lại.`,
      );
      return;
    }

    setSwitching(true);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      const newAttempt = await studentApi.startAssignment(selectedAssignmentId);
      const detail = await studentApi.getAttemptDetail(newAttempt.attemptId);
      setAttempts((prev) => [detail, ...prev]);
      applyAttemptDetail(detail);
      setActionMessage(
        `Bắt đầu lượt làm bài #${completedAttempts.length + 1}/${maxAttemptsCount}. Hãy hoàn thành các câu chưa đạt để đạt trên ${passThresholdScore} điểm!`,
      );
    } catch (err: any) {
      setErrorMessage(
        "Không thể bắt đầu lượt mới: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setSwitching(false);
    }
  };

  // Thông tin bài tập / câu hỏi hiện tại
  const questions = currentAttempt?.questions || [];
  const currentQ = questions[selectedQuestionIndex];
  const isSubmitted = !!currentAttempt && currentAttempt.status !== "IN_PROGRESS";
  const currentSelectedDay = daysList.find((d) => d.id === selectedDayId);
  const selectedAsgMeta = currentSelectedDay?.speakingTasks.find(
    (a) => a.id === selectedAssignmentId,
  );

  const isShadowingMode = useMemo(() => {
    const attemptTitleLower = (
      currentAttempt?.assignmentTitle ||
      selectedAsgMeta?.title ||
      ""
    ).toLowerCase();
    const attemptDescLower = (
      (currentAttempt as any)?.assignmentDescription ||
      selectedAsgMeta?.description ||
      ""
    ).toLowerCase();
    const currentPromptLower = (currentQ?.promptText || "").toLowerCase();

    return (
      !!selectedAsgMeta?.isShadowing ||
      attemptTitleLower.includes("shadow") ||
      attemptTitleLower.includes("nhại") ||
      attemptDescLower.includes("shadow") ||
      attemptDescLower.includes("nhại") ||
      currentPromptLower.includes("shadowing") ||
      currentPromptLower.includes("repeat after") ||
      currentPromptLower.includes("nhại lại") ||
      currentPromptLower.includes("đọc to câu") ||
      currentPromptLower.includes("phát âm câu") ||
      Boolean(
        currentQ &&
          currentQ.correctAnswer &&
          !isGradingRubricOrMetaText(currentQ.correctAnswer) &&
          currentQ.promptText &&
          currentQ.promptText.trim() === currentQ.correctAnswer.trim(),
      )
    );
  }, [currentAttempt, selectedAsgMeta, currentQ]);

  // Upload file ghi âm lên R2
  const ensureStudentAnswerAudioUploaded = useCallback(
    async (targetBlob: Blob): Promise<AttemptResponse | null> => {
      if (!currentAttempt || !currentQ) return null;
      try {
        const updatedAttempt = await studentApi.uploadSpeakingAudio(
          currentAttempt.attemptId,
          currentQ.questionId,
          targetBlob,
        );
        setCurrentAttempt(updatedAttempt);
        return updatedAttempt;
      } catch (err) {
        console.warn("Lỗi upload audio lên R2:", err);
        return null;
      }
    },
    [currentAttempt, currentQ],
  );

  // Chấm điểm AI Speaking Q&A (IELTS Rubrics)
  const handleTriggerAiEvaluation = useCallback(
    async (activeAudioBlob: Blob | null, activeAudioUrl: string | null) => {
      if (!currentAttempt || !currentQ) return;
      setIsEvaluating(true);
      setShadowingReport(null);
      setActionMessage(null);
      setErrorMessage(null);

      try {
        let finalAudioBlob = activeAudioBlob;

        if (!finalAudioBlob && activeAudioUrl && activeAudioUrl.startsWith("http")) {
          try {
            const res = await fetch(activeAudioUrl);
            if (res.ok) finalAudioBlob = await res.blob();
          } catch {}
        }

        if (!finalAudioBlob) {
          alert("Vui lòng ghi âm câu trả lời trước khi chấm điểm AI.");
          setIsEvaluating(false);
          return;
        }

        let targetAnswerId = (currentQ as any)?.studentAnswerId;
        if (!targetAnswerId && activeAudioBlob) {
          const freshDetail = await ensureStudentAnswerAudioUploaded(finalAudioBlob);
          const freshQ = freshDetail?.questions?.find(
            (q) => q.questionId === currentQ.questionId,
          );
          targetAnswerId = (freshQ as any)?.studentAnswerId;
        }

        const cleanFile = new File([finalAudioBlob], "speaking_qa.webm", {
          type: finalAudioBlob.type || "audio/webm",
        });

        const topicText =
          currentQ.promptText || currentAttempt.assignmentTitle || "Speaking Topic";
        const result = await studentApi.evaluateSpeakingAI(
          topicText,
          cleanFile,
          targetAnswerId || "",
        );

        setAiReport(result as FullSpeakingAiResult);
        setReportQuestionId(currentQ.questionId);
        setActionMessage("AI đã hoàn thành đánh giá bài nói phỏng vấn của bạn!");
      } catch (err: any) {
        setErrorMessage(
          `Đánh giá Speaking thất bại: ${err.response?.data?.message || err.message}`,
        );
      } finally {
        setIsEvaluating(false);
      }
    },
    [currentAttempt, currentQ, ensureStudentAnswerAudioUploaded],
  );

  // Nộp bài hoàn thành
  const handleSubmitAssignment = useCallback(
    async (activeAudioBlob: Blob | null, activeAudioUrl: string | null) => {
      if (!currentAttempt || !selectedAssignmentId || isSubmitted) return;

      if (!activeAudioUrl && !activeAudioBlob) {
        const confirmSubmit = window.confirm(
          "Bạn chưa ghi âm câu trả lời cho bài tập này. Bạn có chắc chắn muốn nộp bài không?",
        );
        if (!confirmSubmit) return;
      }

      setIsSubmitting(true);
      try {
        if (activeAudioBlob && currentQ) {
          await ensureStudentAnswerAudioUploaded(activeAudioBlob);
        }

        const answerPayload = questions.map((q) => ({
          questionId: q.questionId,
          textAnswer: isShadowingMode ? "SHADOWING_COMPLETED" : "SPEAKING_ANSWERED",
        }));

        const submittedAttempt = await studentApi.submitAssignment(
          selectedAssignmentId,
          currentAttempt.attemptId,
          answerPayload,
        );

        const detail = await studentApi.getAttemptDetail(
          submittedAttempt.attemptId || currentAttempt.attemptId,
        );
        applyAttemptDetail(detail);

        setDaysList((prevDays) =>
          prevDays.map((day) => ({
            ...day,
            speakingTasks: day.speakingTasks.map((item) =>
              item.id === selectedAssignmentId
                ? {
                    ...item,
                    isCompleted: true,
                    highestScore: detail.score ?? item.highestScore,
                    attemptsCount: item.attemptsCount + 1,
                  }
                : item,
            ),
          })),
        );

        setAttempts((prev) => [
          detail,
          ...prev.filter((a) => a.attemptId !== detail.attemptId),
        ]);

        setActionMessage("Chúc mừng bạn đã hoàn thành và nộp bài Speaking thành công!");
      } catch (err: any) {
        alert("Nộp bài thất bại: " + (err.response?.data?.message || err.message));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      currentAttempt,
      selectedAssignmentId,
      isSubmitted,
      currentQ,
      ensureStudentAnswerAudioUploaded,
      questions,
      isShadowingMode,
      applyAttemptDetail,
    ],
  );

  return {
    courses,
    setCourses,
    selectedClassId,
    setSelectedClassId,
    daysList,
    setDaysList,
    selectedDayId,
    setSelectedDayId,
    selectedAssignmentId,
    setSelectedAssignmentId,
    attempts,
    setAttempts,
    currentAttempt,
    setCurrentAttempt,
    selectedQuestionIndex,
    setSelectedQuestionIndex,
    aiReport,
    setAiReport,
    shadowingReport,
    setShadowingReport,
    reportQuestionId,
    setReportQuestionId,
    loading,
    switching,
    isEvaluating,
    isSubmitting,
    actionMessage,
    setActionMessage,
    errorMessage,
    setErrorMessage,
    questions,
    currentQ,
    currentSelectedDay,
    isShadowingMode,
    isSubmitted,
    fetchDailyPlansAndSpeaking,
    selectAndLoadAssignment,
    applyAttemptDetail,
    extractAndSetAiReportForQuestion,
    handleSelectDay,
    handleSelectAssignment,
    handleSelectAttempt,
    handleStartNewAttempt,
    ensureStudentAnswerAudioUploaded,
    handleTriggerAiEvaluation,
    handleSubmitAssignment,
  };
}
