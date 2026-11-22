import React, { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpenCheck,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  teacherApi,
  type LessonGrammarItem,
} from "../../api/teacherApi";

interface TeacherLessonGrammarTabProps {
  lessonId: string;
  grammarTopics: LessonGrammarItem[];
  onRefresh: () => Promise<void>;
}

export function TeacherLessonGrammarTab({
  lessonId,
  grammarTopics,
  onRefresh,
}: TeacherLessonGrammarTabProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [ruleSummary, setRuleSummary] = useState("");
  const [formula, setFormula] = useState("");
  const [examples, setExamples] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const openAddForm = () => {
    setEditingId(null);
    setTitle("");
    setRuleSummary("");
    setFormula("");
    setExamples("");
    setFormOpen(true);
    setFeedback(null);
  };

  const openEditForm = (topic: LessonGrammarItem) => {
    setEditingId(topic.id);
    setTitle(topic.title || "");
    setRuleSummary(topic.ruleSummary || "");
    setFormula(topic.formula || "");
    setExamples(topic.examples || "");
    setFormOpen(true);
    setFeedback(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !ruleSummary.trim()) return;

    setSaving(true);
    setFeedback(null);
    const payload = {
      title: title.trim(),
      ruleSummary: ruleSummary.trim(),
      formula: formula.trim(),
      examples: examples.trim(),
    };

    try {
      if (editingId) {
        await teacherApi.updateGrammarTopic(editingId, payload);
        setFeedback({ type: "success", message: `Đã cập nhật chủ điểm "${payload.title}".` });
      } else {
        await teacherApi.addGrammarTopic(lessonId, payload);
        setFeedback({ type: "success", message: `Đã thêm chủ điểm "${payload.title}".` });
      }
      setFormOpen(false);
      setEditingId(null);
      await onRefresh();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || "Lưu chủ điểm ngữ pháp thất bại.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (topic: LessonGrammarItem) => {
    if (!window.confirm(`Xóa chủ điểm ngữ pháp "${topic.title}"?`)) return;
    setFeedback(null);
    try {
      await teacherApi.deleteGrammarTopic(topic.id);
      if (editingId === topic.id) {
        setFormOpen(false);
        setEditingId(null);
      }
      await onRefresh();
      setFeedback({ type: "success", message: `Đã xóa "${topic.title}".` });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || "Xóa chủ điểm ngữ pháp thất bại.",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Chủ điểm ngữ pháp ({grammarTopics.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Biên soạn cấu trúc ngữ pháp, công thức và ví dụ minh họa theo bài học.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus size={14} />
          <span>Thêm ngữ pháp</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl border p-3 text-xs font-medium ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 size={15} className="shrink-0" />
            ) : (
              <AlertCircle size={15} className="shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/40 dark:bg-slate-900/60 p-4 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
              {editingId ? "Chỉnh sửa chủ điểm ngữ pháp" : "Thêm chủ điểm ngữ pháp mới"}
            </h4>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tên chủ điểm *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Present Perfect Tense"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tóm tắt quy tắc *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Diễn tả hành động bắt đầu trong quá khứ và còn tiếp diễn đến hiện tại..."
              value={ruleSummary}
              onChange={(e) => setRuleSummary(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Công thức
            </label>
            <input
              type="text"
              placeholder="VD: S + have/has + V3/ed"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ví dụ minh họa
            </label>
            <textarea
              rows={2}
              placeholder="VD: She has lived in Hanoi for five years."
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 px-4 py-2 font-semibold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              <span>{editingId ? "Cập nhật ngữ pháp" : "Lưu ngữ pháp"}</span>
            </button>
          </div>
        </form>
      )}

      {grammarTopics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0e1526] p-8 text-center">
          <BookOpenCheck size={28} className="mx-auto text-slate-400 mb-2" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Chưa có chủ điểm ngữ pháp nào cho bài giảng này.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grammarTopics.map((topic) => (
            <div
              key={topic.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0e1526] p-4 space-y-2.5 hover:border-blue-300 dark:hover:border-blue-700 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {topic.title}
                </h4>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditForm(topic)}
                    aria-label={`Sửa ngữ pháp ${topic.title}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 transition cursor-pointer"
                  >
                    <Pencil size={12} />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(topic)}
                    aria-label={`Xóa ngữ pháp ${topic.title}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {topic.ruleSummary}
              </p>

              {topic.formula && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/30 px-3 py-2 font-mono text-xs font-semibold text-blue-800 dark:text-blue-300">
                  {topic.formula}
                </div>
              )}

              {topic.examples && (
                <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Ví dụ:{" "}
                  </span>
                  {topic.examples}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
