import React, { useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Volume2,
  BookA,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  teacherApi,
  type LessonVocabularyItem,
} from "../../api/teacherApi";

interface TeacherLessonVocabularyTabProps {
  lessonId: string;
  vocabularies: LessonVocabularyItem[];
  onRefresh: () => Promise<void>;
}

const PART_OF_SPEECH_OPTIONS = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "phrase",
];

export function TeacherLessonVocabularyTab({
  lessonId,
  vocabularies,
  onRefresh,
}: TeacherLessonVocabularyTabProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [ipa, setIpa] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("noun");
  const [exampleSentence, setExampleSentence] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const openAddForm = () => {
    setEditingId(null);
    setWord("");
    setMeaning("");
    setIpa("");
    setPartOfSpeech("noun");
    setExampleSentence("");
    setFormOpen(true);
    setFeedback(null);
  };

  const openEditForm = (item: LessonVocabularyItem) => {
    setEditingId(item.id);
    setWord(item.word || "");
    setMeaning(item.meaning || "");
    setIpa(item.ipa || "");
    setPartOfSpeech(item.partOfSpeech || "noun");
    setExampleSentence(item.exampleSentence || "");
    setFormOpen(true);
    setFeedback(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) return;

    setSaving(true);
    setFeedback(null);
    const payload = {
      word: word.trim(),
      meaning: meaning.trim(),
      ipa: ipa.trim(),
      partOfSpeech: partOfSpeech.trim() || "noun",
      exampleSentence: exampleSentence.trim(),
    };

    try {
      if (editingId) {
        await teacherApi.updateVocabulary(editingId, payload);
        setFeedback({ type: "success", message: `Đã cập nhật từ "${payload.word}".` });
      } else {
        await teacherApi.addVocabulary(lessonId, payload);
        setFeedback({ type: "success", message: `Đã thêm từ "${payload.word}".` });
      }
      setFormOpen(false);
      setEditingId(null);
      await onRefresh();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || "Lưu từ vựng thất bại.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: LessonVocabularyItem) => {
    if (!window.confirm(`Xóa từ vựng "${item.word}"?`)) return;
    setFeedback(null);
    try {
      await teacherApi.deleteVocabulary(item.id);
      if (editingId === item.id) {
        setFormOpen(false);
        setEditingId(null);
      }
      await onRefresh();
      setFeedback({ type: "success", message: `Đã xóa từ "${item.word}".` });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || "Xóa từ vựng thất bại.",
      });
    }
  };

  const handleSpeakWord = (item: LessonVocabularyItem) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (item.audioUrl) {
      try {
        const audio = new Audio(item.audioUrl);
        audioRef.current = audio;
        void audio.play().catch(() => {
          speakWithWebSpeech(item.word);
        });
        return;
      } catch {
        // Fallback to Web Speech API
      }
    }
    speakWithWebSpeech(item.word);
  };

  const speakWithWebSpeech = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Từ vựng bài học ({vocabularies.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Quản lý từ vựng, phiên âm IPA, nghĩa tiếng Việt và câu ví dụ.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus size={14} />
          <span>Thêm từ vựng</span>
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
              {editingId ? "Chỉnh sửa từ vựng" : "Thêm từ vựng mới"}
            </h4>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Từ tiếng Anh *
              </label>
              <input
                type="text"
                required
                placeholder="VD: resilient"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nghĩa tiếng Việt *
              </label>
              <input
                type="text"
                required
                placeholder="VD: kiên cường, bền bỉ"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phiên âm IPA (để trống để tự tra)
              </label>
              <input
                type="text"
                placeholder="VD: /rɪˈzɪl.jənt/"
                value={ipa}
                onChange={(e) => setIpa(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 font-ipa text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Từ loại
              </label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              >
                {PART_OF_SPEECH_OPTIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Câu ví dụ
            </label>
            <textarea
              rows={2}
              placeholder="VD: Children are often very resilient."
              value={exampleSentence}
              onChange={(e) => setExampleSentence(e.target.value)}
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
              <span>{editingId ? "Cập nhật từ vựng" : "Lưu từ vựng"}</span>
            </button>
          </div>
        </form>
      )}

      {vocabularies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0e1526] p-8 text-center">
          <BookA size={28} className="mx-auto text-slate-400 mb-2" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Chưa có từ vựng nào cho bài giảng này.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {vocabularies.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0e1526] p-4 flex flex-col justify-between gap-3 hover:border-blue-300 dark:hover:border-blue-700 transition"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {v.word}
                    </span>
                    {v.partOfSpeech && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">
                        {v.partOfSpeech}
                      </span>
                    )}
                    {v.ipa && (
                      <span className="text-xs font-ipa text-slate-500 dark:text-slate-400">
                        {v.ipa.startsWith("/") ? v.ipa : `/${v.ipa}/`}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSpeakWord(v)}
                    title={`Nghe phát âm ${v.word}`}
                    aria-label={`Nghe phát âm ${v.word}`}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-blue-700 dark:text-blue-400 hover:bg-blue-50 cursor-pointer shrink-0"
                  >
                    <Volume2 size={14} />
                  </button>
                </div>

                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  {v.meaning}
                </p>

                {v.exampleSentence && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                    &ldquo;{v.exampleSentence}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => openEditForm(v)}
                  aria-label={`Sửa từ ${v.word}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 transition cursor-pointer"
                >
                  <Pencil size={12} />
                  <span>Sửa</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(v)}
                  aria-label={`Xóa từ ${v.word}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>Xóa</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
