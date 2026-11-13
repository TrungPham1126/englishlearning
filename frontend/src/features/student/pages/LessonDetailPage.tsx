// src/features/student/pages/LessonDetailPage.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "../api/studentApi";
import VideoPlayer from "../components/VideoPlayer";
import type {
  LessonDetailResponse,
  VideoResponse,
  VideoWatchHistory,
  LessonSummary,
} from "../types";
import { Play, FileText, ChevronRight, Download, Calendar, CheckCircle2, Clock } from "lucide-react";

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

  // Stable initial seek seconds to prevent re-seek loop
  const initialSeekSecondsRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchLessonData = () => {
    if (!lessonId) return;
    const requestId = ++latestRequestIdRef.current;
    Promise.all([
      studentApi.getLessonDetail(lessonId),
      studentApi.getVideoByLesson(lessonId).catch(() => null),
    ])
      .then(async ([lessonData, videoData]) => {
        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) return;
        setLesson(lessonData);
        setVideo(videoData);
        if (lessonData?.classId) {
          const classLessons = await studentApi
            .getClassLessons(lessonData.classId)
            .catch(() => []);
          if (!isMountedRef.current || requestId !== latestRequestIdRef.current) return;
          setPlaylist(classLessons);
        }
        if (videoData?.id) {
          const prog = await studentApi
            .getVideoProgress(videoData.id)
            .catch(() => null);
          if (!isMountedRef.current || requestId !== latestRequestIdRef.current) return;
          setProgress(prog);
          if (initialSeekSecondsRef.current === null) {
            initialSeekSecondsRef.current = prog?.watchedSeconds ?? lessonData?.watchedSeconds ?? 0;
          }
        } else if (initialSeekSecondsRef.current === null && lessonData?.watchedSeconds != null) {
          initialSeekSecondsRef.current = lessonData.watchedSeconds;
        }
      })
      .catch((err) => {
        console.error("Lỗi tải chi tiết bài học:", err);
      })
      .finally(() => {
        if (isMountedRef.current && requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    initialSeekSecondsRef.current = null;
    setLoading(true);
    fetchLessonData();
  }, [lessonId]);

  useEffect(() => {
    const handleProgressUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{
        videoId: string;
        completed: boolean;
        watchedSeconds: number;
      }>;
      if (customEvent.detail && customEvent.detail.videoId === video?.id) {
        setProgress({
          watchedSeconds: customEvent.detail.watchedSeconds,
          completed: customEvent.detail.completed,
        });
      }
    };
    window.addEventListener("student-progress-updated", handleProgressUpdate);

    return () => {
      window.removeEventListener("student-progress-updated", handleProgressUpdate);
    };
  }, [video?.id]);

  if (loading || !lesson) {
    return (
      <div className="p-8 text-sm font-medium text-slate-500">
        Đang tải...
      </div>
    );
  }

  const isCompleted =
    lesson.completed ||
    (lesson.progressPercentage ?? 0) >= 100 ||
    progress?.completed;

  const currentWatchedSeconds = progress?.watchedSeconds ?? lesson.watchedSeconds ?? 0;

  return (
    <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* CỘT TRÁI: Video Player + Tab Content */}
      <div className="lg:col-span-8 space-y-4">
        {video?.hlsPlaylistUrl ? (
          <VideoPlayer
            videoId={video.id}
            streamUrl={video.hlsPlaylistUrl}
            initialSeconds={initialSeekSecondsRef.current ?? 0}
          />
        ) : (
          <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-slate-300 mb-2 border border-white/10">
              <Play size={22} className="translate-x-0.5 text-slate-300" />
            </div>
            <span className="text-slate-300 font-medium text-sm">
              Chưa có video
            </span>
          </div>
        )}

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] rounded-xl overflow-hidden transition-colors">
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-3 bg-slate-50/50 dark:bg-slate-900/40 overflow-x-auto">
            {[
              { id: "overview", label: "Tổng quan" },
              { id: "docs", label: `Tài liệu (${lesson.documents.length})` },
              { id: "vocab", label: `Từ vựng (${lesson.vocabularies.length})` },
              {
                id: "grammar",
                label: `Ngữ pháp (${lesson.grammarTopics.length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 px-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-[#111827]"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === "overview" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                    {lesson.title}
                  </h1>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 text-[11px] font-bold">
                      <CheckCircle2 size={12} /> Xong
                    </span>
                  ) : currentWatchedSeconds > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 px-2 py-0.5 text-[11px] font-bold tabular-nums">
                      <Clock size={12} /> {Math.floor(currentWatchedSeconds / 60)}:{String(currentWatchedSeconds % 60).padStart(2, "0")}
                    </span>
                  ) : null}
                </div>
                {lesson.objectives && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {lesson.objectives}
                  </p>
                )}
                {lesson.content && (
                  <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line border-t border-slate-100 dark:border-slate-800 pt-3">
                    {lesson.content}
                  </div>
                )}
              </div>
            )}
            {activeTab === "docs" && (
              <div className="space-y-2">
                {lesson.documents.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Chưa có tài liệu.</p>
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
                  <p className="text-xs text-slate-500 py-2 col-span-2">Chưa có từ vựng.</p>
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
                  <p className="text-xs text-slate-500 py-2">Chưa có ngữ pháp.</p>
                ) : (
                  lesson.grammarTopics.map((g) => (
                    <div
                      key={g.id}
                      className="border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-2 bg-slate-50/50 dark:bg-slate-900/30"
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
      <div className="lg:col-span-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 overflow-hidden flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
            Bài học
          </h3>
          <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            {playlist.length}
          </span>
        </div>

        <div className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
          {playlist.map((item, idx) => {
            const isCurrent = item.id === lessonId;
            const itemDone = item.completed || item.isCompleted || (item.progressPercentage ?? 0) >= 100;

            return (
              <div
                key={item.id}
                onClick={() => navigate(`/student/lessons/${item.id}`)}
                className={`p-2.5 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-colors ${
                  isCurrent
                    ? "bg-blue-50 dark:bg-slate-900/40 border border-blue-700 dark:border-blue-500"
                    : "bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate pr-2">
                  <span
                    className={
                      isCurrent
                        ? "text-blue-700 dark:text-blue-400 font-extrabold text-sm tabular-nums"
                        : "text-slate-400 dark:text-slate-500 font-semibold text-sm tabular-nums"
                    }
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={
                      isCurrent
                        ? "text-blue-950 dark:text-blue-100 font-bold text-sm truncate"
                        : "font-medium truncate"
                    }
                  >
                    {item.title}
                  </span>
                </div>
                {itemDone ? (
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                ) : isCurrent ? (
                  <span className="bg-blue-700 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0">
                    Đang xem
                  </span>
                ) : (
                  <ChevronRight size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {lesson?.classId && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <button
              onClick={() =>
                navigate(`/student/courses/${lesson.classId}/daily-plan`)
              }
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <Calendar size={15} />
              <span>Lộ trình ngày</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
