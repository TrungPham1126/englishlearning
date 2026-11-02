import { useState, useEffect, useMemo } from "react";
import { teacherApi } from "../../api/teacherApi";
import type { ClassroomItem } from "../../api/teacherApi";
import type { GradingSubmission, GradingSubmissionDetail } from "./gradingTypes";

export function useTeacherGrading() {
  const [classes, setClasses] = useState<ClassroomItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");

  const [submissions, setSubmissions] = useState<GradingSubmission[]>([]);
  const [selectedSub, setSelectedSub] = useState<GradingSubmission | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<GradingSubmissionDetail | null>(null);

  const [inputScore, setInputScore] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL");

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingGrade, setSavingGrade] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // 1. Tải danh sách lớp
  useEffect(() => {
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
  }, []);

  // 2. Tải danh sách bài tập khi chọn Lớp (chỉ tải bài tập phần Viết đoạn văn & Speaking)
  useEffect(() => {
    if (selectedClassId) {
      setLoadingAssignments(true);
      teacherApi
        .getClassAssignments(selectedClassId, { gradingOnly: true })
        .then((res: any) => {
          const rawList = res.data?.data || [];
          // Bộ lọc chặt chẽ: Chỉ giữ lại bài tập kỹ năng Viết (WRITING) hoặc Nói (SPEAKING),
          // hoặc bài tập có câu hỏi dạng ESSAY hoặc AUDIO_RESPONSE
          const gradableList = rawList.filter((a: any) => {
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
    setSelectedSub(sub);
    setLoadingDetail(true);
    setSaveSuccess(null);
    try {
      const res: any = await teacherApi.getSubmissionDetail(sub.attemptId);
      const detail = res.data?.data;
      if (detail) {
        // Lọc chỉ hiển thị câu hỏi thuộc phần viết đoạn văn (ESSAY) và speaking (AUDIO_RESPONSE)
        const subjectiveQuestions = (detail.questions || []).filter((q: any) => {
          const type = String(q.questionType || "").toUpperCase();
          if (type === "ESSAY" || type === "AUDIO_RESPONSE") return true;
          if (q.audioUrl) return true;
          const skill = String(detail.skillType || "").toUpperCase();
          if (skill === "WRITING" && (q.studentAnswer || !q.options || q.options.length === 0)) return true;
          if (skill === "SPEAKING") return true;
          return false;
        });

        setSubmissionDetail({
          ...detail,
          questions: subjectiveQuestions,
        });
        setInputScore(detail?.score !== null && detail?.score !== undefined ? String(detail.score) : "");
        setFeedback(detail?.teacherFeedback || "");
      } else {
        setSubmissionDetail(null);
      }
    } catch (err) {
      console.error("Lỗi tải chi tiết bài làm:", err);
      alert("Không thể tải chi tiết bài làm của học sinh.");
    } finally {
      setLoadingDetail(false);
    }
  };

  // 5. Submit chấm điểm
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    const parsedScore = parseFloat(inputScore);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 10) {
      alert("Vui lòng nhập điểm số hợp lệ từ 0 đến 10.");
      return;
    }

    try {
      setSavingGrade(true);
      setSaveSuccess(null);
      await teacherApi.gradeSubmission(selectedSub.attemptId, {
        score: parsedScore,
        feedback,
      });

      setSaveSuccess(`Đã lưu điểm ${parsedScore} và gửi nhận xét cho học viên.`);

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
      alert(err.response?.data?.message || "Lỗi khi chấm điểm.");
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
    handleSelectSubmission,
    handleSaveGrade,
    filteredSubmissions,
    pendingCount,
    completedCount,
  };
}
