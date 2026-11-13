import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { synthesizeTTSMock } = vi.hoisted(() => ({
  synthesizeTTSMock: vi.fn(),
}));

vi.mock("@/features/student/api/studentApi", () => ({
  studentApi: {
    synthesizeTTS: synthesizeTTSMock,
  },
}));

import {
  resolveFullAudioUrl,
  appendAudioCacheBuster,
  clearSampleAudioCache,
  isMockOrBrokenAudioUrl,
  isInvalidSampleAudioUrl,
  isGradingRubricOrMetaText,
  cleanShadowingSentence,
  extractReferenceSentence,
  selectBestEnglishVoice,
  playWebSpeechEnglish,
  playSampleAudio,
  stopAllSampleAudio,
} from "@/utils/sampleAudioPlayer";

interface FakeAudio {
  src: string;
  playbackRate: number;
  defaultPlaybackRate: number;
  duration: number;
  currentTime: number;
  paused: boolean;
  onplay: (() => void) | null;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

describe("utils/sampleAudioPlayer", () => {
  beforeEach(() => {
    clearSampleAudioCache();
    synthesizeTTSMock.mockReset();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    stopAllSampleAudio();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("resolveFullAudioUrl & appendAudioCacheBuster xử lý đúng URL tuyệt đối, tương đối và blob", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.elp.test");
    expect(resolveFullAudioUrl(null)).toBe("");
    expect(resolveFullAudioUrl("   ")).toBe("");
    expect(resolveFullAudioUrl("https://r2.dev/a.mp3")).toBe("https://r2.dev/a.mp3");
    expect(resolveFullAudioUrl("blob:http://localhost/123")).toBe("blob:http://localhost/123");
    expect(resolveFullAudioUrl("uploads/a.mp3")).toBe("https://api.elp.test/uploads/a.mp3");
    expect(resolveFullAudioUrl("/uploads/a.mp3")).toBe("https://api.elp.test/uploads/a.mp3");

    expect(appendAudioCacheBuster("blob:abc")).toBe("blob:abc");
    const busted = appendAudioCacheBuster("https://r2.dev/a.mp3?t=100&v=2");
    expect(busted).toMatch(/^https:\/\/r2\.dev\/a\.mp3\?v=2&t=\d+$/);
  });

  it("isMockOrBrokenAudioUrl & isInvalidSampleAudioUrl chặn đúng URL giả lập và file thu âm học viên", () => {
    expect(isMockOrBrokenAudioUrl(undefined)).toBe(true);
    expect(isMockOrBrokenAudioUrl("ab")).toBe(true);
    expect(isMockOrBrokenAudioUrl("https://storage.englishlearning.com/fake.mp3")).toBe(true);
    expect(isMockOrBrokenAudioUrl("https://example.com/test.mp3")).toBe(true);
    expect(isMockOrBrokenAudioUrl("ftp://invalid.com/a.mp3")).toBe(true);
    expect(isMockOrBrokenAudioUrl("/uploads/tts/ok.wav")).toBe(false);

    expect(isInvalidSampleAudioUrl("https://translate.google.com/translate_tts")).toBe(true);
    expect(isInvalidSampleAudioUrl("/uploads/speaking/attempt1.webm")).toBe(true);
    expect(isInvalidSampleAudioUrl("/uploads/submissions/sub1.wav")).toBe(true);
    expect(
      isInvalidSampleAudioUrl("https://cdn.r2/s1.wav", "https://cdn.r2/s1.wav"),
    ).toBe(true);
    expect(
      isInvalidSampleAudioUrl("https://cdn.r2/native.wav", "https://cdn.r2/s1.wav"),
    ).toBe(false);
  });

  it("isGradingRubricOrMetaText nhận diện đúng ghi chú rubric & mã đáp án", () => {
    expect(isGradingRubricOrMetaText(null)).toBe(true);
    expect(isGradingRubricOrMetaText("Audio speech submission for task 1")).toBe(true);
    expect(isGradingRubricOrMetaText("Student should speak fluently")).toBe(true);
    expect(isGradingRubricOrMetaText("opt-12")).toBe(true);
    expect(isGradingRubricOrMetaText("B")).toBe(true);
    expect(isGradingRubricOrMetaText("She sells seashells by the seashore.")).toBe(false);
  });

  it("cleanShadowingSentence & extractReferenceSentence trích xuất đúng câu mẫu theo thứ tự ưu tiên", () => {
    expect(
      cleanShadowingSentence('[SHADOWING] Hãy đọc to: "Practice makes perfect."'),
    ).toBe("Practice makes perfect.");
    expect(
      cleanShadowingSentence("Đề bài: Describe a book. You should say: what it is"),
    ).toBe("Describe a book. You should say: what it is");
    expect(cleanShadowingSentence("[READING PASSAGE]\nLong paragraph...")).toBe("");

    expect(extractReferenceSentence(null)).toBe("");
    expect(
      extractReferenceSentence({
        sampleText: "Student should respond clearly",
        transcript: "Learning English every morning improves confidence.",
        correctAnswer: "Ignored",
      }),
    ).toBe("Learning English every morning improves confidence.");
    expect(
      extractReferenceSentence({
        correctAnswer: "Consistent practice leads to mastery.",
        promptText: "Hãy đọc câu sau:",
      }),
    ).toBe("Consistent practice leads to mastery.");
    expect(
      extractReferenceSentence({
        correctAnswer: "Option_A",
        content: 'Shadowing: "Focus on clear articulation."',
      }),
    ).toBe("Focus on clear articulation.");
  });

  it("selectBestEnglishVoice ưu tiên giọng Natural US/UK và bỏ qua giọng vi-VN", () => {
    const fakeVoices = [
      { name: "Microsoft An", lang: "vi-VN" },
      { name: "Daniel", lang: "en-GB" },
      { name: "Google US English", lang: "en-US" },
    ] as unknown as SpeechSynthesisVoice[];

    vi.stubGlobal("speechSynthesis", {
      getVoices: vi.fn(() => fakeVoices),
      speak: vi.fn(),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    expect(selectBestEnglishVoice("en-US")?.name).toBe("Google US English");
    expect(selectBestEnglishVoice("en-GB")?.name).toBe("Daniel");
  });

  it("playWebSpeechEnglish phát với rate được clamp [0.5..2.0] và cập nhật progress theo timer", () => {
    vi.useFakeTimers();
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    const voice = { name: "Microsoft Sonia", lang: "en-GB" } as SpeechSynthesisVoice;
    vi.stubGlobal("speechSynthesis", {
      getVoices: vi.fn(() => [voice]),
      speak: speakMock,
      cancel: cancelMock,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      vi.fn(function (this: any, text: string) {
        this.text = text;
        this.lang = "";
        this.rate = 1;
        this.voice = null;
      }),
    );

    const onStart = vi.fn();
    const onProgress = vi.fn();
    const onEnd = vi.fn();

    playWebSpeechEnglish("Hello world today", {
      lang: "en-GB",
      rate: 3.5,
      onStart,
      onProgress,
      onEnd,
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0][0];
    expect(utterance.rate).toBe(2.0);
    expect(utterance.voice).toBe(voice);

    utterance.onstart?.();
    vi.advanceTimersByTime(120);
    expect(onProgress).toHaveBeenCalled();

    utterance.onend?.();
    expect(onProgress).toHaveBeenLastCalledWith(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("playSampleAudio: Ưu tiên 1 phát HTML5 audioUrl, lỗi thì chuyển Ưu tiên 2A gọi Kokoro TTS và cache lại", async () => {
    const createdAudios: FakeAudio[] = [];
    let callIndex = 0;

    const FakeAudioCtor = vi.fn(function (this: FakeAudio, src: string) {
      this.src = src;
      this.playbackRate = 1;
      this.defaultPlaybackRate = 1;
      this.duration = 2;
      this.currentTime = 0.5;
      this.paused = false;
      this.onplay = null;
      this.onended = null;
      this.onerror = null;
      this.pause = vi.fn();
      const currentCall = callIndex++;
      this.play = vi.fn(() => {
        if (currentCall === 0) {
          queueMicrotask(() => this.onerror?.());
          return Promise.resolve();
        }
        queueMicrotask(() => {
          this.onplay?.();
          this.onended?.();
        });
        return Promise.resolve();
      });
      createdAudios.push(this);
    });
    vi.stubGlobal("Audio", FakeAudioCtor);

    synthesizeTTSMock.mockResolvedValue({ audioUrl: "/uploads/tts/kokoro-1.wav" });

    const onStart = vi.fn();
    const onEnd = vi.fn();

    await playSampleAudio("Good morning", {
      audioUrl: "/uploads/tts/broken.wav",
      onStart,
      onEnd,
    });

    expect(synthesizeTTSMock).toHaveBeenCalledTimes(1);
    expect(createdAudios[1].src).toMatch(/\/uploads\/tts\/kokoro-1\.wav\?t=\d+/);
    expect(onStart).toHaveBeenCalled();

    // Lần 2 gọi cùng câu mẫu -> dùng cached URL không gọi API lần nữa
    await playSampleAudio("Good morning", { onStart, onEnd });
    expect(synthesizeTTSMock).toHaveBeenCalledTimes(1);
  });

  it("playSampleAudio: fallback sang Web Speech khi Kokoro TTS lỗi", async () => {
    const speakMock = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      getVoices: vi.fn(() => [{ name: "Google US English", lang: "en-US" }]),
      speak: speakMock,
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      vi.fn(function (this: any, text: string) {
        this.text = text;
      }),
    );

    synthesizeTTSMock.mockRejectedValue(new Error("Kokoro offline"));
    await playSampleAudio("Speak clearly");

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0].text).toBe("Speak clearly");
  });
});
