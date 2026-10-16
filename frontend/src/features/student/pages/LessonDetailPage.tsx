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
        <div className="border border-zinc-200 bg-black rounded-md overflow-hidden aspect-video shadow-xs flex items-center justify-center">
          {video?.hlsPlaylistUrl ? (
            <VideoPlayer
              videoId={video.id}
              streamUrl={video.hlsPlaylistUrl}
              initialSeconds={progress?.watchedSeconds || 0}
            />
          ) : (
            <div className="text-zinc-400 text-xs flex flex-col items-center gap-2">
              <Play size={32} className="opacity-40" />
              <span>Chưa có video cho bài học này</span>
            </div>
          )}
        </div>

        <div className="border border-zinc-200 bg-white rounded-md shadow-sm">
          <div className="flex border-b border-zinc-200 px-4 bg-zinc-50/50">
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
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === tab.id
                    ? "border-zinc-900 text-zinc-900 bg-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-3">
                <h1 className="text-lg font-bold text-zinc-900">
                  {lesson.title}
                </h1>
                <p className="text-xs text-zinc-500 font-medium">
                  Mục tiêu bài học:{" "}
                  {lesson.objectives || "Nắm vững kiến thức trọng tâm"}
                </p>
                <div className="text-xs leading-relaxed text-zinc-700 whitespace-pre-line border-t border-zinc-100 pt-3">
                  {lesson.content || "Nội dung chi tiết đang được cập nhật."}
                </div>
              </div>
            )}
            {activeTab === "docs" && (
              <div className="space-y-2">
                {lesson.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between border border-zinc-200 p-3 rounded text-xs"
                  >
                    <div className="flex items-center gap-2 text-zinc-800 font-medium truncate">
                      <FileText size={16} className="text-zinc-500 shrink-0" />
                      <span className="truncate">{doc.fileName}</span>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 border border-zinc-300 hover:bg-zinc-50 px-2.5 py-1 rounded text-zinc-700 font-medium shrink-0"
                    >
                      <Download size={12} /> Tải
                    </a>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "vocab" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lesson.vocabularies.map((v) => (
                  <div
                    key={v.id}
                    className="border border-zinc-200 p-3 rounded"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-sm text-zinc-900">
                        {v.word}
                      </span>
                      {v.ipa && (
                        <span className="text-[11px] font-mono text-zinc-400">
                          /{v.ipa}/
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 mt-1">{v.meaning}</p>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "grammar" && (
              <div className="space-y-3">
                {lesson.grammarTopics.map((g) => (
                  <div
                    key={g.id}
                    className="border border-zinc-200 p-4 rounded space-y-2"
                  >
                    <h3 className="text-xs font-bold text-zinc-900">
                      {g.title}
                    </h3>
                    <p className="text-xs text-zinc-600">{g.ruleSummary}</p>
                    {g.formula && (
                      <div className="bg-zinc-50 p-2 rounded font-mono text-[11px] text-zinc-800 border border-zinc-200">
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

      {/* CỘT PHẢI: Danh Sách Bài Học */}
      <div className="lg:col-span-4 border border-zinc-200 bg-white rounded-md shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              Danh Sách Bài Học
            </h3>
            <span className="text-[11px] text-zinc-500">Khóa học hiện tại</span>
          </div>
          <span className="text-xs font-bold text-zinc-700 bg-zinc-200 px-2 py-0.5 rounded">
            {playlist.length} bài
          </span>
        </div>
        <div className="divide-y divide-zinc-100 max-h-[550px] overflow-y-auto">
          {playlist.map((item, idx) => {
            const isCurrent = item.id === lessonId;
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/student/lessons/${item.id}`)}
                className={`p-3.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                  isCurrent
                    ? "bg-zinc-900 text-white"
                    : "hover:bg-zinc-50 text-zinc-700"
                }`}
              >
                <div className="flex items-center gap-3 truncate pr-2">
                  <span
                    className={`text-[11px] font-bold ${
                      isCurrent ? "text-zinc-400" : "text-zinc-400"
                    }`}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium truncate">{item.title}</span>
                </div>
                {isCurrent ? (
                  <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-semibold shrink-0">
                    Đang xem
                  </span>
                ) : (
                  <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* NÚT CHUYỂN NHANH SANG BÀI TẬP HÀNG NGÀY (DAILY PLAN) */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50">
          <button
            onClick={() =>
              navigate(`/student/courses/${lesson.classId}/daily-plan`)
            }
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Calendar size={15} />
            <span>Bài Tập Hàng Ngày (Daily Plan)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
