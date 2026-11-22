import { useState, useEffect, useMemo, useRef } from "react";
import { teacherApi } from "../../api/teacherApi";
import type { ClassroomItem } from "../../api/teacherApi";
import type { GradingSubmission, GradingSubmissionDetail } from "./gradingTypes";
import { normalizeScoreTo10 } from "@/utils/scoreScale";

export function useTeacherGrading(scopedClassId?: string) {
  const [classes, setClasses] = useState<ClassroomItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(scopedClassId || "");
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");

  const [submissions, setSubmissions] = useState<GradingSubmission[]>([]);
  const [selectedSub, setSelectedSub] = useState<GradingSubmission | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<GradingSubmissionDetail | null>(null);
  const detailRequestIdRef = useRef<number>(0);

  const [inputScore, setInputScore] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [answerScores, setAnswerScores] = useState<Record<string, number>>({});
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingGrade, setSavingGrade] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // 1. Tải danh sách lớp (hoặc dùng scopedClassId khi ở trong 1 lớp cụ thể)
  useEffect(() => {
    if (scopedClassId) {
      setSelectedClassId(scopedClassId);
      setLoadingClasses(false);
      return;
    }
    setLoadingClasses(true);
    teacherApi
      .getAssignedClasses()
      .then((res: any) => {
        const list = res.data?.data || [];
        setClasses(list);
        if (list.length > 0) setSelectedClassId(list[0].id);
      })
      .catch((err) => {
        console.error("Lỗi tải lớp học:", err);
      })
      .finally(() => setLoadingClasses(false));
  }, [scopedClassId]);

  // 2. Tải danh sách bài tập khi chọn Lớp (chỉ tải bài tập phần Viết đoạn văn & Speaking)
  useEffect(() => {
    if (selectedClassId) {
      setLoadingAssignments(true);
      teacherApi
        .getClassAssignments(selectedClassId, { gradingOnly: true })
        .then((res: any) => {
          const rawList = res.data?.data || [];
          // Giữ lại bài thi (isExam) và bài tập cần chấm (WRITING / SPEAKING / ESSAY / AUDIO_RESPONSE)
          const gradableList = rawList.filter((a: any) => {
            if (Boolean(a.isExam)) return true;
            const skill = String(a.skillType || "").toUpperCase();
            if (skill === "WRITING" || skill === "SPEAKING") return true;
            if (Array.isArray(a.questions) && a.questions.length > 0) {
              return a.questions.some((q: any) => {
                const type = String(q.questionType || "").toUpperCase();
                return type === "ESSAY" || type === "AUDIO_RESPONSE";
              });
            }
            return false;
          });

          setAssignments(gradableList);
          if (gradableList.length > 0) {
            setSelectedAssignmentId(gradableList[0].id);
          } else {
            setSelectedAssignmentId("");
            setSubmissions([]);
            setSelectedSub(null);
            setSubmissionDetail(null);
          }
        })
        .catch((err) => {
          console.error("Lỗi tải bài tập:", err);
          setAssignments([]);
          setSelectedAssignmentId("");
          setSubmissions([]);
          setSelectedSub(null);
          setSubmissionDetail(null);
        })
        .finally(() => setLoadingAssignments(false));
    }
  }, [selectedClassId]);

  // 3. Tải danh sách bài nộp khi chọn Bài Tập
  useEffect(() => {
    if (selectedAssignmentId) {
      setLoadingSubmissions(true);
      teacherApi
        .getSubmissionsForGrading(selectedAssignmentId)
        .then((res: any) => {
          const list = res.data?.data || [];
          setSubmissions(list);
          if (list.length > 0) {
            handleSelectSubmission(list[0]);
          } else {
            setSelectedSub(null);
            setSubmissionDetail(null);
          }
        })
        .catch((err) => {
          console.error("Lỗi tải bài nộp:", err);
          setSubmissions([]);
        })
        .finally(() => setLoadingSubmissions(false));
    }
  }, [selectedAssignmentId]);

  // 4. Lấy chi tiết bài nộp khi Click vào danh sách bên trái
  const handleSelectSubmission = async (sub: GradingSubmission) => {
    const reqId = ++detailRequestIdRef.current;
    setSelectedSub(sub);
    setLoadingDetail(true);
    setSaveSuccess(null);
    try {
      const res: any = await teacherApi.getSubmissionDetail(sub.attemptId);
      if (reqId !== detailRequestIdRef.current) return;
      const detail = res.data?.data;
      if (detail) {
        const isExam = Boolean(detail.isExam);
        // Với Bài thi: giữ nguyên toàn bộ câu hỏi của mọi kỹ năng; bài thường chỉ lọc tự luận/speaking
        const filteredQuestions = isExam
          ? detail.questions || []
          : (detail.questions || []).filter((q: any) => {
              const type = String(q.questionType || "").toUpperCase();
              if (type === "ESSAY" || type === "AUDIO_RESPONSE") return true;
              if (q.audioUrl) return true;
              const skill = String(detail.skillType || "").toUpperCase();
              if (skill === "WRITING" && (q.studentAnswer || !q.options || q.options.length === 0)) return true;
              if (skill === "SPEAKING") return true;
              return false;
            });

        const initialScores: Record<string, number> = {};
        filteredQuestions.forEach((q: any) => {
          const key = q.questionId || q.id;
          if (key && q.earnedPoints !== null && q.earnedPoints !== undefined) {
            initialScores[key] = Number(q.earnedPoints);
          }
        });
        setAnswerScores(initialScores);

        setSubmissionDetail({
          ...detail,
          questions: filteredQuestions,
        });
        setInputScore(
          detail?.score !== null && detail?.score !== undefined
            ? String(normalizeScoreTo10(detail.score) ?? "")
            : "",
        );
        setFeedback(detail?.teacherFeedback || "");
      } else {
        setAnswerScores({});
        setSubmissionDetail(null);
      }
    } catch (err) {
      if (reqId !== detailRequestIdRef.current) return;
      console.error("Lỗi tải chi tiết bài làm:", err);
      alert("Tải bài nộp thất bại.");
    } finally {
      if (reqId === detailRequestIdRef.current) {
        setLoadingDetail(false);
      }
    }
  };

  const handleUpdateQuestionScore = (questionKey: string, nextScore: number) => {
    setAnswerScores((prev) => ({
      ...prev,
      [questionKey]: nextScore,
    }));
  };

  // 5. Submit chấm điểm
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    const parsedScore = parseFloat(inputScore);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 10) {
      alert("Điểm phải từ 0 đến 10.");
      return;
    }

    try {
      setSavingGrade(true);
      setSaveSuccess(null);
      const hasAnswerScores =
        submissionDetail?.isExam && Object.keys(answerScores).length > 0;
      await teacherApi.gradeSubmission(selectedSub.attemptId, {
        score: parsedScore,
        feedback,
        ...(hasAnswerScores ? { answerScores } : {}),
      });

      setSaveSuccess(`Đã lưu điểm ${parsedScore}.`);

      // Cập nhật state nội bộ
      setSubmissions((prev) =>
        prev.map((item) =>
          item.attemptId === selectedSub.attemptId
            ? { ...item, score: parsedScore, status: "COMPLETED" }
            : item,
        ),
      );
      setSelectedSub((prev: any) => ({
        ...prev,
        score: parsedScore,
        status: "COMPLETED",
      }));
      setSubmissionDetail((prev: any) => ({
        ...prev,
        score: parsedScore,
        teacherFeedback: feedback,
        status: "COMPLETED",
      }));
    } catch (err: any) {
      console.error("Lỗi chấm điểm:", err);
      alert(err.response?.data?.message || "Lưu điểm thất bại.");
    } finally {
      setSavingGrade(false);
    }
  };

  // Lọc theo search và trạng thái
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const matchesSearch =
        s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        s.studentEmail.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "PENDING") {
        return s.status !== "COMPLETED";
      }
      if (statusFilter === "COMPLETED") {
        return s.status === "COMPLETED";
      }
      return true;
    });
  }, [submissions, search, statusFilter]);

  const pendingCount = submissions.filter((s) => s.status !== "COMPLETED").length;
  const completedCount = submissions.filter((s) => s.status === "COMPLETED").length;

  return {
    classes,
    selectedClassId,
    setSelectedClassId,
    assignments,
    selectedAssignmentId,
    setSelectedAssignmentId,
    submissions,
    selectedSub,
    submissionDetail,
    inputScore,
    setInputScore,
    feedback,
    setFeedback,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    loadingClasses,
    loadingAssignments,
    loadingSubmissions,
    loadingDetail,
    savingGrade,
    saveSuccess,
    answerScores,
    handleUpdateQuestionScore,
    handleSelectSubmission,
    handleSaveGrade,
    filteredSubmissions,
    pendingCount,
    completedCount,
  };
}
