// src/features/student/components/shadowing/GoogleMouthAnimation.tsx
import { memo } from "react";
import type { MouthShapeType } from "@/features/student/utils/ipaDictionary";

export interface GoogleMouthAnimationProps {
  readonly isPlaying: boolean;
  readonly isSlow: boolean;
  readonly mouthShape: MouthShapeType;
  readonly word: string;
  readonly className?: string;
  readonly onPlay?: () => void;
}

/**
 * Component mô phỏng Khẩu hình Động (Mouth & Face Animation) chuẩn phong cách Google Search Pronunciation.
 * Thiết kế mặt chính diện (Frontal view) với nền xanh nhạt bo góc, viền cằm, mũi chữ V,
 * viền môi xanh và khoang miệng chuyển động mượt mà theo từng âm vị (IPA).
 * Học sinh có thể xem trực tiếp khẩu hình cử động tại chỗ mà không cần mở link Google.
 */
export const GoogleMouthAnimation = memo<GoogleMouthAnimationProps>(
  function GoogleMouthAnimation({
    isPlaying,
    isSlow,
    mouthShape,
    word,
    className = "",
    onPlay,
  }) {
    // Tốc độ chuyển động: Chậm (1.4s) hoặc Bình thường (0.75s)
    const animDuration = isSlow ? "1.4s" : "0.75s";

    // Tính toán độ mở và hình dạng của môi theo loại âm vị
    const isRounded = mouthShape === "ROUNDED";
    const isOpen = mouthShape === "OPEN_WIDE";
    const isWide = mouthShape === "SPREAD";
    const isDental = mouthShape === "INTERDENTAL";
    const isLabiodental = mouthShape === "LABIODENTAL";

    return (
      <div
        className={`relative flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs select-none ${className}`}
      >
        {/* Header trạng thái */}
        <div className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isPlaying
                  ? "bg-emerald-500 animate-ping"
                  : "bg-blue-600 dark:bg-blue-400"
              }`}
            />
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {isPlaying ? "Đang chuyển động khẩu hình..." : "Khẩu hình chuẩn Google"}
            </span>
          </div>

          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-bold">
            {isSlow ? "Chậm 0.6x" : "Chuẩn 1.0x"}
          </span>
        </div>

        {/* Khung Khẩu hình Google chuẩn (Frontal View - Mặt chính diện) */}
        <div
          role="button"
          tabIndex={0}
          onClick={onPlay}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPlay?.();
            }
          }}
          className={`relative w-44 h-44 sm:w-48 sm:h-48 rounded-3xl overflow-hidden flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-95 shadow-inner ${
            isPlaying ? "ring-2 ring-blue-500/50" : ""
          }`}
          style={{ backgroundColor: "#DDE9F8" }}
          title="Chạm vào để nghe phát âm & xem chuyển động môi"
          aria-label={`Khẩu hình phát âm Google từ ${word}`}
        >
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full drop-shadow-xs"
            aria-hidden="true"
          >
            <defs>
              {/* Gradient khoang miệng bên trong */}
              <radialGradient id="innerMouthDarkGg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#2c1810" />
                <stop offset="85%" stopColor="#1a0b08" />
                <stop offset="100%" stopColor="#0d0403" />
              </radialGradient>

              {/* Gradient lưỡi */}
              <linearGradient id="tongueGradGg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>

              {/* Gradient răng */}
              <linearGradient id="teethGradGg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>

            {/* 1. Đáy mũi (Nose Base): Nét chữ V màu xanh Google chuẩn xác */}
            <path
              d="M 85 40 L 100 52 L 115 40"
              fill="none"
              stroke="#1A73E8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 2. Đường viền cằm dưới (Chin contour): Nét vòng cung xanh nối liền */}
            <path
              d="M 22 96 C 42 165 158 165 178 96"
              fill="none"
              stroke="#1A73E8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* 3. Khoang miệng & Lưỡi & Răng khi audio phát âm */}
            {isPlaying ? (
              <g>
                {/* Khoang miệng mở động */}
                {isRounded ? (
                  // Khẩu hình chu tròn (o, u, w)
                  <ellipse
                    cx="100"
                    cy="95"
                    rx="18"
                    ry="16"
                    fill="url(#innerMouthDarkGg)"
                  >
                    <animate
                      attributeName="rx"
                      values="12;20;14;18;12"
                      dur={animDuration}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="ry"
                      values="10;18;12;16;10"
                      dur={animDuration}
                      repeatCount="indefinite"
                    />
                  </ellipse>
                ) : isOpen ? (
                  // Khẩu hình mở lớn (a, ah)
                  <path
                    d="M 64 94 Q 100 78 136 94 Q 100 126 64 94 Z"
                    fill="url(#innerMouthDarkGg)"
                  >
                    <animate
                      attributeName="d"
                      values="M 64 94 Q 100 86 136 94 Q 100 106 64 94 Z; M 60 94 Q 100 72 140 94 Q 100 132 60 94 Z; M 64 94 Q 100 86 136 94 Q 100 106 64 94 Z"
                      dur={animDuration}
                      repeatCount="indefinite"
                    />
                  </path>
                ) : isLabiodental ? (
                  // Khẩu hình răng môi: Răng trên chạm nhẹ viền môi dưới (/f/, /v/)
                  <path
                    d="M 62 94 Q 100 88 138 94 Q 100 106 62 94 Z"
                    fill="url(#innerMouthDarkGg)"
                  >
                    <animate
                      attributeName="d"
                      values="M 64 94 Q 100 90 136 94 Q 100 102 64 94 Z; M 60 94 Q 100 84 140 94 Q 100 110 60 94 Z; M 64 94 Q 100 90 136 94 Q 100 102 64 94 Z"
                      dur={animDuration}
                      repeatCount="indefinite"
                    />
                  </path>
                ) : isWide ? (
                  // Khẩu hình căng bè (ee, i)
                  <path
                    d="M 56 94 Q 100 85 144 94 Q 100 110 56 94 Z"
                    fill="url(#innerMouthDarkGg)"
                  >
                    <animate
                      attributeName="d"
                      values="M 60 94 Q 100 89 140 94 Q 100 103 60 94 Z; M 52 94 Q 100 82 148 94 Q 100 114 52 94 Z; M 60 94 Q 100 89 140 94 Q 100 103 60 94 Z"
                      dur={animDuration}
                      repeatCount="indefinite"
                    />
                  </path>
                ) : (
                  // Mặc định hoặc phụ âm đóng
                  <path
                    d="M 62 94 Q 100 84 138 94 Q 100 114 62 94 Z"
                    fill="url(#innerMouthDarkGg)"
                  >
                    <animate
                      attributeName="d"
                      values="M 66 94 Q 100 90 134 94 Q 100 102 66 94 Z; M 60 94 Q 100 80 140 94 Q 100 118 60 94 Z; M 66 94 Q 100 90 134 94 Q 100 102 66 94 Z"
                      dur={animDuration}
                      repeatCount="indefinite"
                    />
                  </path>
                )}

                {/* Hàm răng trên */}
                <rect
                  x="80"
                  y="85"
                  width="40"
                  height="4.5"
                  rx="1"
                  fill="url(#teethGradGg)"
                  opacity="0.95"
                />

                {/* Đầu lưỡi di chuyển */}
                {isDental ? (
                  // Đầu lưỡi đặt giữa 2 răng (th /θ/, /ð/)
                  <ellipse
                    cx="100"
                    cy="93"
                    rx="14"
                    ry="6"
                    fill="url(#tongueGradGg)"
                  >
                    <animate
                      attributeName="cy"
                      values="95;91;95"
                      dur={animDuration}
                      repeatCount="indefinite"
                    />
                  </ellipse>
                ) : (
                  // Lưỡi nằm ở đáy miệng
                  <path
                    d="M 82 102 Q 100 96 118 102 Q 100 112 82 102 Z"
                    fill="url(#tongueGradGg)"
                  >
                    <animate
                      attributeName="d"
                      values="M 82 102 Q 100 99 118 102 Q 100 110 82 102 Z; M 80 98 Q 100 91 120 98 Q 100 114 80 98 Z; M 82 102 Q 100 99 118 102 Q 100 110 82 102 Z"
                      dur={animDuration}
                      repeatCount="indefinite"
                    />
                  </path>
                )}

                {/* Viền môi trên khi chuyển động */}
                <path
                  d="M 58 94 Q 80 80 100 85 Q 120 80 142 94"
                  fill="none"
                  stroke="#1A73E8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Viền môi dưới khi chuyển động */}
                <path
                  d="M 58 94 Q 100 118 142 94"
                  fill="none"
                  stroke="#1A73E8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </g>
            ) : (
              /* Trạng thái tĩnh (Mouth Closed): Nét viền môi chuẩn xác của Google */
              <g>
                {/* Viền môi trên màu xanh */}
                <path
                  d="M 58 94 Q 80 82 100 86 Q 120 82 142 94"
                  fill="none"
                  stroke="#1A73E8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Đường kẽ môi khép kín màu tối (#202124) */}
                <line
                  x1="58"
                  y1="94"
                  x2="142"
                  y2="94"
                  stroke="#202124"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Viền môi dưới màu xanh */}
                <path
                  d="M 58 94 Q 100 110 142 94"
                  fill="none"
                  stroke="#1A73E8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Nút Play tròn mờ chính giữa miệng phong cách Google (như hình mẫu) */}
                <g className="transition-opacity duration-200 hover:opacity-100 opacity-80">
                  <circle
                    cx="100"
                    cy="94"
                    r="24"
                    fill="rgba(66, 133, 244, 0.22)"
                  />
                  <circle
                    cx="100"
                    cy="94"
                    r="19"
                    fill="rgba(255, 255, 255, 0.65)"
                  />
                  <polygon
                    points="95,84 95,104 111,94"
                    fill="#1A73E8"
                  />
                </g>
              </g>
            )}
          </svg>
        </div>

        {/* Chú thích gợi ý */}
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 text-center">
          {isPlaying
            ? "Đang phát âm - Quan sát cử động viền môi & khoang miệng"
            : "Chạm vào ô khẩu hình hoặc từ vựng để nghe & quan sát"}
        </p>
      </div>
    );
  },
);
