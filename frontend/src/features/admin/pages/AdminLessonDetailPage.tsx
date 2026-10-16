// src/features/admin/pages/AdminLessonDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { adminApi } from "@/features/admin/api/adminApi";
import {
  Play,
  FileText,
  ChevronRight,
  Download,
  BookOpen,
  ArrowLeft,
  Loader2,
  Trash2,
} from "lucide-react";

export default function AdminLessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<any>(null);
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [video, setVideo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "docs" | "vocab" | "grammar"
  >("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lessonId) return;
    setLoading(true);

    Promise.all([
      adminApi.getLessonDetail(lessonId),
      adminApi.getVideoByLesson(lessonId).catch(() => null),
    ])
      .then(async ([lessonData, videoData]) => {
        setLesson(lessonData);
        setVideo(videoData);

        // Load danh sách bài giảng (Playlist) bên phải
        if (lessonData?.classId) {
          const classLessons = await adminApi
            .getLessonsByClass(lessonData.classId)
            .catch(() => []);
          setPlaylist(
            classLessons.sort((a: any, b: any) => a.orderIndex - b.orderIndex),
          );
        }
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (loading || !lesson) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 font-semibold gap-3">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <span>Đang tải nội dung bài giảng...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Header Quay lại */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 cursor-pointer transition"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Góc Nhìn Học Viên: {lesson.title}
          </h1>
          <p className="text-xs font-semibold text-emerald-600 mt-0.5">
            Bạn đang xem trước bài giảng giống hệt những gì học viên sẽ thấy.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: Video Player + Tab Content */}
        <div className="lg:col-span-8 space-y-4">
          <div className="border border-slate-200 bg-black rounded-xl overflow-hidden aspect-video shadow-sm flex items-center justify-center relative">
            {video?.hlsPlaylistUrl ? (
              // Sử dụng thẻ video chuẩn để tránh gọi API update progress của học viên
              <video
                src={video.hlsPlaylistUrl}
                controls
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="text-slate-400 text-sm font-semibold flex flex-col items-center gap-3">
                <Play size={48} className="opacity-40" />
                <span>Bài giảng này chưa có Video bài giảng</span>
              </div>
            )}
            <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded shadow-lg border border-white">
              Giao diện Xem Trước
            </div>
          </div>

          <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-200 px-4 bg-slate-50 overflow-x-auto">
              {[
                { id: "overview", label: "Tổng Quan" },
                {
                  id: "docs",
                  label: `Tài Liệu (${lesson.documents?.length || 0})`,
                },
                {
                  id: "vocab",
                  label: `Từ Vựng (${lesson.vocabularies?.length || 0})`,
                },
                {
                  id: "grammar",
                  label: `Ngữ Pháp (${lesson.grammarTopics?.length || 0})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-indigo-600 text-indigo-700 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8">
              {activeTab === "overview" && (
                <div className="space-y-3">
                  <h2 className="text-xl font-black text-slate-900">
                    {lesson.title}
                  </h2>
                  <p className="text-sm text-slate-600 font-medium">
                    Mục tiêu bài học: {lesson.objectives || "Đang cập nhật."}
                  </p>
                  <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-line border-t border-slate-100 pt-4 mt-4">
                    {lesson.content || "Nội dung chi tiết đang được cập nhật."}
                  </div>
                </div>
              )}

              {activeTab === "docs" && (
                <div className="space-y-3">
                  {lesson.documents?.length === 0 && (
                    <p className="text-sm text-slate-500 italic">
                      Chưa có tài liệu đính kèm.
                    </p>
                  )}
                  {lesson.documents?.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between border-2 border-slate-100 p-4 rounded-xl hover:border-indigo-200 transition"
                    >
                      <div className="flex items-center gap-3 text-slate-800 font-bold truncate">
                        <FileText
                          size={20}
                          className="text-indigo-500 shrink-0"
                        />
                        <span className="truncate text-sm">{doc.fileName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-bold text-xs transition"
                        >
                          <Download size={14} /> Tải Xuống
                        </a>
                        <button
                          onClick={async () => {
                            if (window.confirm("Bạn có chắc muốn xóa tài liệu này?")) {
                              try {
                                await adminApi.deleteDocument(doc.id);
                                window.location.reload();
                              } catch {
                                alert("Xóa thất bại!");
                              }
                            }
                          }}
                          className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "vocab" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lesson.vocabularies?.length === 0 && (
                    <p className="text-sm text-slate-500 italic">
                      Chưa có từ vựng nào.
                    </p>
                  )}
                  {lesson.vocabularies?.map((v: any) => (
                    <div
                      key={v.id}
                      className="border-2 border-slate-100 bg-slate-50 p-4 rounded-xl"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-black text-lg text-slate-900">
                          {v.word}
                        </span>
                        {v.ipa && (
                          <span className="text-xs font-mono text-slate-500">
                            /{v.ipa}/
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-indigo-700 mt-1">
                        {v.meaning}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "grammar" && (
                <div className="space-y-4">
                  {lesson.grammarTopics?.length === 0 && (
                    <p className="text-sm text-slate-500 italic">
                      Chưa có ngữ pháp nào.
                    </p>
                  )}
                  {lesson.grammarTopics?.map((g: any) => (
                    <div
                      key={g.id}
                      className="border-2 border-slate-100 p-5 rounded-xl space-y-2"
                    >
                      <h3 className="text-sm font-black text-slate-900">
                        {g.title}
                      </h3>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        {g.ruleSummary}
                      </p>
                      {g.formula && (
                        <div className="bg-indigo-50 p-3 rounded-lg font-mono text-sm font-bold text-indigo-800 border border-indigo-100 mt-2">
                          {g.formula}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: Danh Sách Bài Học (Playlist) */}
        <div className="lg:col-span-4 border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col sticky top-24">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <BookOpen size={18} className="text-indigo-600" /> Danh Sách Bài
              Giảng
            </h3>
            <span className="text-xs font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
              {playlist.length} bài
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {playlist.map((item, idx) => {
              const isCurrent = item.id === lessonId;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/admin/lessons/${item.id}`)}
                  className={`p-4 flex items-center justify-between cursor-pointer transition-all ${
                    isCurrent
                      ? "bg-indigo-600 text-white"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate pr-4">
                    <span
                      className={`text-xs font-black ${isCurrent ? "text-indigo-300" : "text-slate-400"}`}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="font-bold truncate text-sm">
                      {item.title}
                    </span>
                  </div>
                  {isCurrent ? (
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-black tracking-widest uppercase shrink-0">
                      ĐANG XEM
                    </span>
                  ) : (
                    <ChevronRight
                      size={16}
                      className="text-slate-300 shrink-0"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
