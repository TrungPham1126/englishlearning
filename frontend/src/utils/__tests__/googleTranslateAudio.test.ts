import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { playWebSpeechEnglishMock } = vi.hoisted(() => ({
  playWebSpeechEnglishMock: vi.fn(),
}));

vi.mock("@/utils/sampleAudioPlayer", () => ({
  playWebSpeechEnglish: playWebSpeechEnglishMock,
}));

import {
  playGoogleTranslateAudio,
  stopGoogleTranslateAudio,
} from "@/utils/googleTranslateAudio";

interface MockAudioInstance {
  src: string;
  playbackRate: number;
  defaultPlaybackRate: number;
  currentTime: number;
  onplay: (() => void) | null;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

describe("utils/googleTranslateAudio", () => {
  let createdAudios: MockAudioInstance[];
  let playImpl: () => Promise<void>;

  beforeEach(() => {
    createdAudios = [];
    playImpl = () => Promise.resolve();
    playWebSpeechEnglishMock.mockReset();

    const FakeAudio = vi.fn(function (this: MockAudioInstance, src: string) {
      this.src = src;
      this.playbackRate = 1;
      this.defaultPlaybackRate = 1;
      this.currentTime = 1.2;
      this.onplay = null;
      this.onended = null;
      this.onerror = null;
      this.play = vi.fn(() => playImpl());
      this.pause = vi.fn();
      createdAudios.push(this);
    });
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => {
    stopGoogleTranslateAudio();
    vi.unstubAllGlobals();
  });

  it("bỏ qua và gọi onEnd ngay khi từ rỗng hoặc chỉ chứa dấu câu", () => {
    const onEnd = vi.fn();
    playGoogleTranslateAudio("  .,?!  ", { onEnd });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(createdAudios).toHaveLength(0);
  });

  it("tạo Audio đúng URL Google Translate, accent en-GB, tốc độ chậm 0.65 và gọi lifecycle callbacks", async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();

    playGoogleTranslateAudio("Resilient!", {
      accent: "en-GB",
      slow: true,
      onStart,
      onEnd,
    });

    expect(createdAudios).toHaveLength(1);
    const audio = createdAudios[0];
    expect(audio.src).toBe(
      "https://translate.google.com/translate_tts?ie=UTF-8&q=Resilient&tl=en-GB&client=tw-ob",
    );
    expect(audio.playbackRate).toBe(0.65);
    expect(audio.defaultPlaybackRate).toBe(0.65);

    audio.onplay?.();
    expect(onStart).toHaveBeenCalledTimes(1);

    audio.onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("dừng và xóa handlers của âm thanh trước đó khi phát từ mới hoặc stopGoogleTranslateAudio", () => {
    playGoogleTranslateAudio("first");
    const firstAudio = createdAudios[0];

    playGoogleTranslateAudio("second");
    expect(firstAudio.pause).toHaveBeenCalledTimes(1);
    expect(firstAudio.currentTime).toBe(0);
    expect(firstAudio.onplay).toBeNull();
    expect(firstAudio.onended).toBeNull();
    expect(firstAudio.onerror).toBeNull();

    const secondAudio = createdAudios[1];
    stopGoogleTranslateAudio();
    expect(secondAudio.pause).toHaveBeenCalledTimes(1);
    expect(secondAudio.currentTime).toBe(0);
    expect(secondAudio.onplay).toBeNull();
    expect(secondAudio.onended).toBeNull();
    expect(secondAudio.onerror).toBeNull();
  });

  it("fallback sang playWebSpeechEnglish khi Audio bị lỗi onerror", () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();

    playGoogleTranslateAudio("hello?", {
      accent: "en",
      slow: false,
      onStart,
      onEnd,
      onError,
    });

    createdAudios[0].onerror?.();
    expect(playWebSpeechEnglishMock).toHaveBeenCalledWith("hello", {
      lang: "en-US",
      rate: 0.9,
      onStart,
      onEnd,
      onError,
    });
  });

  it("fallback sang playWebSpeechEnglish khi audio.play() reject hoặc khởi tạo Audio lỗi", async () => {
    playImpl = () => Promise.reject(new Error("Autoplay blocked"));
    playGoogleTranslateAudio("pronunciation", { accent: "en-GB", slow: true });

    await Promise.resolve();
    await Promise.resolve();
    expect(playWebSpeechEnglishMock).toHaveBeenCalledWith("pronunciation", {
      lang: "en-GB",
      rate: 0.65,
      onStart: undefined,
      onEnd: undefined,
      onError: undefined,
    });

    playWebSpeechEnglishMock.mockClear();
    vi.stubGlobal(
      "Audio",
      vi.fn(function () {
        throw new Error("Audio unsupported");
      }),
    );
    playGoogleTranslateAudio("fallback");
    expect(playWebSpeechEnglishMock).toHaveBeenCalledTimes(1);
  });
});
