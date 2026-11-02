import React from 'react';
import {
  Play,
  Pause,
  FileText,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
  BookOpen,
  Headphones,
} from 'lucide-react';
import type { DialogueSegment } from '@/features/student/types';

export interface QuestionContextViewProps {
  isListening: boolean;
  isReading: boolean;
  isVocab?: boolean;
  passageText?: string | null;
  audioUrl?: string | null;
  listeningScript?: string | null;
  phase: 'CHECKING' | 'INTRO' | 'TESTING' | 'REVIEW' | 'EXHAUSTED';
  
  // Audio state & handlers
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlayingAudio: boolean;
  onTogglePlayAudio: () => void;
  audioCurrentTime: number;
  audioDuration: number;
  onSeekAudio: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSkipAudio: (seconds: number) => void;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  
  showListeningScript: boolean;
  onToggleListeningScript: () => void;
  
  isPlayingAiVoice: boolean;
  onToggleAiVoice: () => void;
  
  isRepairingAudio: boolean;
  onRepairAudio: () => void;
  
  listeningSegments?: DialogueSegment[];
  
  // Reading passage state & handlers
  fontSizeLevel: 'normal' | 'large' | 'xlarge';
  passageContainerRef: React.RefObject<HTMLDivElement | null>;
  readingMobileTab: 'PASSAGE' | 'QUESTIONS';
  onToggleMobileTab: (tab: 'PASSAGE' | 'QUESTIONS') => void;
}

