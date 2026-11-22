import React, { useRef, useState } from "react";
import {
  FileText,
  Upload,
  Eye,
  Download,
  Pencil,
  Trash2,
  X,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Volume2,
} from "lucide-react";
import {
  teacherApi,
  detectDocumentFileType,
  type DocumentFileType,
  type LessonDocumentItem,
} from "../../api/teacherApi";

interface TeacherLessonDocumentsTabProps {
  lessonId: string;
  documents: LessonDocumentItem[];
  onRefresh: () => Promise<void>;
}

const FILE_TYPE_OPTIONS: Array<{ value: DocumentFileType; label: string }> = [
  { value: "PDF", label: "PDF" },
  { value: "DOCX", label: "Word / Text (DOCX)" },
  { value: "PPTX", label: "Slide (PPTX)" },
  { value: "IMAGE", label: "Hình ảnh (IMAGE)" },
  { value: "AUDIO", label: "Âm thanh (AUDIO)" },
];

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TeacherLessonDocumentsTab({
  lessonId,
  documents,
  onRefresh,
}: TeacherLessonDocumentsTabProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [previewDoc, setPreviewDoc] = useState<LessonDocumentItem | null>(null);

  const [editingDoc, setEditingDoc] = useState<LessonDocumentItem | null>(null);
  const [editFileName, setEditFileName] = useState("");
  const [editFileType, setEditFileType] = useState<DocumentFileType>("PDF");
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleUploadNew = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size <= 0) {
      setFeedback({ type: "error", message: `File "${file.name}" bị rỗng.` });
      e.target.value = "";
      return;
    }

    setUploading(true);
    setFeedback(null);
    try {
      const detectedType = detectDocumentFileType(file);
      await teacherApi.uploadLessonDocument(lessonId, file, detectedType);
      await onRefresh();
      setFeedback({
        type: "success",
        message: `Đã thêm tài liệu "${file.name}".`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message || `Không thể tải tài liệu "${file.name}".`,
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openEditModal = (doc: LessonDocumentItem) => {
    const normalizedType = FILE_TYPE_OPTIONS.some((o) => o.value === doc.fileType)
      ? (doc.fileType as DocumentFileType)
      : "PDF";
    setEditingDoc(doc);
    setEditFileName(doc.fileName || "");
    setEditFileType(normalizedType);
    setReplacementFile(null);
    setFeedback(null);
  };

  const handleReplacementFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplacementFile(file);
    setEditFileName(file.name);
    setEditFileType(detectDocumentFileType(file));
    e.target.value = "";
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc || !editFileName.trim()) return;

    setSavingEdit(true);
    setFeedback(null);
    try {
      if (replacementFile) {
        await teacherApi.replaceDocumentFile(editingDoc.id, replacementFile, {
          fileName: editFileName.trim(),
          fileType: editFileType,
        });
      } else {
        await teacherApi.updateDocument(editingDoc.id, {
          fileName: editFileName.trim(),
          fileType: editFileType,
        });
      }
      await onRefresh();
      setEditingDoc(null);
      setReplacementFile(null);
      setFeedback({
        type: "success",
        message: "Đã cập nhật tài liệu bài học.",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message || "Cập nhật tài liệu thất bại.",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (doc: LessonDocumentItem) => {
    if (!window.confirm(`Xóa tài liệu "${doc.fileName}"?`)) return;
    setFeedback(null);
    try {
      await teacherApi.deleteDocument(doc.id);
      if (previewDoc?.id === doc.id) {
        setPreviewDoc(null);
      }
      await onRefresh();
      setFeedback({
        type: "success",
        message: `Đã xóa tài liệu "${doc.fileName}".`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || "Xóa tài liệu thất bại.",
      });
    }
  };

  const renderDocIcon = (fileType: string) => {
    if (fileType === "IMAGE") {
      return <ImageIcon size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
    if (fileType === "AUDIO") {
      return <Volume2 size={18} className="text-sky-600 dark:text-sky-400 shrink-0" />;
    }
    return <FileText size={18} className="text-blue-700 dark:text-blue-400 shrink-0" />;
  };

  return (
    <div className="space-y-4">
      <input
        ref={uploadInputRef}
        type="file"
        onChange={handleUploadNew}
        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.ogg"
        className="hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Tài liệu đính kèm ({documents.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Xem trước, tải xuống, đổi tên hoặc thay thế file tài liệu của bài giảng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} />
          )}
          <span>{uploading ? "Đang tải lên..." : "Thêm tài liệu"}</span>
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
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0e1526] p-8 text-center">
          <FileText size={28} className="mx-auto text-slate-400 mb-2" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Bài giảng này chưa có tài liệu đính kèm.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {documents.map((doc) => {
            const sizeLabel = formatBytes(doc.fileSizeBytes);
            return (
              <div
                key={doc.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0e1526] p-3.5 hover:border-blue-300 dark:hover:border-blue-700 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {renderDocIcon(doc.fileType)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {doc.fileName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                        {doc.fileType}
                      </span>
                      {sizeLabel && (
                        <span className="font-mono tabular-nums">{sizeLabel}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>Xem</span>
                  </button>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 transition"
                  >
                    <Download size={13} />
                    <span>Tải</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => openEditModal(doc)}
                    aria-label={`Sửa tài liệu ${doc.fileName}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 transition cursor-pointer"
                  >
                    <Pencil size={13} />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    aria-label={`Xóa tài liệu ${doc.fileName}`}
                    className="inline-flex items-center justify-center rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 p-1.5 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Xem trước tài liệu */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-elevated overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
              <div className="flex items-center gap-2.5 min-w-0">
                {renderDocIcon(previewDoc.fileType)}
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {previewDoc.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewDoc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                >
                  <ExternalLink size={13} />
                  <span>Mở tab mới</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  aria-label="Đóng xem trước"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-auto flex-1">
              {previewDoc.fileType === "PDF" ? (
                <iframe
                  src={previewDoc.fileUrl}
                  title={previewDoc.fileName}
                  className="w-full h-[65vh] rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
                />
              ) : previewDoc.fileType === "IMAGE" ? (
                <img
                  src={previewDoc.fileUrl}
                  alt={previewDoc.fileName}
                  className="max-h-[65vh] mx-auto rounded-lg object-contain border border-slate-200 dark:border-slate-800"
                />
              ) : previewDoc.fileType === "AUDIO" ? (
                <div className="py-8 flex flex-col items-center gap-4">
                  <Volume2 size={36} className="text-blue-700 dark:text-blue-400" />
                  <audio controls src={previewDoc.fileUrl} className="w-full max-w-md" />
                </div>
              ) : (
                <div className="py-10 text-center space-y-3">
                  <FileText size={40} className="mx-auto text-blue-700 dark:text-blue-400" />
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Trình duyệt không hỗ trợ xem trực tiếp định dạng {previewDoc.fileType}.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bạn có thể tải file xuống hoặc mở ở tab mới để kiểm tra nội dung.
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <a
                      href={previewDoc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold transition"
                    >
                      <Download size={14} />
                      <span>Tải xuống {previewDoc.fileName}</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Chỉnh sửa tài liệu */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-elevated space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Chỉnh sửa tài liệu
              </h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                aria-label="Đóng hộp thoại sửa tài liệu"
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên hiển thị tài liệu
                </label>
                <input
                  type="text"
                  required
                  value={editFileName}
                  onChange={(e) => setEditFileName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Loại tài liệu
                </label>
                <select
                  value={editFileType}
                  onChange={(e) => setEditFileType(e.target.value as DocumentFileType)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                >
                  {FILE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Thay file mới (tùy chọn)
                </label>
                <input
                  ref={replaceFileInputRef}
                  type="file"
                  onChange={handleReplacementFilePicked}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.ogg"
                  className="hidden"
                />
                <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-2.5">
                  <span className="truncate text-slate-600 dark:text-slate-300">
                    {replacementFile
                      ? `${replacementFile.name} (${formatBytes(replacementFile.size)})`
                      : "Giữ file hiện tại nếu không chọn lại"}
                  </span>
                  <button
                    type="button"
                    onClick={() => replaceFileInputRef.current?.click()}
                    className="shrink-0 rounded-md border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 cursor-pointer"
                  >
                    Chọn file
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 px-4 py-2 font-semibold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {savingEdit && <Loader2 size={14} className="animate-spin" />}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
