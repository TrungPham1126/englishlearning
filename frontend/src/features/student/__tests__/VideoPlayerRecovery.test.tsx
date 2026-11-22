import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const hlsControl = vi.hoisted(() => {
  type Handler = (event: string, data?: any) => void;

  class MockHls {
    static instances: MockHls[] = [];
    static Events = {
      MEDIA_ATTACHED: "hlsMediaAttached",
      MANIFEST_PARSED: "hlsManifestParsed",
      LEVEL_SWITCHED: "hlsLevelSwitched",
      FRAG_LOADED: "hlsFragLoaded",
      FRAG_BUFFERED: "hlsFragBuffered",
      ERROR: "hlsError",
    };
    static ErrorTypes = {
      NETWORK_ERROR: "networkError",
      MEDIA_ERROR: "mediaError",
      OTHER_ERROR: "otherError",
    };
    static ErrorDetails = {
      MANIFEST_LOAD_ERROR: "manifestLoadError",
      MANIFEST_LOAD_TIMEOUT: "manifestLoadTimeOut",
      MANIFEST_PARSING_ERROR: "manifestParsingError",
      MANIFEST_INCOMPATIBLE_CODECS_ERROR: "manifestIncompatibleCodecsError",
      FRAG_LOAD_ERROR: "fragLoadError",
    };
    static isSupported = vi.fn(() => true);

    config: Record<string, any>;
    levels: Array<{ height: number }> = [];
    currentLevel = -1;
    nextLevel = -1;
    loadLevel = -1;
    nextAutoLevel = -1;
    bandwidthEstimate = 5_000_000;
    private handlers = new Map<string, Handler[]>();

    loadSource = vi.fn();
    startLoad = vi.fn();
    recoverMediaError = vi.fn();
    destroy = vi.fn();
    attachMedia = vi.fn(() => {
      this.emit(MockHls.Events.MEDIA_ATTACHED);
    });

    constructor(config: Record<string, any> = {}) {
      this.config = config;
      MockHls.instances.push(this);
    }

    on(event: string, handler: Handler) {
      const list = this.handlers.get(event) ?? [];
      list.push(handler);
      this.handlers.set(event, list);
    }

    emit(event: string, data?: any) {
      const list = this.handlers.get(event) ?? [];
      for (const handler of list) {
        handler(event, data);
      }
    }
  }

  return { MockHls };
});

vi.mock("hls.js", () => ({
  default: hlsControl.MockHls,
}));

vi.mock("../api/studentApi", () => ({
  studentApi: {
    updateVideoProgress: vi.fn(),
  },
}));

import VideoPlayer, {
  buildCandidateStreamUrls,
  normalizeStreamUrl,
  resolveVideoSources,
} from "../components/VideoPlayer";

