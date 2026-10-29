// src/utils/sampleAudioPlayer.ts
import { studentApi } from "@/features/student/api/studentApi";

export type SupportedEnglishLang = "en-US" | "en-GB";

export interface PlaySampleAudioOptions {
  readonly audioUrl?: string | null;
  readonly voice?: string;
  readonly lang?: SupportedEnglishLang;
  readonly rate?: number;
  readonly skipBackendTts?: boolean;
  readonly forceRefresh?: boolean;
  readonly studentAudioUrl?: string | null;
  readonly onStart?: () => void;
  readonly onEnd?: () => void;
  readonly onError?: () => void;
  readonly onProgress?: (progressRatio: number) => void;
}

export interface QuestionTextCandidate {
  readonly transcript?: string | null;
  readonly sampleText?: string | null;
  readonly correctAnswer?: string | null;
  readonly promptText?: string | null;
  readonly content?: string | null;
}

// Singleton references để đảm bảo tại mọi thời điểm chỉ có tối đa 1 câu mẫu đang phát
let activeSampleAudio: HTMLAudioElement | null = null;
let activeProgressTimer: ReturnType<typeof setInterval> | null = null;
let activeRafId: number | null = null;
const backendTtsCache = new Map<string, string>();

/**
 * Chuẩn hóa đường dẫn Audio tương đối sang tuyệt đối (hỗ trợ cả Cloudflare R2 và local backend)
 */
