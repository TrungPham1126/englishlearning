// src/features/student/pages/LessonDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "../api/studentApi";
import VideoPlayer from "../components/VideoPlayer";
import type {
  LessonDetailResponse,
  VideoResponse,
  VideoWatchHistory,
  LessonSummary,
} from "../types";
import { Play, FileText, ChevronRight, Download, Calendar } from "lucide-react";

export default function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<LessonDetailResponse | null>(null);
  const [playlist, setPlaylist] = useState<LessonSummary[]>([]);
  const [video, setVideo] = useState<VideoResponse | null>(null);
  const [progress, setProgress] = useState<VideoWatchHistory | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "docs" | "vocab" | "grammar"
  >("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lessonId) return;
    Promise.all([
      studentApi.getLessonDetail(lessonId),
      studentApi.getVideoByLesson(lessonId).catch(() => null),
    ])
      .then(async ([lessonData, videoData]) => {
        setLesson(lessonData);
        setVideo(videoData);
        if (lessonData?.classId) {
          const classLessons = await studentApi
            .getClassLessons(lessonData.classId)
            .catch(() => []);
          setPlaylist(classLessons);
        }
        if (videoData?.id) {
          const prog = await studentApi
            .getVideoProgress(videoData.id)
            .catch(() => null);
          setProgress(prog);
        }
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (loading || !lesson) {
    return (
      <div className="p-8 text-sm font-medium text-zinc-500">
        Đang tải nội dung bài giảng...
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* CỘT TRÁI: Video Player + Tab Content */}
      <div className="lg:col-span-8 space-y-4">
        <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
          {video?.hlsPlaylistUrl ? (
            <VideoPlayer
              videoId={video.id}
              streamUrl={video.hlsPlaylistUrl}
              initialSeconds={progress?.watchedSeconds || 0}
            />
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-slate-300 mb-3 border border-white/10 shadow-inner">
                <Play size={24} className="translate-x-0.5 fill-slate-300/20 text-slate-300" />
              </div>
              <span className="text-slate-300 font-medium text-sm">
                Chưa có video cho bài học này
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Giảng viên chưa tải lên video bài giảng. Vui lòng xem tài liệu hoặc làm bài tập bên dưới.
              </p>
            </div>
          )}
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] rounded-2xl shadow-sm overflow-hidden transition-colors">
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50/50 dark:bg-slate-900/40">
            {[
              { id: "overview", label: "Tổng Quan" },
              { id: "docs", label: `Tài Liệu (${lesson.documents.length})` },
              { id: "vocab", label: `Từ Vựng (${lesson.vocabularies.length})` },
              {
                id: "grammar",
                label: `Ngữ Pháp (${lesson.grammarTopics.length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-white dark:bg-[#111827]"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-3">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lesson.title}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Mục tiêu bài học:{" "}
                  {lesson.objectives || "Nắm vững kiến thức trọng tâm"}
                </p>
                <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line border-t border-slate-100 dark:border-slate-800 pt-3">
                  {lesson.content || "Nội dung chi tiết đang được cập nhật."}
                </div>
              </div>
            )}
            {activeTab === "docs" && (
              <div className="space-y-2">
                {lesson.documents.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">Chưa có tài liệu đính kèm cho bài học này.</p>
                ) : (
                  lesson.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs bg-slate-50/50 dark:bg-slate-900/30"
                    >
                      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium truncate">
                        <FileText size={16} className="text-slate-400 shrink-0" />
                        <span className="truncate">{doc.fileName}</span>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 font-medium shrink-0 transition-colors"
                      >
                        <Download size={12} /> Tải
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === "vocab" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lesson.vocabularies.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 col-span-2">Chưa có danh sách từ vựng cho bài học này.</p>
                ) : (
                  lesson.vocabularies.map((v) => (
                    <div
                      key={v.id}
                      className="border border-slate-200 dark:border-slate-800 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {v.word}
                        </span>
                        {v.ipa && (
                          <span className="text-[11px] font-mono text-slate-400">
                            /{v.ipa}/
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{v.meaning}</p>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === "grammar" && (
              <div className="space-y-3">
                {lesson.grammarTopics.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">Chưa có chủ điểm ngữ pháp cho bài học này.</p>
                ) : (
                  lesson.grammarTopics.map((g) => (
                    <div
                      key={g.id}
                      className="border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2 bg-slate-50/50 dark:bg-slate-900/30"
                    >
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        {g.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{g.ruleSummary}</p>
                      {g.formula && (
                        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg font-mono text-[11px] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                          {g.formula}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CỘT PHẢI: Danh Sách Bài Học */}
      <div className="lg:col-span-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm overflow-hidden flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Danh Sách Bài Học
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Khóa học hiện tại</span>
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            {playlist.length} bài
          </span>
        </div>

        <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
          {playlist.map((item, idx) => {
            const isCurrent = item.id === lessonId;
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/student/lessons/${item.id}`)}
                className={`p-3 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-all duration-150 ${
                  isCurrent
                    ? "bg-indigo-50 dark:bg-indigo-950/40 border-l-4 border-indigo-600 dark:border-indigo-400 border-y border-r border-indigo-200 dark:border-indigo-800/60 shadow-sm"
                    : "bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                }`}
              >
                <div className="flex items-center gap-3 truncate pr-2">
                  <span
                    className={
                      isCurrent
                        ? "text-indigo-600 dark:text-indigo-400 font-extrabold text-sm"
                        : "text-slate-400 dark:text-slate-500 font-semibold text-sm"
                    }
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={
                      isCurrent
                        ? "text-indigo-950 dark:text-indigo-100 font-bold text-sm tracking-tight truncate"
                        : "font-medium truncate"
                    }
                  >
                    {item.title}
                  </span>
                </div>
                {isCurrent ? (
                  <span className="bg-indigo-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm shrink-0">
                    Đang xem
                  </span>
                ) : (
                  <ChevronRight size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* NÚT CHUYỂN NHANH SANG BÀI TẬP HÀNG NGÀY (DAILY PLAN) */}
        {lesson?.classId && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <button
              onClick={() =>
                navigate(`/student/courses/${lesson.classId}/daily-plan`)
              }
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Calendar size={15} />
              <span>Bài Tập Hàng Ngày (Daily Plan)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
