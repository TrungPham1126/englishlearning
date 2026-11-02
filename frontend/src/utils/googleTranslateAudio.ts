// src/utils/googleTranslateAudio.ts
import { playWebSpeechEnglish } from "./sampleAudioPlayer";

export type GoogleAccent = "en" | "en-GB";

export interface GoogleAudioPlayerOptions {
  readonly accent?: GoogleAccent;
  readonly slow?: boolean;
  readonly onStart?: () => void;
  readonly onEnd?: () => void;
  readonly onError?: () => void;
}

let activeGoogleAudio: HTMLAudioElement | null = null;

/**
 * Phát âm thanh từ vựng bằng Google Translate TTS API chính thức
 * URL: https://translate.google.com/translate_tts?ie=UTF-8&q={word}&tl={accent}&client=tw-ob
 * Hỗ trợ tốc độ chậm (Slow: 0.6x) và chuyển đổi accent US (en) / UK (en-GB)
 */
export function playGoogleTranslateAudio(
  word: string,
  options?: GoogleAudioPlayerOptions,
): void {
  const cleanWord = word.trim().replace(/[.,?!]/g, "");
  if (!cleanWord) {
    options?.onEnd?.();
    return;
  }

  // Dừng mọi âm thanh Google trước đó nếu đang phát
  if (activeGoogleAudio) {
    try {
      activeGoogleAudio.onplay = null;
      activeGoogleAudio.onended = null;
      activeGoogleAudio.onerror = null;
      activeGoogleAudio.pause();
      activeGoogleAudio.currentTime = 0;
    } catch {
      // Bỏ qua lỗi dừng audio
    }
    activeGoogleAudio = null;
  }

  const accent = options?.accent || "en";
  const isSlow = Boolean(options?.slow);
  const targetRate = isSlow ? 0.65 : 1.0;

  // URL Google Translate TTS chính thức
  const encodedText = encodeURIComponent(cleanWord);
  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${accent}&client=tw-ob`;

  const fallbackToWebSpeech = () => {
    playWebSpeechEnglish(cleanWord, {
      lang: accent === "en-GB" ? "en-GB" : "en-US",
      rate: isSlow ? 0.65 : 0.9,
      onStart: options?.onStart,
      onEnd: options?.onEnd,
      onError: options?.onError,
    });
  };

  try {
    const audio = new Audio(googleTtsUrl);
    activeGoogleAudio = audio;
    audio.playbackRate = targetRate;
    audio.defaultPlaybackRate = targetRate;

    audio.onplay = () => {
      options?.onStart?.();
    };

    audio.onended = () => {
      activeGoogleAudio = null;
      options?.onEnd?.();
    };

    audio.onerror = () => {
      activeGoogleAudio = null;
      // Nếu Google Translate TTS bị chặn hoặc lỗi mạng, tự động fallback sang Web Speech API
      fallbackToWebSpeech();
    };

    audio.play().catch(() => {
      activeGoogleAudio = null;
      fallbackToWebSpeech();
    });
  } catch {
    fallbackToWebSpeech();
  }
}

/**
 * Dừng phát âm Google Translate
 */
export function stopGoogleTranslateAudio(): void {
  if (activeGoogleAudio) {
    try {
      activeGoogleAudio.pause();
      activeGoogleAudio.currentTime = 0;
    } catch {
      // Ignore
    }
    activeGoogleAudio = null;
  }
}
