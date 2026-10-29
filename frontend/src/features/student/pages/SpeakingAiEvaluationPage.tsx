// src/features/student/pages/SpeakingAiEvaluationPage.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "@/features/student/api/studentApi";
import ShadowingEvaluationView from "@/features/student/components/ShadowingEvaluationView";
import SpeakingShadowingStudio, { cleanShadowingSentence } from "@/features/student/components/SpeakingShadowingStudio";
import {
  extractReferenceSentence,
  isGradingRubricOrMetaText,
  isInvalidSampleAudioUrl,
  isMockOrBrokenAudioUrl,
  playSampleAudio,
  resolveFullAudioUrl,
  stopAllSampleAudio,
} from "@/utils/sampleAudioPlayer";
import type {
  AttemptResponse,
  SpeakingAiEvaluationResult,
  ShadowingEvaluationResponse,
  MyCourseResponse,
} from "@/features/student/types";
import {
  Sparkles,
  Volume2,
  Clock,
  ArrowLeft,
  Loader2,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Mic,
  Square,
  Upload,
  Check,
  Target,
  AlertOctagon,
  AlertCircle,
  Zap,
  Headphones,
  MessageSquare,
  ArrowRight,
  RotateCcw,
  Calendar,
  Play,
  Pause,
  Award,
  GraduationCap,
  BookOpen,
  ChevronDown,
  ChevronUp,
  UserCheck,
} from "lucide-react";

type FullSpeakingAiResult = SpeakingAiEvaluationResult & {
  isOffTopic?: boolean;
  taskAchievement?: {
    score?: number;
    addressedPoints?: string[];
    missingPoints?: string[];
  };
};

export interface SpeakingAssignmentItem {
  id: string; // assignmentId
  title: string;
  isShadowing: boolean;
  description?: string;
  dueDate?: string;
  isCompleted: boolean;
  highestScore?: number | null;
  attemptsCount: number;
}

export interface DaySpeakingGroup {
  id: string; // planId
  dayNumber: number; // 1, 2, 3, 4...
  title: string; // "DAY 1", "Ngày 1"...
  scheduledDate?: string;
  isCompleted: boolean;
  isCurrentDay: boolean;
  speakingTasks: SpeakingAssignmentItem[];
}