describe("VideoPlayer HLS recovery, spinner safety, CORS & lazyLoad", () => {
  const originalPlay = HTMLMediaElement.prototype.play;
  const originalPause = HTMLMediaElement.prototype.pause;
  const originalLoad = HTMLMediaElement.prototype.load;

  beforeEach(() => {
    hlsControl.MockHls.instances = [];
    hlsControl.MockHls.isSupported.mockReturnValue(true);
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    HTMLMediaElement.prototype.play = originalPlay;
    HTMLMediaElement.prototype.pause = originalPause;
    HTMLMediaElement.prototype.load = originalLoad;
  });

  it("normalizes localhost and 127.0.0.1 URLs and builds deduplicated candidate fallback URLs", () => {
    expect(
      normalizeStreamUrl("http://localhost:8080/api/v1/videos/v1/hls/master.m3u8"),
    ).toBe("/api/v1/videos/v1/hls/master.m3u8");
    expect(
      normalizeStreamUrl("http://127.0.0.1:8080/api/v1/videos/v1/raw"),
    ).toBe("/api/v1/videos/v1/raw");

    expect(
      buildCandidateStreamUrls(
        "v1",
        "http://127.0.0.1:8080/api/v1/videos/v1/hls/master.m3u8",
        "https://pub-35c3a549.r2.dev/raw/v1.mp4",
      ),
    ).toEqual([
      "/api/v1/videos/v1/hls/master.m3u8",
      "/api/v1/videos/v1/raw",
      "https://pub-35c3a549.r2.dev/raw/v1.mp4",
    ]);

    expect(
      buildCandidateStreamUrls(
        "v1",
        "/api/v1/videos/v1/hls/master.m3u8",
        "/api/v1/videos/v1/raw",
      ),
    ).toEqual(["/api/v1/videos/v1/hls/master.m3u8", "/api/v1/videos/v1/raw"]);

    expect(resolveVideoSources(null)).toEqual({
      isProcessing: false,
      streamUrl: "",
      rawUrl: undefined,
    });
    expect(
      resolveVideoSources({
        id: "v-proc",
        status: "PROCESSING",
        rawStorageUrl: "/api/v1/videos/v-proc/raw",
      }),
    ).toMatchObject({ isProcessing: true });
    expect(
      resolveVideoSources({
        id: "v-ready",
        status: "APPROVED",
        hlsPlaylistUrl: "/api/v1/videos/v-ready/hls/master.m3u8",
        rawStorageUrl: "https://pub.r2.dev/raw/v-ready.mp4",
      }),
    ).toEqual({
      isProcessing: false,
      streamUrl: "/api/v1/videos/v-ready/hls/master.m3u8",
      rawUrl: "https://pub.r2.dev/raw/v-ready.mp4",
    });
    expect(
      resolveVideoSources({
        id: "v-raw",
        status: "PENDING_REVIEW",
        rawStorageUrl: "https://pub.r2.dev/raw/v-raw.mp4",
      }),
    ).toEqual({
      isProcessing: false,
      streamUrl: "https://pub.r2.dev/raw/v-raw.mp4",
      rawUrl: "https://pub.r2.dev/raw/v-raw.mp4",
    });
  });

  it("recovers cleanly from fatal MANIFEST_LOAD_ERROR to /raw, clears spinner, avoids crossOrigin, and resumes playback", () => {
    vi.useFakeTimers();

    const { container } = render(
      <VideoPlayer
        videoId="vid-hls-1"
        streamUrl="http://127.0.0.1:8080/api/v1/videos/vid-hls-1/hls/master.m3u8"
        rawUrl="https://pub-35c3a549.r2.dev/raw/vid-hls-1.mp4"
        enableProgressSync={false}
      />,
    );

    const videoEl = container.querySelector("video") as HTMLVideoElement;
    expect(videoEl.hasAttribute("crossorigin")).toBe(false);
    expect(hlsControl.MockHls.instances).toHaveLength(1);
    const hls = hlsControl.MockHls.instances[0];
    expect(hls.loadSource).toHaveBeenCalledWith(
      "/api/v1/videos/vid-hls-1/hls/master.m3u8",
    );

    // User presses Play and browser enters waiting/buffering
    fireEvent.click(screen.getByLabelText("Phát"));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    fireEvent.waiting(videoEl);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByLabelText("Đang tải video")).toBeInTheDocument();

    // Manifest fails (e.g. R2 CORS or 404) with levels = []
    hls.startLoad.mockClear();
    act(() => {
      hls.emit(hlsControl.MockHls.Events.ERROR, {
        fatal: true,
        type: hlsControl.MockHls.ErrorTypes.NETWORK_ERROR,
        details: hlsControl.MockHls.ErrorDetails.MANIFEST_LOAD_ERROR,
        response: { code: 0 },
      });
    });

    // Must NOT stay in dead STOPPED state via startLoad(); must destroy & switch to /raw
    expect(hls.startLoad).not.toHaveBeenCalled();
    expect(hls.destroy).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Đang tải video")).not.toBeInTheDocument();
    expect(videoEl.getAttribute("src")).toBe("/api/v1/videos/vid-hls-1/raw");
    expect(videoEl.hasAttribute("crossorigin")).toBe(false);
    // Resumes play on the fallback raw stream
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it("retries once via loadSource when no fallback exists, then renders retry UI when all sources fail", () => {
    const { container } = render(
      <VideoPlayer
        videoId=""
        streamUrl="https://stream.example.com/only/master.m3u8"
        enableProgressSync={false}
      />,
    );

    expect(hlsControl.MockHls.instances).toHaveLength(1);
    const firstHls = hlsControl.MockHls.instances[0];
    expect(firstHls.loadSource).toHaveBeenCalledTimes(1);

    // 1st fatal transient manifest error -> reloads via loadSource, never startLoad()
    act(() => {
      firstHls.emit(hlsControl.MockHls.Events.ERROR, {
        fatal: true,
        type: hlsControl.MockHls.ErrorTypes.NETWORK_ERROR,
        details: hlsControl.MockHls.ErrorDetails.MANIFEST_LOAD_ERROR,
        response: { code: 503 },
      });
    });
    expect(firstHls.startLoad).not.toHaveBeenCalled();
    expect(firstHls.loadSource).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // 2nd fatal manifest error -> exhausts candidates -> shows error UI + Retry button
    act(() => {
      firstHls.emit(hlsControl.MockHls.Events.ERROR, {
        fatal: true,
        type: hlsControl.MockHls.ErrorTypes.NETWORK_ERROR,
        details: hlsControl.MockHls.ErrorDetails.MANIFEST_LOAD_ERROR,
        response: { code: 503 },
      });
    });
    expect(firstHls.destroy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByLabelText("Đang tải video")).not.toBeInTheDocument();
    expect(container.querySelector("video")?.getAttribute("src")).toBeNull();

    // Clicking "Thử lại" clears error and creates a fresh Hls instance
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(hlsControl.MockHls.instances).toHaveLength(2);
    expect(hlsControl.MockHls.instances[1].loadSource).toHaveBeenCalledWith(
      "https://stream.example.com/only/master.m3u8",
    );
  });

  it("retries post-manifest fragment errors with startLoad once before falling back across raw candidates to error UI", () => {
    const { container } = render(
      <VideoPlayer
        videoId="vid-multi"
        streamUrl="/api/v1/videos/vid-multi/hls/master.m3u8"
        rawUrl="https://cdn.example.com/raw/vid-multi.mp4"
        enableProgressSync={false}
      />,
    );

    const videoEl = container.querySelector("video") as HTMLVideoElement;
    const hls = hlsControl.MockHls.instances[0];
    hls.levels = [{ height: 720 }];
    act(() => {
      hls.emit(hlsControl.MockHls.Events.MANIFEST_PARSED);
    });

    // 1st fragment network error -> startLoad() recovery
    act(() => {
      hls.emit(hlsControl.MockHls.Events.ERROR, {
        fatal: true,
        type: hlsControl.MockHls.ErrorTypes.NETWORK_ERROR,
        details: hlsControl.MockHls.ErrorDetails.FRAG_LOAD_ERROR,
        response: { code: 500 },
      });
    });
    expect(hls.startLoad).toHaveBeenCalled();

    // 2nd fragment error -> falls back to /api/v1/videos/vid-multi/raw
    act(() => {
      hls.emit(hlsControl.MockHls.Events.ERROR, {
        fatal: true,
        type: hlsControl.MockHls.ErrorTypes.NETWORK_ERROR,
        details: hlsControl.MockHls.ErrorDetails.FRAG_LOAD_ERROR,
        response: { code: 500 },
      });
    });
    expect(videoEl.getAttribute("src")).toBe("/api/v1/videos/vid-multi/raw");

    // Proxy raw fails -> falls back to external rawUrl
    fireEvent.error(videoEl);
    expect(videoEl.getAttribute("src")).toBe("https://cdn.example.com/raw/vid-multi.mp4");

    // External raw fails -> shows error + retry overlay
    fireEvent.error(videoEl);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("clears buffering spinner on canPlay/pause/streamUrl change and skips cross-origin Range prefetch", () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const { container, rerender } = render(
        <VideoPlayer
          videoId="vid-xorigin"
          streamUrl="https://pub-35c3a549.r2.dev/raw/clip.mp4"
          enableProgressSync={false}
        />,
      );

      const videoEl = container.querySelector("video") as HTMLVideoElement;
      expect(videoEl.getAttribute("src")).toBe("https://pub-35c3a549.r2.dev/raw/clip.mp4");
      expect(videoEl.hasAttribute("crossorigin")).toBe(false);

      // Buffering clears on canPlay
      fireEvent.waiting(videoEl);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByLabelText("Đang tải video")).toBeInTheDocument();
      fireEvent.canPlay(videoEl);
      expect(screen.queryByLabelText("Đang tải video")).not.toBeInTheDocument();

      // Buffering clears on pause
      fireEvent.waiting(videoEl);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByLabelText("Đang tải video")).toBeInTheDocument();
      fireEvent.pause(videoEl);
      expect(screen.queryByLabelText("Đang tải video")).not.toBeInTheDocument();

      // Clicking play on cross-origin MP4 must NOT issue fetch with Range header
      fireEvent.click(screen.getByLabelText("Phát"));
      expect(fetchMock).not.toHaveBeenCalled();

      // Changing streamUrl with same videoId resets candidate & spinner state cleanly
      fireEvent.waiting(videoEl);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByLabelText("Đang tải video")).toBeInTheDocument();

      rerender(
        <VideoPlayer
          videoId="vid-xorigin"
          streamUrl="/api/v1/videos/vid-xorigin/raw"
          enableProgressSync={false}
        />,
      );
      expect(screen.queryByLabelText("Đang tải video")).not.toBeInTheDocument();
      expect(videoEl.getAttribute("src")).toBe("/api/v1/videos/vid-xorigin/raw");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("lazyLoad defers HLS initialization and media preloading until user clicks play", () => {
    const { container } = render(
      <VideoPlayer
        videoId="vid-lazy"
        streamUrl="/api/v1/videos/vid-lazy/hls/master.m3u8"
        enableProgressSync={false}
        lazyLoad
      />,
    );

    const videoEl = container.querySelector("video") as HTMLVideoElement;
    expect(hlsControl.MockHls.instances).toHaveLength(0);
    expect(videoEl.getAttribute("src")).toBeNull();
    expect(videoEl.getAttribute("preload")).toBe("none");

    // Clicking center play initializes HLS with capped moderation buffer sizes and starts playback on MANIFEST_PARSED
    fireEvent.click(screen.getByLabelText("Phát video"));
    expect(hlsControl.MockHls.instances).toHaveLength(1);
    const hls = hlsControl.MockHls.instances[0];
    expect(hls.config.maxBufferSize).toBe(30_000_000);
    expect(hls.loadSource).toHaveBeenCalledWith(
      "/api/v1/videos/vid-lazy/hls/master.m3u8",
    );

    hls.levels = [{ height: 720 }];
    act(() => {
      hls.emit(hlsControl.MockHls.Events.MANIFEST_PARSED);
    });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });
});
