// src/features/student/pages/SpeakingAiEvaluationPage.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "@/features/student/api/studentApi";
import ShadowingEvaluationView from "@/features/student/components/ShadowingEvaluationView";
import { cleanShadowingSentence } from "@/features/student/components/SpeakingShadowingStudio";
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
  Zap,
  Headphones,
  MessageSquare,
  ArrowRight,
  RotateCcw,
  Calendar,
  Play,
  Pause,
  Award,
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
  const [showGuidelines, setShowGuidelines] = useState(false);

  // Âm thanh của học sinh
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [activeAudioBlob, setActiveAudioBlob] = useState<Blob | null>(null);

  // Thu âm trực tiếp
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Phát câu mẫu Text-to-speech (Kokoro-82M Neural Audio)
  const [isPlayingRefTts, setIsPlayingRefTts] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>("af_heart");
  const [isSynthesizingTts, setIsSynthesizingTts] = useState<boolean>(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
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
    try {
      const newAttempt = await studentApi.startAssignment(selectedAssignmentId);
      const detail = await studentApi.getAttemptDetail(newAttempt.attemptId);
      setAttempts((prev) => [detail, ...prev]);
      applyAttemptDetail(detail);
      setActionMessage("Đã bắt đầu lượt làm mới. Bạn có thể ghi âm câu trả lời.");
    } catch (err: any) {
      alert("Không thể bắt đầu lượt mới: " + (err.response?.data?.message || err.message));
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
  const attemptDescLower = (
    (currentAttempt as any)?.assignmentDescription ||
    selectedAsgMeta?.description ||
    ""
  ).toLowerCase();
  const isShadowingMode =
    !!selectedAsgMeta?.isShadowing ||
    attemptDescLower.includes("shadow") ||
    attemptDescLower.includes("nhại") ||
    Boolean(
      currentQ &&
        currentQ.correctAnswer &&
        currentQ.promptText &&
        currentQ.promptText.trim() === currentQ.correctAnswer.trim(),
    ) ||
    Boolean(
      currentQ &&
        (currentQ.mediaUrl || (currentQ as any).audioUrl) &&
        !currentQ.promptText?.trim().endsWith("?"),
    );

  // Cập nhật âm thanh khi chuyển câu hỏi
  useEffect(() => {
    setActiveAudioBlob(null);
    if (!currentQ) {
      setActiveAudioUrl(null);
      return;
    }

    const backendUrl =
      (currentQ as any)?.audioUrl || currentQ?.studentAnswer || null;
    if (
      backendUrl &&
      (backendUrl.startsWith("http") || backendUrl.startsWith("blob:"))
    ) {
      setActiveAudioUrl(backendUrl);
    } else {
      setActiveAudioUrl(null);
    }

    extractAndSetAiReportForQuestion(currentQ, currentAttempt);
  }, [selectedQuestionIndex, currentAttempt?.attemptId]);

  // Điều khiển TTS đọc câu hỏi hoặc câu mẫu bằng Kokoro-82M Neural TTS
  const handlePlayTtsPrompt = async (textToRead: string) => {
    if (isPlayingRefTts) {
      if (ttsAudioRef.current) ttsAudioRef.current.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setIsPlayingRefTts(false);
      return;
    }

    const cleanText = cleanShadowingSentence(textToRead?.trim() || "");
    if (!cleanText) return;

    const resolveUrl = (u?: string) => {
      if (!u) return "";
      if (u.startsWith("http://") || u.startsWith("https://")) return u;
      const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
      return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
    };

    const cacheKey = `${cleanText}_${selectedVoice}`;
    let audioUrl = ttsCacheRef.current.get(cacheKey);

    // Nếu câu hỏi đã có sẵn file audio Kokoro-82M cho giọng mặc định af_heart, dùng ngay
    if (
      !audioUrl &&
      selectedVoice === "af_heart" &&
      currentQ?.mediaUrl &&
      !currentQ.mediaUrl.includes("translate.google") &&
      !currentQ.mediaUrl.includes("dictvoice")
    ) {
      audioUrl = resolveUrl(currentQ.mediaUrl);
      ttsCacheRef.current.set(cacheKey, audioUrl);
    }

    if (!audioUrl) {
      setIsSynthesizingTts(true);
      try {
        const response = await studentApi.synthesizeTTS({
          text: cleanText,
          voice: selectedVoice,
          speed: 1.0,
        });
        if (response && response.audioUrl) {
          audioUrl = resolveUrl(response.audioUrl);
          ttsCacheRef.current.set(cacheKey, audioUrl);
        }
      } catch (err) {
        console.warn("Kokoro TTS backend error in SpeakingAiEvaluationPage:", err);
      } finally {
        setIsSynthesizingTts(false);
      }
    }

    if (audioUrl) {
      if (!ttsAudioRef.current) {
        ttsAudioRef.current = new Audio(audioUrl);
      } else {
        ttsAudioRef.current.src = audioUrl;
      }

      ttsAudioRef.current.playbackRate = ttsSpeed;
      (ttsAudioRef.current as any).preservesPitch = true;
      ttsAudioRef.current.onended = () => setIsPlayingRefTts(false);
      ttsAudioRef.current.onerror = () => setIsPlayingRefTts(false);

      try {
        await ttsAudioRef.current.play();
        setIsPlayingRefTts(true);
      } catch (playErr) {
        console.error("Lỗi phát audio:", playErr);
        setIsPlayingRefTts(false);
      }
    }
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
      };

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
      alert(`Đánh giá Speaking thất bại: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Đánh giá AI Shadowing (<2s)
  const handleTriggerShadowingEvaluation = async () => {
    if (!currentAttempt || !currentQ) return;
    setIsEvaluating(true);
    setAiReport(null);
    setActionMessage(null);

    try {
      let finalAudioBlob = activeAudioBlob;

      if (!finalAudioBlob && activeAudioUrl && activeAudioUrl.startsWith("http")) {
        try {
          const res = await fetch(activeAudioUrl);
          if (res.ok) finalAudioBlob = await res.blob();
        } catch {}
      }

      if (!finalAudioBlob) {
        alert("Vui lòng ghi âm câu nhại giọng trước khi chấm điểm AI.");
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

      const filename = finalAudioBlob.type.includes("wav") ? "shadowing.wav" : "shadowing.webm";
      const cleanFile = new File([finalAudioBlob], filename, {
        type: finalAudioBlob.type || "audio/webm",
      });

      const referenceSentence = cleanShadowingSentence(
        currentQ.correctAnswer || currentQ.promptText || ""
      );
      const result = await studentApi.evaluateShadowingAI(
        cleanFile,
        targetAnswerId || "",
        referenceSentence,
      );

      setShadowingReport(result);
      setReportQuestionId(currentQ.questionId);
      setActionMessage("Groq AI đã chấm xong bài Shadowing với điểm phát âm chi tiết!");
    } catch (err: any) {
      alert(`Đánh giá Shadowing thất bại: ${err.response?.data?.message || err.message}`);
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
        <Loader2 className="animate-spin text-indigo-600" size={36} />
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
    <div className="max-w-[1400px] mx-auto space-y-6 pb-16 font-sans">
      {/* 1. TOP HEADER & KHÓA HỌC */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/student/courses")}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-black text-indigo-700 uppercase">
                <Mic size={13} /> Daily Plan Speaking Lab
              </span>
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <Calendar size={13} /> Lộ trình bài tập hàng ngày
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-black text-slate-900 mt-0.5">
              Bài Nộp & Nhận Xét Speaking Theo Ngày (Daily Plan)
            </h1>
          </div>
        </div>

        {courses.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold">Lớp học:</span>
            <select
              value={selectedClassId || ""}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedClassId(newId);
                fetchDailyPlansAndSpeaking(newId);
              }}
              className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-indigo-500"
            >
              {courses.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.className} ({c.level || "General"})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. THANH ĐIỀU HƯỚNG CÁC NGÀY: NGÀY 1, NGÀY 2, NGÀY 3, NGÀY 4... */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-indigo-600" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Lộ trình bài tập Speaking theo Ngày (Daily Plan):
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
            {daysList.length} Ngày trong lộ trình
          </span>
        </div>

        {daysList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <AlertTriangle className="mx-auto text-amber-500" size={32} />
            <p className="text-sm font-bold text-slate-700">
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
                      ? "border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-500/20"
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full justify-between">
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        isSelectedDay ? "text-indigo-700" : "text-slate-800"
                      }`}
                    >
                      Ngày {day.dayNumber}
                    </span>
                    {allDone ? (
                      <CheckCircle2 size={13} className="text-emerald-600" />
                    ) : day.isCurrentDay ? (
                      <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                    ) : null}
                  </div>

                  <span className="text-[11px] font-medium text-slate-400 mt-0.5 truncate w-full">
                    {day.scheduledDate || day.title}
                  </span>

                  <div className="mt-2 w-full flex items-center justify-between text-[10px]">
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded ${
                        isSelectedDay
                          ? "bg-indigo-200/60 text-indigo-900"
                          : "bg-slate-200/60 text-slate-600"
                      }`}
                    >
                      {totalCount} bài nói
                    </span>
                    {allDone && (
                      <span className="text-emerald-700 font-black">
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
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="bg-[#f0f3f8] px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Mic size={14} className="text-indigo-600" />
                  Bài tập Ngày {currentSelectedDay.dayNumber}
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {currentSelectedDay.speakingTasks.length} bài
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                {currentSelectedDay.speakingTasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
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
                            ? "bg-indigo-50/80 border-l-4 border-indigo-600"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <div
                            className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                              asg.isShadowing
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-indigo-100 text-indigo-700"
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
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                              }`}
                            >
                              {asg.isShadowing ? "Shadowing (Nhại giọng)" : "Speaking Q&A"}
                            </span>
                            <p className="text-xs font-black text-slate-800 truncate mt-1">
                              {asg.title}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {asg.isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                              <CheckCircle2 size={11} /> Đã nộp
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                              Chưa nộp
                            </span>
                          )}
                          {asg.highestScore !== undefined && asg.highestScore !== null && (
                            <p className="text-[11px] font-black text-indigo-700 mt-1">
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
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="bg-[#f0f3f8] px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} className="text-indigo-600" />
                  Lịch Sử Các Lần Nộp
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {attempts.length} lượt
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {attempts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
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
                            ? "bg-indigo-50/70 border-l-4 border-indigo-600"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            Lần làm #{att.attemptNumber}
                          </span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              isDone
                                ? "text-emerald-700 bg-emerald-100/70"
                                : "text-amber-700 bg-amber-100/70"
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
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
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
                <div className="p-3 bg-slate-50 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleStartNewAttempt}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <RotateCcw size={13} className="text-indigo-600" />
                    <span>Luyện tập lại (Tạo bài nộp mới)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: KHÔNG GIAN BÀI TẬP, NHẬN XÉT CỦA CÔ GIÁO & AI */}
          <div className="lg:col-span-8 space-y-6">
            {!currentQ ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[300px]">
                <AlertTriangle className="mb-3 text-amber-500" size={40} />
                <h3 className="font-bold text-lg text-slate-800">
                  Chưa Có Nội Dung Bài Tập
                </h3>
                <p className="text-sm mt-1 max-w-md text-slate-500">
                  Vui lòng chọn một bài tập Speaking của Ngày {currentSelectedDay.dayNumber} để bắt đầu.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-xs space-y-6">
                {/* Header Câu Hỏi & Trạng Thái Hoàn Thành */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">
                      Ngày {currentSelectedDay.dayNumber} • Câu {selectedQuestionIndex + 1}/{questions.length}
                    </span>
                    <span
                      className={`rounded-md px-3 py-1 text-xs font-bold ${
                        isShadowingMode
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      }`}
                    >
                      {isShadowingMode
                        ? "SHADOWING SENTENCE"
                        : "SPEAKING Q&A INTERVIEW"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {isSubmitted ? (
                      <span className="flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                        <CheckCircle2 size={14} /> ĐÃ HOÀN THÀNH
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                        <Clock size={14} /> Đang làm bài
                      </span>
                    )}

                    {currentAttempt?.score !== undefined &&
                      currentAttempt?.score !== null && (
                        <span className="text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg">
                          Tổng điểm: {currentAttempt.score.toFixed(1)} pts
                        </span>
                      )}
                  </div>
                </div>

                {/* ĐỀ BÀI CHÍNH */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                    {isShadowingMode ? "Câu mẫu cần luyện nói (Reference Sentence):" : "Câu hỏi phỏng vấn (Interview Prompt):"}
                  </span>
                  <div className="text-xl md:text-2xl font-black text-slate-900 leading-relaxed bg-slate-50/70 p-5 rounded-xl border border-slate-200">
                    "{isShadowingMode
                      ? cleanShadowingSentence(currentQ.correctAnswer || currentQ.promptText || "No prompt provided")
                      : (currentQ.promptText || currentQ.correctAnswer || "No prompt provided")}"
                  </div>

                  {/* Nút Voice AI Text-To-Speech Kokoro-82M cho học sinh nghe câu hỏi / câu mẫu */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={isSynthesizingTts}
                      onClick={() =>
                        handlePlayTtsPrompt(
                          isShadowingMode
                            ? cleanShadowingSentence(currentQ.correctAnswer || currentQ.promptText || "")
                            : (currentQ.promptText || currentQ.correctAnswer || "")
                        )
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-4 py-2 rounded-xl transition shadow-md cursor-pointer"
                    >
                      {isSynthesizingTts ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-indigo-200" />
                          <span>Đang tải âm mẫu AI...</span>
                        </>
                      ) : isPlayingRefTts ? (
                        <>
                          <Pause size={14} />
                          <span>Dừng phát âm mẫu</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={14} />
                          <span>Nghe âm mẫu bản xứ</span>
                        </>
                      )}
                    </button>

                    {/* Bộ chọn giọng đọc mẫu */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
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
                              if (ttsAudioRef.current) ttsAudioRef.current.pause();
                              setIsPlayingRefTts(false);
                            }
                          }}
                          className={`px-2.5 py-1 text-[11px] rounded-lg transition ${
                            selectedVoice === v.id
                              ? "bg-white text-indigo-600 shadow-2xs font-black"
                              : "hover:text-slate-900"
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>

                    {/* Tốc độ đọc */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
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
                              ? "bg-white text-indigo-600 shadow-2xs"
                              : "hover:text-slate-900"
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
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 ml-auto cursor-pointer"
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
                    <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1.5 animate-in fade-in">
                      <b className="block text-amber-950 font-black">
                        💡 Hướng dẫn & Tiêu chí câu trả lời:
                      </b>
                      {currentQ.explanation && (
                        <p className="leading-relaxed">{currentQ.explanation}</p>
                      )}
                      {currentQ.correctAnswer && !isShadowingMode && (
                        <p className="leading-relaxed font-medium text-amber-800">
                          Ý chính gợi ý: {currentQ.correctAnswer}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Điều hướng nếu bài có nhiều câu */}
                {questions.length > 1 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
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
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* KHU VỰC THU ÂM & PHÁT LẠI GIỌNG NÓI */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <Volume2 size={16} className="text-indigo-600" />
                      Bản ghi âm bài nói của bạn (Học sinh thực hiện):
                    </span>
                    {isSubmitted && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 size={13} /> Đã nộp thành công
                      </span>
                    )}
                  </div>

                  {activeAudioUrl ? (
                    <audio
                      controls
                      src={activeAudioUrl}
                      className="w-full h-11 rounded-lg"
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
                      Chưa có bản ghi âm. Hãy bấm nút thu âm micro bên dưới để trả lời bài tập Ngày {currentSelectedDay.dayNumber}.
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
                        className="flex items-center gap-2 rounded-xl border-2 border-indigo-200 bg-white hover:bg-indigo-50 px-5 py-3 text-xs font-black text-indigo-700 transition cursor-pointer shadow-2xs"
                      >
                        <Mic size={16} className="text-rose-600" />
                        <span>{activeAudioUrl ? "Thu âm lại" : "Thu âm trực tiếp"}</span>
                      </button>
                    )}

                    <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs">
                      <Upload size={15} className="text-indigo-600" />
                      <span>Tải file ghi âm</span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>

                    {/* NÚT AI CHẤM ĐIỂM NGAY */}
                    {isShadowingMode ? (
                      <button
                        type="button"
                        disabled={isEvaluating || (!activeAudioUrl && !activeAudioBlob)}
                        onClick={handleTriggerShadowingEvaluation}
                        className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-3 text-xs font-black transition cursor-pointer shadow-xs"
                      >
                        {isEvaluating ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Zap size={16} />
                        )}
                        <span>Groq AI Chấm Shadowing (&lt;2s)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isEvaluating || (!activeAudioUrl && !activeAudioBlob)}
                        onClick={handleTriggerAiEvaluation}
                        className="ml-auto flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-3 text-xs font-black transition cursor-pointer shadow-xs"
                      >
                        {isEvaluating ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Sparkles size={16} />
                        )}
                        <span>AI Chấm Điểm Phỏng Vấn (IELTS)</span>
                      </button>
                    )}
                  </div>

                  {!isSubmitted && (
                    <div className="pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleSubmitAssignment}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 px-6 text-sm font-black shadow-md transition cursor-pointer disabled:opacity-50"
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

                {/* 4. HỘP NHẬN XÉT CỦA CÔ GIÁO (TEACHER FEEDBACK) NẾU ĐÃ NỘP & CHẤM */}
                {isSubmitted && (
                  <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-blue-50/40 p-6 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                          👩‍🏫
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-indigo-950 uppercase tracking-wide">
                            Nhận Xét & Đánh Giá Của Giáo Viên (Cô Giáo)
                          </h4>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Giáo viên phụ trách lớp học
                          </span>
                        </div>
                      </div>

                      {currentAttempt.teacherFeedback ? (
                        <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                          ✓ Đã có nhận xét
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-500 bg-white/80 border border-slate-200 px-2.5 py-1 rounded-lg">
                          Chờ cô giáo phê duyệt thêm
                        </span>
                      )}
                    </div>

                    {currentAttempt.teacherFeedback ? (
                      <div className="space-y-2 pt-1">
                        <div className="bg-white p-4 rounded-xl border border-indigo-100 text-slate-800 text-sm leading-relaxed font-medium shadow-2xs whitespace-pre-wrap">
                          "{currentAttempt.teacherFeedback}"
                        </div>
                        {typeof currentAttempt.score === "number" && (
                          <p className="text-xs font-bold text-indigo-900">
                            Điểm giáo viên ghi nhận:{" "}
                            <span className="text-sm font-black text-indigo-700">
                              {currentAttempt.score.toFixed(1)} / 10 pts
                            </span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white/80 p-3.5 rounded-xl border border-dashed border-indigo-200 text-xs text-slate-600 flex items-center gap-2">
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
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                        Nhận Xét & Đánh Giá Phát Âm AI (Groq Whisper & Phonetics):
                      </h4>
                    </div>
                    <ShadowingEvaluationView data={shadowingReport} />
                  </div>
                )}

                {/* 6. KẾT QUẢ ĐÁNH GIÁ IELTS SPEAKING Q&A */}
                {aiReport && reportQuestionId === currentQ.questionId && (
                  <div className="space-y-6 pt-4 border-t-2 border-dashed border-indigo-200 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <Sparkles size={18} className="text-indigo-600" />
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                        Nhận Xét & Đánh Giá Chi Tiết Từ AI Khảo Thí (IELTS Standards):
                      </h4>
                    </div>

                    {aiReport.isOffTopic && (
                      <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-900 shadow-xs flex items-start gap-3">
                        <AlertOctagon
                          size={28}
                          className="text-rose-600 shrink-0 mt-0.5"
                        />
                        <div className="space-y-1">
                          <h4 className="text-sm font-black uppercase tracking-wider text-rose-700">
                            Phát hiện lạc đề (Off-Topic)
                          </h4>
                          <p className="text-xs text-rose-800 leading-relaxed font-medium">
                            Nội dung bài nói không trả lời trực tiếp hoặc đi chệch
                            hướng so với yêu cầu đề bài. Overall Band bị giới hạn tối đa 4.0.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Thống kê Tổng quan (Bands, CEFR, WPM) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div
                        className={`rounded-2xl border-2 p-5 text-center ${
                          aiReport.isOffTopic
                            ? "border-rose-200 bg-rose-50/50"
                            : "border-indigo-100 bg-indigo-50/40"
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Overall Band
                        </span>
                        <p
                          className={`text-4xl font-black mt-1 ${
                            aiReport.isOffTopic
                              ? "text-rose-600"
                              : "text-indigo-700"
                          }`}
                        >
                          {aiReport.overallBand}{" "}
                          <span className="text-lg text-slate-400">/ 9.0</span>
                        </p>
                      </div>

                      <div className="rounded-2xl border-2 border-slate-100 bg-white p-5 text-center shadow-2xs">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Trình độ CEFR
                        </span>
                        <p className="text-4xl font-black text-emerald-600 mt-1">
                          {aiReport.estimatedCefr}
                        </p>
                      </div>

                      <div className="rounded-2xl border-2 border-slate-100 bg-white p-5 text-center shadow-2xs">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Tốc độ nói
                        </span>
                        <p className="text-4xl font-black text-slate-800 mt-1">
                          {aiReport.wordsPerMinute}{" "}
                          <span className="text-sm font-bold text-slate-400">
                            WPM
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Task Achievement */}
                    {aiReport.taskAchievement && (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                          <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5 uppercase tracking-wider">
                            <Target size={16} className="text-indigo-600" />
                            Độ Hoàn Thành Yêu Cầu (Task Response):
                          </span>
                          {aiReport.taskAchievement.score !== undefined && (
                            <span className="text-xs font-black text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded">
                              {aiReport.taskAchievement.score.toFixed(1)} / 9.0
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          <div className="space-y-2">
                            <span className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                              <Check size={14} className="text-emerald-600" />
                              Đã trả lời được:
                            </span>
                            {aiReport.taskAchievement.addressedPoints &&
                            aiReport.taskAchievement.addressedPoints.length > 0 ? (
                              <ul className="space-y-1.5">
                                {aiReport.taskAchievement.addressedPoints.map(
                                  (item, idx) => (
                                    <li
                                      key={idx}
                                      className="bg-white border border-emerald-200 text-emerald-900 font-medium rounded-lg p-2 text-xs leading-relaxed"
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
                            <span className="font-bold text-xs text-rose-800 flex items-center gap-1.5">
                              <XCircle size={14} className="text-rose-600" />
                              Cần bổ sung / thiếu ý:
                            </span>
                            {aiReport.taskAchievement.missingPoints &&
                            aiReport.taskAchievement.missingPoints.length > 0 ? (
                              <ul className="space-y-1.5">
                                {aiReport.taskAchievement.missingPoints.map(
                                  (item, idx) => (
                                    <li
                                      key={idx}
                                      className="bg-white border border-rose-200 text-rose-900 font-medium rounded-lg p-2 text-xs leading-relaxed"
                                    >
                                      {item}
                                    </li>
                                  ),
                                )}
                              </ul>
                            ) : (
                              <p className="text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                                Đã hoàn thành đầy đủ yêu cầu.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4 Tiêu Chí IELTS */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
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
                            className="border border-slate-100 bg-slate-50 p-3 rounded-xl"
                          >
                            <span className="text-[11px] font-bold text-slate-500 block truncate">
                              {item.label}
                            </span>
                            <span className="text-2xl font-black text-slate-800 mt-1 block">
                              {item.val}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sửa Lỗi Chi Tiết (Mistakes) */}
                    {aiReport.mistakes && aiReport.mistakes.length > 0 && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 space-y-4 shadow-2xs">
                        <h4 className="text-sm font-black text-rose-800 flex items-center gap-2">
                          <AlertTriangle size={18} /> Sửa Lỗi Chi Tiết (Mistakes)
                        </h4>
                        <div className="grid gap-3">
                          {aiReport.mistakes.map((m, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-4 rounded-xl border border-rose-100 shadow-2xs space-y-2"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <span className="bg-rose-50 text-rose-800 px-3 py-1 rounded-md text-sm font-bold line-through decoration-rose-500">
                                  {m.original}
                                </span>
                                <ArrowRight
                                  size={16}
                                  className="text-slate-400 hidden sm:block"
                                />
                                <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-md text-sm font-black border border-emerald-200">
                                  {m.correction}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 font-medium">
                                <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] mr-1.5 uppercase">
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
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 space-y-2 shadow-2xs">
                        <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                          <Lightbulb size={16} /> Lời Nhận Xét Tổng Quan Của AI
                        </h4>
                        <p className="text-xs text-slate-800 leading-relaxed font-medium">
                          {aiReport.generalFeedback}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 space-y-2 shadow-2xs">
                        <h4 className="text-xs font-black text-indigo-900 flex items-center gap-1.5 uppercase tracking-wider">
                          <Check size={16} /> Cách Diễn Đạt Tự Nhiên Hơn (Native Phrasing)
                        </h4>
                        <p className="text-xs text-indigo-950 leading-relaxed font-medium italic">
                          "{aiReport.correctedText}"
                        </p>
                      </div>
                    </div>

                    {/* Kịch bản nhận diện STT */}
                    {aiReport.transcript && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-2 shadow-2xs">
                        <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                          Transcript nhận diện từ giọng nói:
                        </span>
                        <p className="text-xs text-slate-800 italic bg-white p-3.5 rounded-xl border border-slate-200 leading-relaxed font-medium">
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