const QuestionContextViewComponent: React.FC<QuestionContextViewProps> = ({
  isListening,
  isReading,
  isVocab = false,
  passageText,
  audioUrl,
  listeningScript,
  phase,
  audioRef,
  isPlayingAudio,
  onTogglePlayAudio,
  audioCurrentTime,
  audioDuration,
  onSeekAudio,
  onSkipAudio,
  playbackRate,
  onChangePlaybackRate,
  isMuted,
  onToggleMute,
  showListeningScript,
  onToggleListeningScript,
  isPlayingAiVoice,
  onToggleAiVoice,
  isRepairingAudio,
  onRepairAudio,
  listeningSegments = [],
  fontSizeLevel: _fontSizeLevel,
  passageContainerRef: _passageContainerRef,
  readingMobileTab,
  onToggleMobileTab,
}) => {
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Tuyệt đối không hiển thị audio tổng nếu là bài tập Từ vựng (Vocabulary)
  const isListeningMode = isListening && !isVocab;
  const hasReadingPassage = isReading && Boolean(passageText);
  const hasListeningAudio = isListeningMode && Boolean(audioUrl || listeningScript || (listeningSegments && listeningSegments.length > 0));

  return (
    <>
      {/* 1. AUDIO PLAYER BAR CỐ ĐỊNH CHO BÀI TẬP LISTENING (Ẩn hoàn toàn với Vocabulary) */}
      {hasListeningAudio && (
        <div className="border border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-surface-elevated rounded-xl p-4 text-white shadow-elevated sticky top-24 z-30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <audio
              ref={audioRef}
              src={audioUrl || undefined}
              preload="auto"
              onLoadedMetadata={(e) => {
                e.currentTarget.playbackRate = playbackRate;
                e.currentTarget.defaultPlaybackRate = playbackRate;
                (e.currentTarget as any).preservesPitch = true;
              }}
              onCanPlay={(e) => {
                e.currentTarget.playbackRate = playbackRate;
                e.currentTarget.defaultPlaybackRate = playbackRate;
              }}
            />

            <div className="flex items-center gap-2 shrink-0">
              {Boolean(audioUrl) && (
                <button
                  type="button"
                  onClick={() => onSkipAudio(-5)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center gap-0.5 transition cursor-pointer"
                  title="Tua lùi 5 giây (-5s)"
                  aria-label="Tua lùi 5 giây"
                >
                  <Rewind size={14} />
                  <span className="text-[10px]">-5s</span>
                </button>
              )}

              <button
                type="button"
                onClick={audioUrl ? onTogglePlayAudio : onToggleAiVoice}
                className={`h-11 w-11 rounded-full flex items-center justify-center font-black transition-transform active:scale-95 shadow-md cursor-pointer shrink-0 ${
                  isPlayingAudio || isPlayingAiVoice
                    ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
                title={isPlayingAudio || isPlayingAiVoice ? 'Tạm dừng' : 'Phát'}
                aria-label={isPlayingAudio || isPlayingAiVoice ? 'Tạm dừng' : 'Phát'}
              >
                {isPlayingAudio || isPlayingAiVoice ? (
                  <Pause size={18} />
                ) : (
                  <Play size={18} className="ml-0.5" />
                )}
              </button>

              {Boolean(audioUrl) && (
                <button
                  type="button"
                  onClick={() => onSkipAudio(5)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center gap-0.5 transition cursor-pointer"
                  title="Tua tới 5 giây (+5s)"
                  aria-label="Tua tới 5 giây"
                >
                  <span className="text-[10px]">+5s</span>
                  <FastForward size={14} />
                </button>
              )}
            </div>

            {/* Thanh trượt kéo tiến trình (Seek bar) và thời gian (00:00 / 00:00) */}
            {Boolean(audioUrl) && (
              <div className="flex-1 flex items-center gap-3 max-w-xl mx-2 min-w-[140px]">
                <span className="text-xs font-mono text-blue-200 w-12 text-right shrink-0">
                  {formatTimer(audioCurrentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={audioDuration > 0 ? audioDuration : 100}
                  step={0.1}
                  value={Math.min(audioCurrentTime, audioDuration > 0 ? audioDuration : 100)}
                  onChange={onSeekAudio}
                  className="flex-1 h-2 bg-blue-800/60 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  aria-label="Tiến trình phát bài nghe"
                />
                <span className="text-xs font-mono text-blue-300 w-12 shrink-0">
                  {formatTimer(audioDuration)}
                </span>
              </div>
            )}

            {/* Các nút tùy chỉnh: Tốc độ, Âm lượng & Xem Transcript */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1 border border-white/10">
                {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => onChangePlaybackRate(rate)}
                    className={`px-2 py-0.5 rounded text-[11px] font-black transition ${
                      playbackRate === rate
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {Boolean(audioUrl) && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title={isMuted ? 'Bật âm' : 'Tắt âm'}
                  aria-label={isMuted ? 'Bật âm' : 'Tắt âm'}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              )}

              {/* Chỉ cho phép xem transcript sau khi học sinh hoàn thành và nộp bài */}
              {phase === 'REVIEW' && (
                <button
                  type="button"
                  onClick={onToggleListeningScript}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer border ${
                    showListeningScript
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                  }`}
                  title="Xem kịch bản nội dung bài nghe (Khả dụng sau khi nộp bài)"
                >
                  <FileText size={13} />
                  <span>{showListeningScript ? 'Ẩn Transcript' : 'Xem Transcript'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Panel kịch bản bài nghe liên tục chỉ mở khi đã nộp bài (phase === REVIEW) */}
          {phase === 'REVIEW' && showListeningScript && (
            <div className="mt-3.5 p-4 rounded-xl bg-white dark:bg-slate-900/95 border border-blue-200 dark:border-blue-600/30 text-slate-800 dark:text-blue-100 text-xs leading-relaxed max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between font-bold text-amber-600 dark:text-amber-300 mb-2 border-b border-slate-200 dark:border-white/10 pb-2">
                <span className="flex items-center gap-2 uppercase tracking-wider text-xs">
                  <Headphones size={14} /> Full Audio Transcript (Kịch bản bài nghe đồng bộ đa nhân vật)
                </span>
                <button
                  type="button"
                  onClick={onToggleListeningScript}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕ Đóng
                </button>
              </div>

              {listeningSegments && listeningSegments.length > 0 ? (
                <div className="space-y-2">
                  {listeningSegments.map((seg, idx) => {
                    const currentMs = audioCurrentTime * 1000;
                    const isActive = currentMs >= seg.startMs && currentMs <= seg.endMs;
                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg transition-all border ${
                          isActive
                            ? 'bg-blue-950/60 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                            : 'bg-slate-800/40 border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className={`font-black ${isActive ? 'text-amber-300' : 'text-blue-300'}`}>
                            {seg.speaker}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatTimer(Math.floor(seg.startMs / 1000))} - {formatTimer(Math.floor(seg.endMs / 1000))}
                            {seg.voice && ` • ${seg.voice}`}
                          </span>
                        </div>
                        <p className={`text-sm ${isActive ? 'text-white font-medium' : 'text-slate-300'}`}>
                          {seg.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : listeningScript ? (
                <div className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-200">
                  {listeningScript}
                </div>
              ) : (
                <p className="text-slate-400 italic">Không có kịch bản bài nghe cho bài này.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. THANH CHUYỂN TAB MOBILE CHO BÀI ĐỌC READING (< lg screens) */}
      {hasReadingPassage && (
        <div className="lg:hidden flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => onToggleMobileTab('PASSAGE')}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              readingMobileTab === 'PASSAGE'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen size={13} />
            <span>Đọc Bài Văn (Passage)</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleMobileTab('QUESTIONS')}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              readingMobileTab === 'QUESTIONS'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText size={13} />
            <span>Danh Sách Câu Hỏi</span>
          </button>
        </div>
      )}
    </>
  );
};

export const QuestionContextView = React.memo(QuestionContextViewComponent);
export default QuestionContextView;
