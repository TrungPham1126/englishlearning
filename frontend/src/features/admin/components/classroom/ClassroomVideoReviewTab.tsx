import React, { useState } from "react";
import { CheckCircle, PlayCircle, FileVideo, XCircle } from "lucide-react";
import VideoPlayer from "@/features/student/components/VideoPlayer";

interface ClassroomVideoReviewTabProps {
  pendingVideos: any[];
  isProcessing: boolean;
  onApproveVideo: (id: string) => void;
  onRejectVideo: (id: string, reason: string) => Promise<boolean>;
}

export const ClassroomVideoReviewTab: React.FC<ClassroomVideoReviewTabProps> = ({
  pendingVideos,
  isProcessing,
  onApproveVideo,
  onRejectVideo,
}) => {
  const [rejectingVideoId, setRejectingVideoId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingVideoId || !rejectReason.trim()) return;
    const success = await onRejectVideo(rejectingVideoId, rejectReason);
    if (success) {
      setRejectingVideoId(null);
      setRejectReason("");
    }
  };

  return (
    <div className="space-y-6">
      {pendingVideos.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-16 rounded-xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
          <CheckCircle size={56} className="text-emerald-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Không có video nào cần duyệt.
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pendingVideos.map((vid) => (
            <div
              key={vid.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="bg-black aspect-video relative flex items-center justify-center">
                {vid.hlsPlaylistUrl ? (
                  <VideoPlayer
                    videoId={vid.id}
                    streamUrl={vid.hlsPlaylistUrl}
                    enableProgressSync={false}
                  />
                ) : (
                  <div className="text-white/50 flex flex-col items-center">
                    <PlayCircle size={40} />
                    <span className="mt-2 text-xs">Video lỗi</span>
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                  <FileVideo className="text-rose-500 shrink-0" size={18} />
                  <span>{vid.originalFileName}</span>
                </h3>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <button
                    onClick={() => onApproveVideo(vid.id)}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold cursor-pointer disabled:opacity-50 transition"
                  >
                    <CheckCircle size={16} /> Phê Duyệt
                  </button>
                  <button
                    onClick={() => setRejectingVideoId(vid.id)}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-4 py-2.5 rounded-xl font-bold cursor-pointer border border-rose-200 dark:border-rose-800 disabled:opacity-50 transition"
                  >
                    <XCircle size={16} /> Từ Chối
                  </button>
                </div>
                {rejectingVideoId === vid.id && (
                  <form
                    onSubmit={handleRejectSubmit}
                    className="mt-4 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-xl space-y-3"
                  >
                    <textarea
                      required
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full text-sm p-2.5 border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      placeholder="Lý do từ chối..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRejectingVideoId(null)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isProcessing}
                        className="px-4 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg cursor-pointer hover:bg-rose-500"
                      >
                        Gửi
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClassroomVideoReviewTab;
