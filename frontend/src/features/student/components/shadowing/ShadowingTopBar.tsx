// src/features/student/components/shadowing/ShadowingTopBar.tsx
import { memo } from "react";
import { ArrowLeft, Mic, RotateCcw } from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import {
  usePracticeStore,
  type ShadowingPracticeMode,
} from "@/store/usePracticeStore";

export interface ShadowingTopBarProps {
  readonly currentStep?: number;
  readonly totalSteps?: number;
  readonly onBack?: () => void;
  readonly onChangeSpeed: (speed: number) => void;
  readonly onRepairAudio: () => void;
}

export const ShadowingTopBar = memo<ShadowingTopBarProps>(
  function ShadowingTopBar({
    currentStep = 1,
    totalSteps = 1,
    onBack,
    onChangeSpeed,
    onRepairAudio,
  }) {
    // Selective subscriptions: Không bao giờ re-render khi sóng âm 60fps cập nhật
    const practiceMode = usePracticeStore((s) => s.practiceMode);
    const setPracticeMode = usePracticeStore((s) => s.setPracticeMode);

    const playbackSpeed = useAudioStore((s) => s.playbackSpeed);
    const isRepairingNative = useAudioStore((s) => s.isRepairingNative);
    const isSynthesizingNative = useAudioStore((s) => s.isSynthesizingNative);

    const progressPercent =
      totalSteps > 0
        ? Math.min(100, Math.round((currentStep / totalSteps) * 100))
        : 100;

    const handleSelectMode = (mode: ShadowingPracticeMode) => {
      setPracticeMode(mode);
    };

    return (
      <header
        aria-label="Thanh tiến trình và cấu hình chế độ luyện phát âm"
        className="w-full flex flex-col gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800"
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Nút Back + Tiêu đề */}
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Quay lại trang trước"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-600/15 border border-blue-200 dark:border-blue-600/30 text-blue-700 dark:text-blue-400">
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white">
                  Luyện Phát Âm & Shadowing
                </h3>
                <span className="text-[9px] uppercase bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 px-1.5 py-0.2 rounded font-bold border border-blue-200 dark:border-blue-600/30">
                  {practiceMode === "shadowing"
                    ? "Đọc Đuổi (Shadowing)"
                    : "Đọc Đơn (Normal)"}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Phím tắt: <kbd className="font-mono font-bold">Space</kbd>{" "}
                để Thu/Dừng • <kbd className="font-mono font-bold">R</kbd>{" "}
                để Nghe lại mẫu
              </p>
            </div>
          </div>

          {/* Công cụ điều khiển: Chế độ, Tốc độ, Tạo lại mẫu & BẢNG QUY ƯỚC MÀU CHỈ 1 LẦN Ở TRÊN */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Hướng dẫn phân biệt màu sắc duy nhất 1 lần ở trên */}
            <div
              role="list"
              aria-label="Chú giải màu trạng thái phát âm"
              className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700"
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mr-0.5">
                Màu sắc:
              </span>
              <span role="listitem" className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-emerald-500"
                />
                <span>Chuẩn (✓)</span>
              </span>
              <span role="listitem" className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-amber-500"
                />
                <span>Cần cải thiện (~)</span>
              </span>
              <span role="listitem" className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-rose-500"
                />
                <span>Phát âm sai (!)</span>
              </span>
              <span role="listitem" className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-slate-400"
                />
                <span>Chưa đọc</span>
              </span>
            </div>

            {/* Chuyển đổi chế độ Shadowing / Normal */}
            <div
              role="radiogroup"
              aria-label="Chọn chế độ luyện phát âm"
              className="inline-flex p-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <button
                type="button"
                role="radio"
                aria-checked={practiceMode === "shadowing"}
                onClick={() => handleSelectMode("shadowing")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  practiceMode === "shadowing"
                    ? "bg-blue-800 text-white shadow-2xs"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Shadowing
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={practiceMode === "normal"}
                onClick={() => handleSelectMode("normal")}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  practiceMode === "normal"
                    ? "bg-blue-800 text-white shadow-2xs"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Normal
              </button>
            </div>

            {/* Tốc độ phát mẫu */}
            <div
              role="group"
              aria-label="Chọn tốc độ phát âm mẫu"
              className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700"
            >
              {[0.75, 1.0, 1.25].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onChangeSpeed(spd)}
                  aria-pressed={playbackSpeed === spd}
                  aria-label={`Tốc độ phát ${spd}x`}
                  className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    playbackSpeed === spd
                      ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Nút tái tạo Audio Self-healing */}
            <button
              type="button"
              onClick={onRepairAudio}
              disabled={isRepairingNative || isSynthesizingNative}
              aria-label="Tạo lại âm thanh mẫu trên máy chủ nếu gặp sự cố"
              title="Tự sửa lỗi: Tái tạo âm thanh mẫu trên máy chủ"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <RotateCcw
                aria-hidden="true"
                className={`h-3 w-3 ${
                  isRepairingNative ? "animate-spin text-amber-500" : ""
                }`}
              />
              <span className="hidden sm:inline">
                {isRepairingNative ? "Đang tạo..." : "Tạo lại mẫu"}
              </span>
            </button>
          </div>
        </div>

        {/* Thanh tiến trình bài học */}
        <div className="w-full flex items-center gap-2">
          <div
            role="progressbar"
            aria-label="Tiến trình câu luyện tập"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
          >
            <div
              className="h-full bg-blue-800 dark:bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
            Tiến độ: {progressPercent}%
          </span>
        </div>
      </header>
    );
  },
);