export default function SpeakingAiEvaluationPage() {
  const { assignmentId: routeAssignmentId, attemptId: routeAttemptId } =
    useParams<{
      assignmentId?: string;
      attemptId?: string;
    }>();
  const navigate = useNavigate();

  // Khóa học & Lớp học
  const [courses, setCourses] = useState<MyCourseResponse[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Danh sách các Ngày (Day 1, Day 2, Day 3...) có bài Speaking
  const [daysList, setDaysList] = useState<DaySpeakingGroup[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Bài tập Speaking đang chọn
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  // Lần nộp bài của bài tập đang chọn
  const [attempts, setAttempts] = useState<AttemptResponse[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<AttemptResponse | null>(
    null,
  );
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  // Báo cáo AI cho câu hỏi đang chọn
  const [aiReport, setAiReport] = useState<FullSpeakingAiResult | null>(null);
  const [shadowingReport, setShadowingReport] =
    useState<ShadowingEvaluationResponse | null>(null);
  const [reportQuestionId, setReportQuestionId] = useState<string | null>(null);

  // Trạng thái thao tác
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);

  // Âm thanh của học sinh
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [activeAudioBlob, setActiveAudioBlob] = useState<Blob | null>(null);

  // Thu âm trực tiếp
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const recordingDurationRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Phát câu mẫu Text-to-speech (Kokoro-82M Neural Audio / Web Speech English Fallback)
  const [isPlayingRefTts, setIsPlayingRefTts] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>("af_heart");
  const [isSynthesizingTts, setIsSynthesizingTts] = useState<boolean>(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Phát lại bản thu âm của học viên (tách biệt 100% với state câu mẫu)
  const [isPlayingStudentRec, setIsPlayingStudentRec] = useState(false);
  const studentPlaybackAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (studentPlaybackAudioRef.current) {
        studentPlaybackAudioRef.current.pause();
      }
      stopAllSampleAudio();
    };
  }, []);

  // 1. Tải danh sách khóa học và các Ngày học (Daily Plan)
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
  }, [routeAssignmentId, routeAttemptId]);

  // Hàm tải lộ trình ngày và gom nhóm bài tập Speaking theo Ngày (DAY 1, DAY 2, DAY 3...)
  const fetchDailyPlansAndSpeaking = async (
    classId: string,
    isMounted: boolean = true,
  ) => {
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
          const isSpeak =
            type === "SPEAKING" ||
            titleLower.includes("speak") ||
            titleLower.includes("nói") ||
            secLower.includes("speak") ||
            secLower.includes("nói") ||
            descLower.includes("speaking") ||
            isShadow;

          const asgId =
            item.assignment?.id ||
            item.assignmentId ||
            (item.assignment ? item.assignment.id : null);

          if (isSpeak && asgId) {
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

      // 3. Nếu có bài tập lớp chưa được gắn vào Daily Plan nhưng có tiêu đề hoặc dueDate gắn theo Ngày
      classAsgs.forEach((asg: any) => {
        const skill = (asg.skillType || "").toUpperCase();
        const titleLower = (asg.title || "").toLowerCase();
        const descLower = (asg.description || "").toLowerCase();
        const isShadow =
          titleLower.includes("shadow") ||
          titleLower.includes("nhại") ||
          descLower.includes("shadow") ||
          descLower.includes("nhại");
        const isSpeak =
          skill === "SPEAKING" ||
          titleLower.includes("speak") ||
          titleLower.includes("nói") ||
          descLower.includes("speaking") ||
          isShadow;

        if (!isSpeak) return;

        // Kiểm tra xem bài này đã thuộc Ngày nào chưa
        let alreadyPlaced = false;
        for (const day of daysMap.values()) {
          if (day.speakingTasks.some((t) => t.id === asg.id)) {
            alreadyPlaced = true;
            break;
          }
        }

        if (!alreadyPlaced) {
          // Thử ghép vào Ngày theo dueDate hoặc tên ngày trong tiêu đề (VD: Day 2026-10-05)
          let matchedDayKey: string | null = null;
          for (const [key, day] of daysMap.entries()) {
            if (
              day.scheduledDate &&
              (titleLower.includes(day.scheduledDate) ||
                asg.dueDate?.includes(day.scheduledDate))
            ) {
              matchedDayKey = key;
              break;
            }
          }

          if (matchedDayKey) {
            daysMap.get(matchedDayKey)!.speakingTasks.push({
              id: asg.id,
              title: asg.title,
              isShadowing: isShadow,
              description: asg.description,
              dueDate: asg.dueDate,
              isCompleted: false,
              attemptsCount: 0,
            });
          } else {
            // Đưa vào ngày đầu tiên hoặc tạo Ngày bổ sung
            const firstDay = daysMap.values().next().value;
            if (firstDay) {
              firstDay.speakingTasks.push({
                id: asg.id,
                title: asg.title,
                isShadowing: isShadow,
                description: asg.description,
                dueDate: asg.dueDate,
                isCompleted: false,
                attemptsCount: 0,
              });
            }
          }
        }
      });

      // 4. Lấy danh sách các Ngày và đồng bộ trạng thái thực tế từ backend (Attempts)
      const daysArray = Array.from(daysMap.values()).sort(
        (a, b) => a.dayNumber - b.dayNumber,
      );

      // Đồng bộ trạng thái bài nộp của học sinh
      for (const day of daysArray) {
        for (let i = 0; i < day.speakingTasks.length; i++) {
          const task = day.speakingTasks[i];
          try {
            const userAttempts = await studentApi.getMyAttempts(task.id);
            const completedAttempt = userAttempts.find(
              (att) => att.status !== "IN_PROGRESS",
            );
            day.speakingTasks[i] = {
              ...task,
              isCompleted: !!completedAttempt,
              highestScore: completedAttempt?.score ?? null,
              attemptsCount: userAttempts.length,
            };
          } catch {}
        }
        day.isCompleted =
          day.speakingTasks.length > 0 &&
          day.speakingTasks.every((t) => t.isCompleted);
      }

      // Lọc các Ngày (chỉ giữ các ngày có bài tập Speaking hoặc hiển thị tất cả các ngày)
      const validDays = daysArray.filter((d) => d.speakingTasks.length > 0);
      const displayDays = validDays.length > 0 ? validDays : daysArray;

      if (!isMounted) return;
      setDaysList(displayDays);

      // Xác định Ngày đang chọn
      let activeDay = displayDays.find((d) => d.isCurrentDay) || displayDays[0];

      // Nếu có routeAssignmentId, tìm ngày chứa bài tập đó
      if (routeAssignmentId) {
        const foundDay = displayDays.find((d) =>
          d.speakingTasks.some((t) => t.id === routeAssignmentId),
        );
        if (foundDay) activeDay = foundDay;
      }

      if (activeDay) {
        setSelectedDayId(activeDay.id);

        // Xác định bài tập active trong Ngày
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
  };

  // Áp dụng chi tiết một attempt vào state và tự động trích xuất đánh giá AI
  const applyAttemptDetail = (detail: AttemptResponse) => {
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
  };

  // Trích xuất báo cáo AI cho 1 câu hỏi cụ thể
  const extractAndSetAiReportForQuestion = (
    q: any,
    attempt: AttemptResponse | null,
  ) => {
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
  };

  // Tải chi tiết bài tập & khởi tạo attempt nếu chưa có
  const selectAndLoadAssignment = async (
    asgId: string,
    targetAttemptId?: string,
  ) => {
    try {
      const rawList = await studentApi.getMyAttempts(asgId).catch(() => []);
      const byNewest = (a: AttemptResponse, b: AttemptResponse) =>
        (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0);
      const sortedAttempts = [...rawList].sort(byNewest);

      if (sortedAttempts.length > 0) {
        setAttempts(sortedAttempts);

        let target = sortedAttempts.find((a) => a.attemptId === targetAttemptId);
        if (!target) {
          target =
            sortedAttempts.find((a) => a.status !== "IN_PROGRESS") ||
            sortedAttempts[0];
        }

        const detail = await studentApi
          .getAttemptDetail(target.attemptId)
          .catch(() => target);
        applyAttemptDetail(detail);
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
  };

  // Chuyển Ngày khi học sinh bấm vào Ngày 1, Ngày 2, Ngày 3...
  const handleSelectDay = async (dayGroup: DaySpeakingGroup) => {
    if (dayGroup.id === selectedDayId) return;
    setSelectedDayId(dayGroup.id);
    setActionMessage(null);
    setErrorMessage(null);

    // Chọn bài tập đầu tiên của Ngày đó
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

  // Chuyển bài tập khi học sinh bấm vào bài khác trong cùng một Ngày
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

  // Luyện tập lại bài tập (Bắt đầu lượt nộp mới)
  const handleStartNewAttempt = async () => {
    if (!selectedAssignmentId || switching) return;
    setSwitching(true);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      const newAttempt = await studentApi.startAssignment(selectedAssignmentId);
      const detail = await studentApi.getAttemptDetail(newAttempt.attemptId);
      setAttempts((prev) => [detail, ...prev]);
      applyAttemptDetail(detail);
      setActionMessage("Đã bắt đầu lượt làm mới. Bạn có thể ghi âm câu trả lời.");
    } catch (err: any) {
      setErrorMessage("Không thể bắt đầu lượt mới: " + (err.response?.data?.message || err.message));
    } finally {
      setSwitching(false);
    }
  };

  // Câu hỏi hiện tại
  const questions = currentAttempt?.questions || [];
  const currentQ = questions[selectedQuestionIndex];
  const isSubmitted = !!currentAttempt && currentAttempt.status !== "IN_PROGRESS";

  // Ngày hiện tại đang chọn
  const currentSelectedDay = daysList.find((d) => d.id === selectedDayId);
  const selectedAsgMeta = currentSelectedDay?.speakingTasks.find(
    (a) => a.id === selectedAssignmentId,
  );
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

  const isShadowingMode =
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
    );

  // Dừng mọi âm thanh cũ và cập nhật âm thanh khi chuyển câu hỏi / lượt nộp
  useEffect(() => {
    stopAllSampleAudio();
    setIsPlayingRefTts(false);
    setIsSynthesizingTts(false);
    if (studentPlaybackAudioRef.current) {
      studentPlaybackAudioRef.current.pause();
      studentPlaybackAudioRef.current.currentTime = 0;
    }
    setIsPlayingStudentRec(false);
    setActiveAudioBlob(null);

    if (!currentQ) {
      setActiveAudioUrl(null);
      return;
    }

    const rawStudentUrl =
      (currentQ as any)?.audioUrl ||
      (currentQ?.studentAnswer &&
      (currentQ.studentAnswer.startsWith("http") ||
        currentQ.studentAnswer.startsWith("blob:") ||
        currentQ.studentAnswer.startsWith("/uploads/"))
        ? currentQ.studentAnswer
        : null);

    if (rawStudentUrl && !isMockOrBrokenAudioUrl(rawStudentUrl)) {
      setActiveAudioUrl(resolveFullAudioUrl(rawStudentUrl));
    } else {
      setActiveAudioUrl(null);
    }

    extractAndSetAiReportForQuestion(currentQ, currentAttempt);
  }, [selectedQuestionIndex, currentAttempt?.attemptId, currentQ?.questionId]);

  // Nút 1: Điều khiển phát câu mẫu chuẩn (Sample Audio / Reference Sentence)
  // Tuyệt đối tách biệt với nguồn âm thanh bài thu của học viên
  const handlePlayTtsPrompt = async (textToRead?: string) => {
    if (isPlayingRefTts) {
      stopAllSampleAudio();
      setIsPlayingRefTts(false);
      return;
    }

    // Dừng phát bản thu của học viên nếu đang bật
    if (studentPlaybackAudioRef.current && isPlayingStudentRec) {
      studentPlaybackAudioRef.current.pause();
      setIsPlayingStudentRec(false);
    }

    const sampleText =
      cleanShadowingSentence(textToRead?.trim() || "") ||
      extractReferenceSentence(currentQ);
    if (!sampleText) return;

    const studentUrl = activeAudioUrl || currentQ?.audioUrl || null;
    const validMediaUrl =
      selectedVoice === "af_heart" &&
      currentQ?.mediaUrl &&
      !isInvalidSampleAudioUrl(currentQ.mediaUrl, studentUrl)
        ? currentQ.mediaUrl
        : undefined;

    setIsSynthesizingTts(true);
    try {
      await playSampleAudio(sampleText, {
        audioUrl: validMediaUrl,
        voice: selectedVoice,
        lang: selectedVoice.startsWith("b") ? "en-GB" : "en-US",
        rate: ttsSpeed,
        studentAudioUrl: studentUrl,
        onStart: () => {
          setIsSynthesizingTts(false);
          setIsPlayingRefTts(true);
        },
        onEnd: () => {
          setIsSynthesizingTts(false);
          setIsPlayingRefTts(false);
        },
        onError: () => {
          setIsSynthesizingTts(false);
          setIsPlayingRefTts(false);
        },
      });
    } finally {
      setIsSynthesizingTts(false);
    }
  };

  // Nút 2: Điều khiển phát lại bản thu âm của học viên (Submission User Audio)
  // Tuyệt đối không dùng chung state hay gọi nhầm sang câu mẫu
  const handleTogglePlayStudentAudio = () => {
    if (!activeAudioUrl || isMockOrBrokenAudioUrl(activeAudioUrl)) return;

    if (isPlayingStudentRec && studentPlaybackAudioRef.current) {
      studentPlaybackAudioRef.current.pause();
      setIsPlayingStudentRec(false);
      return;
    }

    // Dừng phát câu mẫu nếu đang bật
    if (isPlayingRefTts) {
      stopAllSampleAudio();
      setIsPlayingRefTts(false);
    }

    if (!studentPlaybackAudioRef.current) {
      studentPlaybackAudioRef.current = new Audio(activeAudioUrl);
    } else if (studentPlaybackAudioRef.current.src !== activeAudioUrl) {
      studentPlaybackAudioRef.current.pause();
      studentPlaybackAudioRef.current.src = activeAudioUrl;
    }

    studentPlaybackAudioRef.current.onended = () => setIsPlayingStudentRec(false);
    studentPlaybackAudioRef.current.onerror = () => setIsPlayingStudentRec(false);
    studentPlaybackAudioRef.current
      .play()
      .then(() => setIsPlayingStudentRec(true))
      .catch(() => setIsPlayingStudentRec(false));
  };

  // Bắt đầu thu âm
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const finalType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        setActiveAudioBlob(blob);
        setActiveAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());

        const duration = (Date.now() - startTimeRef.current) / 1000;
        recordingDurationRef.current = duration;
      };

      startTimeRef.current = Date.now();
      recordingDurationRef.current = 0;
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      alert("Không thể truy cập Microphone. Vui lòng cấp quyền micro cho trình duyệt.");
    }
  };

  // Dừng thu âm
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Upload file âm thanh ghi sẵn
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setActiveAudioBlob(file);
      setActiveAudioUrl(URL.createObjectURL(file));
      recordingDurationRef.current = 10;
    }
  };

  // Đảm bảo âm thanh được upload lên backend R2 để tạo StudentAnswer
  const ensureStudentAnswerAudioUploaded = async (
    targetBlob: Blob,
  ): Promise<AttemptResponse | null> => {
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
  };

  // Đánh giá AI Speaking Q&A (IELTS Rubrics)
  const handleTriggerAiEvaluation = async () => {
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

      const topicText = currentQ.promptText || currentAttempt.assignmentTitle || "Speaking Topic";
      const result = await studentApi.evaluateSpeakingAI(
        topicText,
        cleanFile,
        targetAnswerId || "",
      );

      setAiReport(result as FullSpeakingAiResult);
      setReportQuestionId(currentQ.questionId);
      setActionMessage("AI đã hoàn thành đánh giá bài nói phỏng vấn của bạn!");
    } catch (err: any) {
      setErrorMessage(`Đánh giá Speaking thất bại: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Đánh giá AI Shadowing (<2s)
  const handleTriggerShadowingEvaluation = async () => {
    if (!currentAttempt || !currentQ) return;

    try {
      let finalAudioBlob = activeAudioBlob;

      if (!finalAudioBlob && activeAudioUrl && activeAudioUrl.startsWith("http")) {
        try {
          const res = await fetch(activeAudioUrl);
          if (res.ok) finalAudioBlob = await res.blob();
        } catch {}
      }

      if (!finalAudioBlob) {
        alert("Vui lòng ghi âm câu nhại giọng trước khi bấm chấm điểm AI.");
        return;
      }

      // Pre-validation 1: Audio duration (>= 1.5s)
      if (recordingDurationRef.current > 0 && recordingDurationRef.current < 1.5) {
        alert("Bản ghi âm quá ngắn (dưới 1.5 giây). Vui lòng phát âm rõ ràng và thu âm lại.");
        return;
      }

      // Pre-validation 2: Reference text
      const referenceSentence = cleanShadowingSentence(
        currentQ.correctAnswer || currentQ.promptText || ""
      );
      if (!referenceSentence || !referenceSentence.trim()) {
        alert("Không tìm thấy câu đối chiếu chuẩn (Reference Text) cho bài tập nhại giọng này.");
        return;
      }

      setIsEvaluating(true);
      setAiReport(null);
      setActionMessage("AI đang phân tích âm học Praat F1/F2...");

      let targetAnswerId = (currentQ as any)?.studentAnswerId;
      if (!targetAnswerId && activeAudioBlob) {
        const freshDetail = await ensureStudentAnswerAudioUploaded(finalAudioBlob);
        const freshQ = freshDetail?.questions?.find(
          (q) => q.questionId === currentQ.questionId,
        );
        targetAnswerId = (freshQ as any)?.studentAnswerId;
      }

      const filename = finalAudioBlob.type.includes("wav") ? "shadowing.wav" : "shadowing.webm";
      const cleanFile = new File([finalAudioBlob], filename, {
        type: finalAudioBlob.type || "audio/webm",
      });

      const result = await studentApi.evaluateShadowingAI(
        cleanFile,
        targetAnswerId || "",
        referenceSentence,
      );

      setShadowingReport(result);
      setReportQuestionId(currentQ.questionId);
      setActionMessage("AI đã chấm xong bài Shadowing với điểm phát âm chi tiết!");
    } catch (err: any) {
      setErrorMessage(`Đánh giá Shadowing thất bại: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Nộp bài hoàn thành (Submit Assignment)
  const handleSubmitAssignment = async () => {
    if (!currentAttempt || !selectedAssignmentId) return;
    if (isSubmitted) return;

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

      // Cập nhật trạng thái trong daysList
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
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500 font-medium gap-3">
        <Loader2 className="animate-spin text-blue-700" size={36} />
        <span className="text-sm font-semibold">
          Đang tải lộ trình Daily Plan và bài tập Speaking...
        </span>
      </div>
    );
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="elp-page max-w-[1400px] mx-auto space-y-6 pb-16 font-sans">
      {/* 1. CLEAN OPEN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate("/student/courses")}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-slate-900/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50 mb-2">
              <Mic size={14} />
              <span>Speaking Lab & Shadowing Studio</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Bài Nộp & Đánh Giá Speaking (AI Lab)
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Luyện phát âm AI theo lộ trình bài học và xem phân tích độ chuẩn xác từng âm tiết
            </p>
          </div>
        </div>

        {courses.length > 1 && (
          <div className="flex items-center gap-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl shadow-sm">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Lớp học:</span>
            <select
              value={selectedClassId || ""}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedClassId(newId);
                fetchDailyPlansAndSpeaking(newId);
              }}
              className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              {courses.map((c) => (
                <option key={c.classId} value={c.classId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {c.className} ({c.level || "General"})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

            {errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-300 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 dark:text-rose-300 hover:text-rose-900 font-bold ml-4 cursor-pointer text-base"
          >
            ×
          </button>
        </div>
      )}

      {actionMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. THANH ĐIỀU HƯỚNG CÁC NGÀY: NGÀY 1, NGÀY 2, NGÀY 3, NGÀY 4... */}
      <div className="elp-card bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-700 dark:text-blue-400" />
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
              Lộ trình bài tập Speaking theo Ngày (Daily Plan):
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
            {daysList.length} Ngày trong lộ trình
          </span>
        </div>

        {daysList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
            <AlertTriangle className="mx-auto text-amber-500" size={32} />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Chưa có ngày học nào được giao bài Speaking trong lớp này.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {daysList.map((day) => {
              const isSelectedDay = day.id === selectedDayId;
              const completedCount = day.speakingTasks.filter((t) => t.isCompleted).length;
              const totalCount = day.speakingTasks.length;
              const allDone = totalCount > 0 && completedCount === totalCount;

              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`flex flex-col items-center justify-center min-w-[125px] py-3 px-4 rounded-xl border-2 transition cursor-pointer shrink-0 text-left ${
                    isSelectedDay
                      ? "border-blue-700 bg-blue-50/70 dark:bg-blue-600/15 shadow-xs ring-2 ring-blue-600/20"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 hover:bg-slate-100/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full justify-between">
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        isSelectedDay ? "text-blue-800 dark:text-blue-400" : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      Ngày {day.dayNumber}
                    </span>
                    {allDone ? (
                      <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                    ) : day.isCurrentDay ? (
                      <span className="h-2 w-2 rounded-full bg-blue-800 animate-pulse" />
                    ) : null}
                  </div>

                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate w-full">
                    {day.scheduledDate || day.title}
                  </span>

                  <div className="mt-2 w-full flex items-center justify-between text-[10px]">
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded ${
                        isSelectedDay
                          ? "bg-blue-200/60 dark:bg-blue-600/30 text-blue-900 dark:text-blue-200"
                          : "bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {totalCount} bài nói
                    </span>
                    {allDone && (
                      <span className="text-emerald-700 dark:text-emerald-400 font-black">
                        Đã nộp ({completedCount}/{totalCount})
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. KHÔNG GIAN BÀI TẬP CỦA NGÀY ĐANG CHỌN */}
      {currentSelectedDay && (
        <div
          className={`grid grid-cols-1 lg:grid-cols-12 gap-6 items-start transition-opacity ${
            switching ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          {/* CỘT TRÁI: DANH SÁCH BÀI TẬP NÓI CỦA NGÀY & LỊCH SỬ NỘP */}
          <div className="lg:col-span-4 space-y-4">
            {/* Box: Danh sách bài tập của Ngày đang chọn */}
            <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800/70 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Mic size={14} className="text-blue-700 dark:text-blue-400" />
                  Bài tập Ngày {currentSelectedDay.dayNumber}
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {currentSelectedDay.speakingTasks.length} bài
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[350px] overflow-y-auto">
                {currentSelectedDay.speakingTasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Ngày này chưa có bài tập Speaking nào
                  </div>
                ) : (
                  currentSelectedDay.speakingTasks.map((asg) => {
                    const isAct = asg.id === selectedAssignmentId;
                    return (
                      <div
                        key={asg.id}
                        onClick={() => handleSelectAssignment(asg.id)}
                        className={`p-4 cursor-pointer transition flex items-center justify-between gap-3 ${
                          isAct
                            ? "bg-blue-50/80 dark:bg-blue-950/40 border border-blue-700 dark:border-blue-500 rounded-md"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <div
                            className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                              asg.isShadowing
                                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                : "bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300"
                            }`}
                          >
                            {asg.isShadowing ? (
                              <Headphones size={18} />
                            ) : (
                              <MessageSquare size={18} />
                            )}
                          </div>
                          <div className="truncate">
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                asg.isShadowing
                                  ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                                  : "bg-blue-50 dark:bg-blue-600/15 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-600/30"
                              }`}
                            >
                              {asg.isShadowing ? "Shadowing (Nhại giọng)" : "Speaking Q&A"}
                            </span>
                            <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate mt-1">
                              {asg.title}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {asg.isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md">
                              <CheckCircle2 size={11} /> Đã nộp
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-md">
                              Chưa nộp
                            </span>
                          )}
                          {asg.highestScore !== undefined && asg.highestScore !== null && (
                            <p className="text-[11px] font-black text-blue-800 dark:text-blue-400 mt-1">
                              {asg.highestScore.toFixed(1)} pts
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Box: Lịch Sử Lượt Nộp Bài Của Bài Tập Đang Chọn */}
            <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800/70 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} className="text-blue-700 dark:text-blue-400" />
                  Lịch Sử Các Lần Nộp
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {attempts.length} lượt
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                {attempts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Chưa có lượt nộp bài nào
                  </div>
                ) : (
                  attempts.map((att) => {
                    const isSelectedAtt = att.attemptId === currentAttempt?.attemptId;
                    const isDone = att.status !== "IN_PROGRESS";
                    return (
                      <div
                        key={att.attemptId}
                        onClick={async () => {
                          if (switching || isSelectedAtt) return;
                          setSwitching(true);
                          try {
                            const detail = await studentApi.getAttemptDetail(
                              att.attemptId,
                            );
                            applyAttemptDetail(detail);
                          } catch {
                            applyAttemptDetail(att);
                          } finally {
                            setSwitching(false);
                          }
                        }}
                        className={`p-3.5 cursor-pointer transition ${
                          isSelectedAtt
                            ? "bg-blue-50/80 dark:bg-blue-950/40 border border-blue-700 dark:border-blue-500 rounded-md"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            Lần làm #{att.attemptNumber}
                          </span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              isDone
                                ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-500/20"
                                : "text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-500/20"
                            }`}
                          >
                            {isDone ? (
                              att.score !== undefined && att.score !== null ? (
                                `${att.score.toFixed(1)} pts`
                              ) : (
                                "Đã hoàn thành"
                              )
                            ) : (
                              "Đang làm dở"
                            )}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {att.submittedAt
                              ? new Date(att.submittedAt).toLocaleTimeString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Chưa nộp"}
                          </span>
                          <span>
                            {att.submittedAt
                              ? new Date(att.submittedAt).toLocaleDateString("vi-VN")
                              : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {isSubmitted && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleStartNewAttempt}
                    className="w-full py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <RotateCcw size={13} className="text-blue-700 dark:text-blue-400" />
                    <span>Luyện tập lại (Tạo bài nộp mới)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: KHÔNG GIAN BÀI TẬP, NHẬN XÉT CỦA CÔ GIÁO & AI */}
          <div className="lg:col-span-8 space-y-6">
            {!currentQ ? (
              <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[300px]">
                <AlertTriangle className="mb-3 text-amber-500" size={40} />
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                  Chưa Có Nội Dung Bài Tập
                </h3>
                <p className="text-sm mt-1 max-w-md text-slate-500 dark:text-slate-400">
                  Vui lòng chọn một bài tập Speaking của Ngày {currentSelectedDay.dayNumber} để bắt đầu.
                </p>
              </div>
            ) : (
              <div className="elp-card rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 md:p-8 shadow-xs space-y-6">
                {/* Header Câu Hỏi & Trạng Thái Hoàn Thành */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                      Ngày {currentSelectedDay.dayNumber} • Câu {selectedQuestionIndex + 1}/{questions.length}
                    </span>
                    <span
                      className={`rounded-md px-3 py-1 text-xs font-bold ${
                        isShadowingMode
                          ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                          : "bg-blue-50 dark:bg-blue-600/15 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-600/30"
                      }`}
                    >
                      {isShadowingMode
                        ? "SHADOWING SENTENCE"
                        : "SPEAKING Q&A INTERVIEW"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {isSubmitted ? (
                      <span className="flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 shadow-2xs">
                        <CheckCircle2 size={14} /> ĐÃ HOÀN THÀNH
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-3 py-1.5 rounded-lg">
                        <Clock size={14} /> Đang làm bài
                      </span>
                    )}

                    {currentAttempt?.score !== undefined &&
                      currentAttempt?.score !== null && (
                        <span className="text-xs font-black bg-blue-50 dark:bg-blue-600/15 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-600/30 px-3 py-1.5 rounded-lg">
                          Tổng điểm: {currentAttempt.score.toFixed(1)} pts
                        </span>
                      )}
                  </div>
                </div>

                {/* ĐỀ BÀI CHÍNH & STUDIO SHADOWING HIỆN ĐẠI */}
                {isShadowingMode ? (
                  <div className="space-y-5">
                    <SpeakingShadowingStudio
                      questionId={currentQ.questionId}
                      studentAnswerId={currentQ.studentAnswerId || currentQ.id}
                      referenceSentence={
                        extractReferenceSentence(currentQ) ||
                        "No prompt provided"
                      }
                      referenceAudioUrl={
                        currentQ.mediaUrl &&
                        !isInvalidSampleAudioUrl(
                          currentQ.mediaUrl,
                          activeAudioUrl || currentQ.audioUrl,
                        )
                          ? currentQ.mediaUrl
                          : undefined
                      }
                      savedAudioUrl={
                        activeAudioUrl ||
                        (!isMockOrBrokenAudioUrl(currentQ.audioUrl)
                          ? currentQ.audioUrl
                          : undefined)
                      }
                      currentStep={selectedQuestionIndex + 1}
                      totalSteps={Math.max(1, questions.length)}
                      onBack={() => navigate(-1)}
                      onAudioSubmitted={(blob, result) => {
                        setActiveAudioBlob(blob);
                        setActiveAudioUrl(URL.createObjectURL(blob));
                        void ensureStudentAnswerAudioUploaded(blob);
                        if (result) {
                          setShadowingReport(result);
                          setReportQuestionId(currentQ.questionId);
                        }
                      }}
                    />

                    {!isSubmitted && (
                      <div className="pt-2">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleSubmitAssignment}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3.5 px-6 text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={18} />
                          )}
                          <span>
                            Nộp Bài Hoàn Thành Ngày {currentSelectedDay.dayNumber}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                {/* ĐỀ BÀI CHÍNH (CHẾ ĐỘ SPEAKING Q&A INTERVIEW & XEM KẾT QUẢ BÀI NỘP) */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                    Câu hỏi phỏng vấn / Câu mẫu chuẩn (Reference Prompt):
                  </span>
                  <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-relaxed bg-slate-50/70 dark:bg-slate-800/60 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                    "{cleanShadowingSentence(currentQ.promptText || currentQ.transcript || "") || "No prompt provided"}"
                  </div>

                  {/* Cụm 2 nút tách biệt: Nút 1 (Nghe câu mẫu chuẩn) & Nút 2 (Nghe lại bản thu của bạn) */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {/* NÚT 1: NGHE CÂU MẪU CHUẨN */}
                    <button
                      type="button"
                      disabled={isSynthesizingTts}
                      onClick={() =>
                        void handlePlayTtsPrompt(
                          cleanShadowingSentence(
                            currentQ.promptText || currentQ.transcript || "",
                          ),
                        )
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-800 hover:bg-blue-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl transition shadow-md cursor-pointer"
                    >
                      {isSynthesizingTts ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-blue-200" />
                          <span>Đang tải âm mẫu AI...</span>
                        </>
                      ) : isPlayingRefTts ? (
                        <>
                          <Pause size={14} />
                          <span>Dừng câu mẫu chuẩn</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={14} />
                          <span>Nghe câu mẫu chuẩn</span>
                        </>
                      )}
                    </button>

                    {/* NÚT 2: NGHE LẠI BẢN THU CỦA BẠN (Tách biệt hoàn toàn state & nguồn audio) */}
                    {activeAudioUrl && (
                      <button
                        type="button"
                        onClick={handleTogglePlayStudentAudio}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition shadow-md cursor-pointer"
                      >
                        {isPlayingStudentRec ? (
                          <>
                            <Pause size={14} />
                            <span>Dừng bản thu của bạn</span>
                          </>
                        ) : (
                          <>
                            <Play size={14} />
                            <span>Nghe lại bản thu của bạn</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Bộ chọn giọng đọc mẫu */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                      {[
                        { id: "af_heart", label: "Heart (US Nữ)" },
                        { id: "am_michael", label: "Michael (US Nam)" },
                        { id: "bf_emma", label: "Emma (UK Nữ)" },
                      ].map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedVoice(v.id);
                            if (isPlayingRefTts) {
                              stopAllSampleAudio();
                              setIsPlayingRefTts(false);
                            }
                          }}
                          className={`px-2.5 py-1 text-[11px] rounded-lg transition ${
                            selectedVoice === v.id
                              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-black"
                              : "hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>

                    {/* Tốc độ đọc */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                      <span className="px-1.5 text-[11px] text-slate-400">Tốc độ:</span>
                      {[0.75, 1.0, 1.25, 1.5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setTtsSpeed(s);
                            if (ttsAudioRef.current) ttsAudioRef.current.playbackRate = s;
                          }}
                          className={`px-2 py-0.5 rounded-lg transition ${
                            ttsSpeed === s
                              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs"
                              : "hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>

                    {(currentQ.explanation || currentQ.correctAnswer) && (
                      <button
                        type="button"
                        onClick={() => setShowGuidelines(!showGuidelines)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white ml-auto cursor-pointer"
                      >
                        <Lightbulb size={14} className="text-amber-500" />
                        <span>Gợi ý trả lời</span>
                        {showGuidelines ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    )}
                  </div>

                  {showGuidelines && (
                    <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 animate-in fade-in">
                      <b className="block text-amber-950 dark:text-amber-300 font-black">
                        💡 Hướng dẫn & Tiêu chí câu trả lời:
                      </b>
                      {currentQ.explanation && (
                        <p className="leading-relaxed">{currentQ.explanation}</p>
                      )}
                      {currentQ.correctAnswer && (
                        <p className="leading-relaxed font-medium text-amber-800 dark:text-amber-300">
                          Ý chính gợi ý: {currentQ.correctAnswer}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Điều hướng nếu bài có nhiều câu */}
                {questions.length > 1 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-400 mr-1">
                      Chọn câu:
                    </span>
                    {questions.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedQuestionIndex(idx)}
                        className={`h-8 w-8 rounded-lg text-xs font-black transition cursor-pointer border-2 ${
                          idx === selectedQuestionIndex
                            ? "bg-blue-800 text-white border-blue-700"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* KHU VỰC THU ÂM & PHÁT LẠI GIỌNG NÓI CỦA HỌC VIÊN (Q&A / SUBMISSION) */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Mic size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Bản thu của bạn (Student Recorded Submission):
                    </span>
                    {isSubmitted && (
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={13} /> Đã nộp thành công
                      </span>
                    )}
                  </div>

                  {activeAudioUrl ? (
                    <div className="space-y-2">
                      <audio
                        controls
                        src={activeAudioUrl}
                        onPlay={() => {
                          if (isPlayingRefTts) {
                            stopAllSampleAudio();
                            setIsPlayingRefTts(false);
                          }
                          setIsPlayingStudentRec(true);
                        }}
                        onPause={() => setIsPlayingStudentRec(false)}
                        onEnded={() => setIsPlayingStudentRec(false)}
                        className="w-full h-11 rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      {aiReport?.transcript
                        ? `Bản ghi âm đã được chấm điểm AI (Transcript: "${aiReport.transcript}"). Bấm nút Thu âm lại bên dưới nếu bạn muốn ghi âm bản mới.`
                        : `Chưa có bản ghi âm. Hãy bấm nút thu âm micro bên dưới để trả lời bài tập Ngày ${currentSelectedDay.dayNumber}.`}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {isRecording ? (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-3 text-xs font-black text-white shadow-sm transition animate-pulse cursor-pointer"
                      >
                        <Square size={16} /> Dừng ghi âm ({formatTimer(recordingSeconds)})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="flex items-center gap-2 rounded-xl border-2 border-blue-200 dark:border-blue-600/40 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 px-5 py-3 text-xs font-black text-blue-800 dark:text-blue-300 transition cursor-pointer shadow-2xs"
                      >
                        <Mic size={16} className="text-rose-600" />
                        <span>{activeAudioUrl ? "Thu âm lại" : "Thu âm trực tiếp"}</span>
                      </button>
                    )}

                    <label className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs">
                      <Upload size={15} className="text-blue-700 dark:text-blue-400" />
                      <span>Tải file ghi âm</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>

                    <button
                      type="button"
                      disabled={isEvaluating || (!activeAudioUrl && !activeAudioBlob)}
                      onClick={handleTriggerAiEvaluation}
                      className="ml-auto flex items-center gap-2 rounded-xl bg-blue-800 hover:bg-blue-800 disabled:opacity-50 text-white px-5 py-3 text-xs font-black transition cursor-pointer shadow-xs"
                    >
                      {isEvaluating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      <span>AI Chấm Điểm Phỏng Vấn (IELTS)</span>
                    </button>
                  </div>

                  {!isSubmitted && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleSubmitAssignment}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3.5 px-6 text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={18} />
                        )}
                        <span>Nộp Bài Hoàn Thành Ngày {currentSelectedDay.dayNumber}</span>
                      </button>
                    </div>
                  )}
                </div>
                  </>
                )}

                {/* 4. HỘP NHẬN XÉT CỦA CÔ GIÁO (TEACHER FEEDBACK) NẾU ĐÃ NỘP & CHẤM */}
                {isSubmitted && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/50 dark:bg-slate-900/20 p-6 space-y-3 shadow-card">
                    <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-600/20 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-800 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                          👩‍🏫
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-blue-950 dark:text-blue-200 uppercase tracking-wide">
                            Nhận Xét & Đánh Giá Của Giáo Viên (Cô Giáo)
                          </h4>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Giáo viên phụ trách lớp học
                          </span>
                        </div>
                      </div>

                      {currentAttempt.teacherFeedback ? (
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/30 shadow-2xs">
                          ✓ Đã có nhận xét
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
                          Chờ cô giáo phê duyệt thêm
                        </span>
                      )}
                    </div>

                    {currentAttempt.teacherFeedback ? (
                      <div className="space-y-2 pt-1">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-medium shadow-2xs whitespace-pre-wrap">
                          "{currentAttempt.teacherFeedback}"
                        </div>
                        {typeof currentAttempt.score === "number" && (
                          <p className="text-xs font-bold text-blue-900 dark:text-blue-300">
                            Điểm giáo viên ghi nhận:{" "}
                            <span className="text-sm font-black text-blue-800 dark:text-blue-400">
                              {currentAttempt.score.toFixed(1)} / 10 pts
                            </span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-xl border border-dashed border-blue-200 dark:border-blue-600/30 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <Lightbulb size={16} className="text-amber-500 shrink-0" />
                        <span>
                          Bài tập Ngày {currentSelectedDay.dayNumber} đã được hệ thống AI khảo thí chấm điểm tự động. Khi cô giáo xem lại bài nộp, nhận xét chi tiết của cô sẽ hiển thị tại đây.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. KẾT QUẢ ĐÁNH GIÁ GROQ SHADOWING */}
                {shadowingReport && reportQuestionId === currentQ.questionId && (
                  <div className="pt-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap size={18} className="text-amber-500" />
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                        Nhận Xét & Đánh Giá Phát Âm AI (Groq Whisper & Phonetics):
                      </h4>
                    </div>
                    <ShadowingEvaluationView data={shadowingReport} />
                  </div>
                )}

                {/* 6. KẾT QUẢ ĐÁNH GIÁ IELTS SPEAKING Q&A */}
                {aiReport && reportQuestionId === currentQ.questionId && (
                  <div className="space-y-6 pt-4 border-t-2 border-dashed border-blue-200 dark:border-slate-800 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <Sparkles size={18} className="text-blue-700 dark:text-blue-400" />
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                        Nhận Xét & Đánh Giá Chi Tiết Từ AI Khảo Thí (IELTS Standards):
                      </h4>
                    </div>

                    {aiReport.isOffTopic && (
                      <div className="rounded-xl border-2 border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 p-5 text-rose-900 dark:text-rose-200 shadow-xs flex items-start gap-3">
                        <AlertOctagon
                          size={28}
                          className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"
                        />
                        <div className="space-y-1">
                          <h4 className="text-sm font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                            Phát hiện lạc đề (Off-Topic)
                          </h4>
                          <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
                            Nội dung bài nói không trả lời trực tiếp hoặc đi chệch
                            hướng so với yêu cầu đề bài. Overall Band bị giới hạn tối đa 4.0.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Thống kê Tổng quan (Bands, CEFR, WPM) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div
                        className={`rounded-xl border-2 p-5 text-center ${
                          aiReport.isOffTopic
                            ? "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20"
                            : "border-blue-100 dark:border-blue-600/30 bg-blue-50/40 dark:bg-slate-900/20"
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          Overall Band
                        </span>
                        <p
                          className={`text-4xl font-black mt-1 ${
                            aiReport.isOffTopic
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-blue-800 dark:text-blue-400"
                          }`}
                        >
                          {aiReport.overallBand}{" "}
                          <span className="text-lg text-slate-400">/ 9.0</span>
                        </p>
                      </div>

                      <div className="rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-center shadow-2xs">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          Trình độ CEFR
                        </span>
                        <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                          {aiReport.estimatedCefr}
                        </p>
                      </div>

                      <div className="rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-center shadow-2xs">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          Tốc độ nói
                        </span>
                        <p className="text-4xl font-black text-slate-800 dark:text-white mt-1">
                          {aiReport.wordsPerMinute}{" "}
                          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                            WPM
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Task Achievement */}
                    {aiReport.taskAchievement && (
                      <div className="rounded-xl border border-blue-100 dark:border-blue-600/30 bg-blue-50/40 dark:bg-slate-900/20 p-5 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-600/20 pb-2">
                          <span className="text-xs font-black text-blue-950 dark:text-blue-200 flex items-center gap-1.5 uppercase tracking-wider">
                            <Target size={16} className="text-blue-700 dark:text-blue-400" />
                            Độ Hoàn Thành Yêu Cầu (Task Response):
                          </span>
                          {aiReport.taskAchievement.score !== undefined && (
                            <span className="text-xs font-black text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-600/30 px-2 py-0.5 rounded">
                              {aiReport.taskAchievement.score.toFixed(1)} / 9.0
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          <div className="space-y-2">
                            <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                              <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                              Đã trả lời được:
                            </span>
                            {aiReport.taskAchievement.addressedPoints &&
                            aiReport.taskAchievement.addressedPoints.length > 0 ? (
                              <ul className="space-y-1.5">
                                {aiReport.taskAchievement.addressedPoints.map(
                                  (item, idx) => (
                                    <li
                                      key={idx}
                                      className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-medium rounded-lg p-2 text-xs leading-relaxed"
                                    >
                                      {item}
                                    </li>
                                  ),
                                )}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-400 italic">
                                Chưa ghi nhận.
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <span className="font-bold text-xs text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                              <XCircle size={14} className="text-rose-600 dark:text-rose-400" />
                              Cần bổ sung / thiếu ý:
                            </span>
                            {aiReport.taskAchievement.missingPoints &&
                            aiReport.taskAchievement.missingPoints.length > 0 ? (
                              <ul className="space-y-1.5">
                                {aiReport.taskAchievement.missingPoints.map(
                                  (item, idx) => (
                                    <li
                                      key={idx}
                                      className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-200 font-medium rounded-lg p-2 text-xs leading-relaxed"
                                    >
                                      {item}
                                    </li>
                                  ),
                                )}
                              </ul>
                            ) : (
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-2">
                                Đã hoàn thành đầy đủ yêu cầu.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4 Tiêu Chí IELTS */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 shadow-2xs">
                      <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                        Điểm 4 Tiêu Chí Khảo Thí (Rubrics)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        {[
                          {
                            label: "Phát âm (Pronunciation)",
                            val: aiReport.pronunciationScore,
                          },
                          {
                            label: "Độ trôi chảy (Fluency)",
                            val: aiReport.fluencyScore,
                          },
                          {
                            label: "Từ vựng (Lexical)",
                            val: aiReport.lexicalScore,
                          },
                          {
                            label: "Ngữ pháp (Grammar)",
                            val: aiReport.grammarScore,
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl"
                          >
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                              {item.label}
                            </span>
                            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
                              {item.val}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sửa Lỗi Chi Tiết (Mistakes) */}
                    {aiReport.mistakes && aiReport.mistakes.length > 0 && (
                      <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-950/20 p-5 space-y-4 shadow-2xs">
                        <h4 className="text-sm font-black text-rose-800 dark:text-rose-300 flex items-center gap-2">
                          <AlertTriangle size={18} /> Sửa Lỗi Chi Tiết (Mistakes)
                        </h4>
                        <div className="grid gap-3">
                          {aiReport.mistakes.map((m, idx) => (
                            <div
                              key={idx}
                              className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-100 dark:border-slate-800 shadow-2xs space-y-2"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <span className="bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 px-3 py-1 rounded-md text-sm font-bold line-through decoration-rose-500">
                                  {m.original}
                                </span>
                                <ArrowRight
                                  size={16}
                                  className="text-slate-400 hidden sm:block"
                                />
                                <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-md text-sm font-black border border-emerald-200 dark:border-emerald-500/30">
                                  {m.correction}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 px-1.5 py-0.5 rounded text-[10px] mr-1.5 uppercase">
                                  {m.type}
                                </span>
                                {m.explanation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Nhận xét chung & Native Phrasing */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-5 space-y-2 shadow-2xs">
                        <h4 className="text-xs font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                          <Lightbulb size={16} /> Lời Nhận Xét Tổng Quan Của AI
                        </h4>
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          {aiReport.generalFeedback}
                        </p>
                      </div>

                      <div className="rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/70 dark:bg-slate-900/20 p-5 space-y-2 shadow-2xs">
                        <h4 className="text-xs font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5 uppercase tracking-wider">
                          <Check size={16} /> Cách Diễn Đạt Tự Nhiên Hơn (Native Phrasing)
                        </h4>
                        <p className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed font-medium italic">
                          "{aiReport.correctedText}"
                        </p>
                      </div>
                    </div>

                    {/* Kịch bản nhận diện STT */}
                    {aiReport.transcript && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-5 space-y-2 shadow-2xs">
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Transcript nhận diện từ giọng nói:
                        </span>
                        <p className="text-xs text-slate-800 dark:text-slate-200 italic bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed font-medium">
                          "{aiReport.transcript}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