export function resolveFullAudioUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
  return `${base}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

/**
 * Thêm tham số cache-buster (?t=Date.now()) để buộc trình duyệt tải file âm thanh mới nhất
 * thay vì phát lại file âm thanh cũ lưu trong bộ nhớ đệm.
 */
export function appendAudioCacheBuster(url?: string | null): string {
  const resolved = resolveFullAudioUrl(url);
  if (!resolved || resolved.startsWith("blob:")) return resolved;
  const withoutOldTs = resolved.replace(/([?&])t=\d+(&?)/g, (_, p1, p2) =>
    p2 ? p1 : "",
  );
  const sep = withoutOldTs.includes("?") ? "&" : "?";
  return `${withoutOldTs}${sep}t=${Date.now()}`;
}

/**
 * Xóa toàn bộ cache URL TTS phía client khi bấm Tạo lại âm thanh
 */
export function clearSampleAudioCache(): void {
  backendTtsCache.clear();
}

/**
 * Kiểm tra xem URL có phải là URL giả lập (mock seed data) hoặc không thể phát được hay không
 */
export function isMockOrBrokenAudioUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim();
  if (trimmed.length < 4) return true;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("storage.englishlearning.com") ||
    lower.includes("example.com") ||
    lower.includes("placeholder") ||
    lower === "null" ||
    lower === "undefined"
  ) {
    return true;
  }

  // Nếu không phải http, https, blob hoặc đường dẫn tương đối bắt đầu bằng /uploads, /api
  if (
    !lower.startsWith("http://") &&
    !lower.startsWith("https://") &&
    !lower.startsWith("blob:") &&
    !lower.startsWith("/")
  ) {
    return true;
  }

  return false;
}

/**
 * Kiểm tra xem URL có không hợp lệ khi dùng làm Sample Audio (Câu mẫu bản xứ) hay không.
 * Loại bỏ tuyệt đối:
 * - URL mock (storage.englishlearning.com)
 * - URL thu âm của học viên (/speaking/, /submissions/, hoặc trùng với studentAudioUrl)
 * - URL Google Translate / dictvoice cũ kỹ
 */
export function isInvalidSampleAudioUrl(
  url?: string | null,
  studentAudioUrl?: string | null,
): boolean {
  if (isMockOrBrokenAudioUrl(url)) return true;
  const trimmed = url!.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.includes("translate.google") ||
    lower.includes("dictvoice") ||
    lower.includes("speech_gen") ||
    lower.includes("/speaking/") ||
    lower.includes("/submissions/")
  ) {
    return true;
  }

  if (studentAudioUrl && trimmed === studentAudioUrl.trim()) {
    return true;
  }

  return false;
}

/**
 * Kiểm tra xem một chuỗi có phải là ghi chú chấm điểm (rubric) thay vì câu tiếng Anh mẫu hay không
 */
export function isGradingRubricOrMetaText(text?: string | null): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();

  return (
    lower.startsWith("audio speech submission") ||
    lower.startsWith("sample high-band") ||
    lower.startsWith("student should") ||
    lower.startsWith("answer should") ||
    lower.startsWith("presentation response") ||
    lower.startsWith("spoken response") ||
    lower.includes("prosodic fluency") ||
    /^(option|opt|choice)[-_]?[0-9a-z]+$/i.test(trimmed) ||
    /^[A-D]$/i.test(trimmed)
  );
}

/**
 * Làm sạch câu tiếng Anh mẫu hoặc câu hỏi giám khảo khỏi các tiền tố hướng dẫn tiếng Việt
 * nhưng KHÔNG BAO GIỜ cắt cụt nội dung tiếng Anh chứa dấu hai chấm (như Cue Card "You should say: ...").
 */
export function cleanShadowingSentence(raw?: string | null): string {
  if (!raw) return "";
  let s = raw
    .replace(/\[READING PASSAGE\][\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/\[(?:LISTEN_WORD|LISTEN_SPELL|SHADOWING|SPEAKING|AUDIO)\]/gi, "")
    .trim();

  if (!s) return "";

  // 1. Nếu câu bắt đầu bằng hướng dẫn tiếng Việt và có câu tiếng Anh trong ngoặc kép
  const hasVietnameseInstructionPrefix =
    /^(?:hãy\s+đọc|đọc\s+to|nhại\s+lại|luyện\s+đọc|phát\s+âm|nghe\s+và\s+đọc|shadowing|repeat\s+after|listen\s+and\s+repeat)/i.test(
      s,
    );

  if (hasVietnameseInstructionPrefix) {
    const quotedMatch = s.match(/["'“‘]([^"'”’]{4,})["'”’]/);
    if (quotedMatch && quotedMatch[1]) {
      return quotedMatch[1].trim();
    }
  }

  // 2. Xóa các tiền tố hướng dẫn đầu câu có dấu hai chấm (chỉ xóa phần tiêu đề hướng dẫn phía trước dấu hai chấm đầu tiên)
  const prefixBeforeColonMatch = s.match(
    /^(?:câu\s*\d+|question\s*\d+|task\s*\d+|part\s*\d+|chủ\s+đề|đề\s+bài|yêu\s+cầu|hãy\s+đọc[^:]*|đọc\s+to[^:]*|nhại\s+lại[^:]*|phát\s+âm[^:]*|luyện\s+đọc[^:]*|shadowing[^:]*|repeat\s+after\s+me[^:]*)\s*:\s*(.+)$/is,
  );
  if (prefixBeforeColonMatch && prefixBeforeColonMatch[1]) {
    s = prefixBeforeColonMatch[1].trim();
  }

  // 3. Bỏ cặp dấu ngoặc kép bọc ngoài cùng (nếu toàn bộ câu nằm trong ngoặc kép)
  s = s.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();

  return s;
}

/**
 * Trích xuất chính xác câu mẫu tiếng Anh (Reference Sentence) của câu hỏi để hiển thị & phát âm mẫu.
 * Tuyệt đối không lấy nhầm rubric, tiêu đề hướng dẫn hay bài làm (userTranscript / studentAnswer) của học viên.
 */
export function extractReferenceSentence(
  question?: QuestionTextCandidate | null,
): string {
  if (!question) return "";

  // Ưu tiên 1: sampleText tường minh
  if (
    question.sampleText &&
    !isGradingRubricOrMetaText(question.sampleText)
  ) {
    const cleaned = cleanShadowingSentence(question.sampleText);
    if (cleaned.length >= 2) return cleaned;
  }

  // Ưu tiên 2: transcript của câu hỏi (nếu có và không phải ghi chú rubric)
  if (
    question.transcript &&
    !isGradingRubricOrMetaText(question.transcript)
  ) {
    const cleaned = cleanShadowingSentence(question.transcript);
    if (cleaned.length >= 2) return cleaned;
  }

  // Ưu tiên 3: correctAnswer (CHỈ KHI là câu tiếng Anh thực sự, không phải rubric như "Audio speech submission...")
  if (
    question.correctAnswer &&
    !isGradingRubricOrMetaText(question.correctAnswer)
  ) {
    const cleaned = cleanShadowingSentence(question.correctAnswer);
    if (cleaned.length >= 2) return cleaned;
  }

  // Ưu tiên 4: promptText hoặc content đã lọc bỏ hướng dẫn tiếng Việt
  const fallback = cleanShadowingSentence(
    question.promptText || question.content || "",
  );
  return fallback;
}

/**
 * Chọn giọng đọc tiếng Anh (en-US / en-GB) tự nhiên nhất có sẵn trên trình duyệt.
 * TUYỆT ĐỐI không chọn giọng tiếng Việt (vi-VN) để đọc câu tiếng Anh.
 */
export function selectBestEnglishVoice(
  lang: SupportedEnglishLang = "en-US",
): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Chỉ giữ lại các giọng đọc tiếng Anh (lang bắt đầu bằng 'en')
  const englishVoices = voices.filter((v) =>
    v.lang.toLowerCase().replace("_", "-").startsWith("en"),
  );

  if (englishVoices.length === 0) return null;

  const targetLangLower = lang.toLowerCase(); // 'en-us' hoặc 'en-gb'

  // Danh sách các giọng đọc Neural / Natural chất lượng cao theo thứ tự ưu tiên
  const preferredKeywords =
    lang === "en-GB"
      ? [
          "google uk english female",
          "google uk english male",
          "microsoft sonia",
          "microsoft ryan",
          "microsoft libby",
          "daniel",
          "serena",
          "martha",
          "uk english",
          "great britain",
        ]
      : [
          "google us english",
          "microsoft aria",
          "microsoft jenny",
          "microsoft guy",
          "microsoft ana",
          "microsoft steffan",
          "microsoft zira",
          "microsoft david",
          "samantha",
          "alex",
          "ava",
          "allison",
          "us english",
        ];

  for (const keyword of preferredKeywords) {
    const matched = englishVoices.find((v) =>
      v.name.toLowerCase().includes(keyword),
    );
    if (matched) return matched;
  }

  // Ưu tiên giọng khớp chính xác mã vùng (en-US hoặc en-GB)
  const exactLocaleMatch = englishVoices.find((v) =>
    v.lang.toLowerCase().replace("_", "-").startsWith(targetLangLower),
  );
  if (exactLocaleMatch) return exactLocaleMatch;

  // Fallback sang bất kỳ giọng tiếng Anh nào đầu tiên
  return englishVoices[0] ?? null;
}

/**
 * Dừng ngay lập tức mọi âm thanh câu mẫu hoặc Web Speech TTS đang phát
 */
export function stopAllSampleAudio(): void {
  if (activeProgressTimer !== null) {
    clearInterval(activeProgressTimer);
    activeProgressTimer = null;
  }
  if (activeRafId !== null) {
    cancelAnimationFrame(activeRafId);
    activeRafId = null;
  }
  if (activeSampleAudio) {
    try {
      activeSampleAudio.onplay = null;
      activeSampleAudio.onended = null;
      activeSampleAudio.onerror = null;
      activeSampleAudio.pause();
      activeSampleAudio.currentTime = 0;
    } catch {
      // Ignore audio pause errors
    }
    activeSampleAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore speechSynthesis cancel errors
    }
  }
}

/**
 * Phát câu mẫu bằng Web Speech API (window.speechSynthesis) với giọng tiếng Anh chuẩn
 */
export function playWebSpeechEnglish(
  text: string,
  options?: {
    readonly lang?: SupportedEnglishLang;
    readonly rate?: number;
    readonly onStart?: () => void;
    readonly onEnd?: () => void;
    readonly onError?: () => void;
    readonly onProgress?: (progressRatio: number) => void;
  },
): void {
  const cleanText = cleanShadowingSentence(text);
  if (!cleanText) {
    options?.onEnd?.();
    return;
  }

  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    options?.onError?.();
    options?.onEnd?.();
    return;
  }

  stopAllSampleAudio();

  const lang: SupportedEnglishLang = options?.lang ?? "en-US";
  const rate = Math.max(0.5, Math.min(2.0, options?.rate ?? 1.0));

  const startSpeakingWithVoice = () => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang;
      utterance.rate = rate;

      const bestVoice = selectBestEnglishVoice(lang);
      if (bestVoice) {
        utterance.voice = bestVoice;
        utterance.lang = bestVoice.lang || lang;
      }

      // Ước tính thời lượng đọc dựa trên số từ để tạo hiệu ứng chạy sóng âm mượt mà
      const wordCount = Math.max(1, cleanText.split(/\s+/).length);
      const estimatedDurationMs = Math.max(
        1200,
        ((wordCount / 2.6) * 1000) / rate,
      );
      const startedAt = Date.now();

      utterance.onstart = () => {
        options?.onStart?.();
        options?.onProgress?.(0.05);
        if (activeProgressTimer !== null) clearInterval(activeProgressTimer);
        activeProgressTimer = setInterval(() => {
          const elapsed = Date.now() - startedAt;
          const ratio = Math.min(0.95, elapsed / estimatedDurationMs);
          options?.onProgress?.(ratio);
        }, 60);
      };

      utterance.onend = () => {
        if (activeProgressTimer !== null) {
          clearInterval(activeProgressTimer);
          activeProgressTimer = null;
        }
        options?.onProgress?.(1);
        options?.onEnd?.();
      };

      utterance.onerror = () => {
        if (activeProgressTimer !== null) {
          clearInterval(activeProgressTimer);
          activeProgressTimer = null;
        }
        options?.onError?.();
        options?.onEnd?.();
      };

      // Kích hoạt onStart ngay nếu trình duyệt không bắn sự kiện onstart kịp thời
      options?.onStart?.();
      window.speechSynthesis.speak(utterance);
    } catch {
      options?.onError?.();
      options?.onEnd?.();
    }
  };

  // Trên Chrome, danh sách getVoices() có thể rỗng ở lần gọi đầu tiên
  const existingVoices = window.speechSynthesis.getVoices();
  if (existingVoices && existingVoices.length > 0) {
    startSpeakingWithVoice();
  } else {
    let hasStarted = false;
    const handleVoicesChanged = () => {
      if (hasStarted) return;
      hasStarted = true;
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        handleVoicesChanged,
      );
      startSpeakingWithVoice();
    };
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      handleVoicesChanged,
    );
    setTimeout(() => {
      if (!hasStarted) {
        hasStarted = true;
        window.speechSynthesis.removeEventListener(
          "voiceschanged",
          handleVoicesChanged,
        );
        startSpeakingWithVoice();
      }
    }, 150);
  }
}

/**
 * Hàm chuẩn hóa phát âm câu mẫu (Sample Audio) toàn hệ thống:
 * - Ưu tiên 1: Nếu có `audioUrl` hợp lệ (không phải link giả lập / không phải file thu của học sinh),
 *   phát qua HTML5 Audio; nếu lỗi mạng / 404 (`onerror` hoặc `play()` catch), tự động chuyển ngay sang Ưu tiên 2.
 * - Ưu tiên 2: Thử gọi Kokoro-82M TTS (nếu không tắt `skipBackendTts`), và nếu không khả dụng hoặc lỗi,
 *   lập tức phát bằng `window.speechSynthesis` với giọng đọc tiếng Anh bản xứ (`en-US` / `en-GB`).
 */
export async function playSampleAudio(
  text: string,
  options?: PlaySampleAudioOptions,
): Promise<void> {
  const cleanText = cleanShadowingSentence(text);
  const voice = options?.voice ?? "af_heart";
  const lang: SupportedEnglishLang =
    options?.lang ?? (voice.toLowerCase().startsWith("b") ? "en-GB" : "en-US");
  const rate = Math.max(0.5, Math.min(2.0, options?.rate ?? 1.0));

  stopAllSampleAudio();

  const fallbackToWebSpeech = () => {
    if (cleanText) {
      playWebSpeechEnglish(cleanText, {
        lang,
        rate,
        onStart: options?.onStart,
        onEnd: options?.onEnd,
        onError: options?.onError,
        onProgress: options?.onProgress,
      });
    } else {
      options?.onError?.();
      options?.onEnd?.();
    }
  };

  const tryPlayUrl = (urlToPlay: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const resolvedUrl = resolveFullAudioUrl(urlToPlay);
      if (!resolvedUrl) {
        resolve(false);
        return;
      }

      const audio = new Audio(resolvedUrl);
      activeSampleAudio = audio;
      audio.playbackRate = rate;
      audio.defaultPlaybackRate = rate;
      (audio as unknown as { preservesPitch?: boolean }).preservesPitch = true;

      let settled = false;
      const trackProgress = () => {
        if (!activeSampleAudio || activeSampleAudio !== audio || audio.paused) {
          return;
        }
        const dur = audio.duration;
        if (Number.isFinite(dur) && dur > 0) {
          options?.onProgress?.(Math.min(1, audio.currentTime / dur));
        }
        activeRafId = requestAnimationFrame(trackProgress);
      };

      audio.onplay = () => {
        if (!settled) {
          settled = true;
          resolve(true);
        }
        options?.onStart?.();
        options?.onProgress?.(0);
        activeRafId = requestAnimationFrame(trackProgress);
      };

      audio.onended = () => {
        if (activeRafId !== null) {
          cancelAnimationFrame(activeRafId);
          activeRafId = null;
        }
        options?.onProgress?.(1);
        options?.onEnd?.();
      };

      audio.onerror = () => {
        if (activeRafId !== null) {
          cancelAnimationFrame(activeRafId);
          activeRafId = null;
        }
        if (!settled) {
          settled = true;
          resolve(false);
        } else {
          // Nếu đang phát dở mà lỗi stream -> fallback sang Web Speech
          fallbackToWebSpeech();
        }
      };

      audio.play().catch((err: unknown) => {
        if (activeRafId !== null) {
          cancelAnimationFrame(activeRafId);
          activeRafId = null;
        }
        const errName = (err as { name?: string })?.name;
        if (errName === "AbortError") {
          if (!settled) {
            settled = true;
            resolve(true);
          }
          return;
        }
        if (!settled) {
          settled = true;
          resolve(false);
        }
      });
    });
  };

  // ƯU TIÊN 1: Phát từ audioUrl truyền vào nếu hợp lệ
  if (
    options?.audioUrl &&
    !isInvalidSampleAudioUrl(options.audioUrl, options.studentAudioUrl)
  ) {
    const urlToUse = options.forceRefresh
      ? appendAudioCacheBuster(options.audioUrl)
      : options.audioUrl;
    const playedOk = await tryPlayUrl(urlToUse);
    if (playedOk) return;
  }

  // ƯU TIÊN 2A: Kiểm tra cache hoặc gọi Backend Kokoro TTS (nếu có cleanText)
  if (cleanText && !options?.skipBackendTts) {
    const cacheKey = `${cleanText}::${voice}`;
    if (options?.forceRefresh) {
      backendTtsCache.delete(cacheKey);
    }
    let cachedUrl = backendTtsCache.get(cacheKey);

    if (!cachedUrl) {
      try {
        const res = await studentApi.synthesizeTTS({
          text: cleanText,
          voice,
          speed: 1.0,
        });
        if (
          res?.audioUrl &&
          !isInvalidSampleAudioUrl(res.audioUrl, options?.studentAudioUrl)
        ) {
          cachedUrl = appendAudioCacheBuster(res.audioUrl);
          backendTtsCache.set(cacheKey, cachedUrl);
        }
      } catch {
        // Backend Kokoro TTS không phản hồi -> Chuyển sang Web Speech API bên dưới
      }
    }

    if (cachedUrl) {
      const playedTtsOk = await tryPlayUrl(cachedUrl);
      if (playedTtsOk) return;
      backendTtsCache.delete(cacheKey);
    }
  }

  // ƯU TIÊN 2B: Fallback sang Web Speech API (window.speechSynthesis) chuẩn tiếng Anh (en-US / en-GB)
  fallbackToWebSpeech();
}
