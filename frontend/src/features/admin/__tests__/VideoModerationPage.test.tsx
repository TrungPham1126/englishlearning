import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { adminApi } from "../api/adminApi";
import VideoModerationPage from "../pages/VideoModerationPage";
import type { VideoModerationItem } from "../types";

vi.mock("../api/adminApi", () => ({
  adminApi: {
    getVideos: vi.fn(),
    reviewVideo: vi.fn(),
  },
}));

describe("VideoModerationPage playback & status handling", () => {
  const originalPlay = HTMLMediaElement.prototype.play;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    HTMLMediaElement.prototype.play = originalPlay;
    vi.restoreAllMocks();
  });

  it("renders PROCESSING videos without spinning player and APPROVED videos with lazy player and raw fallback", async () => {
    const pendingVideos: VideoModerationItem[] = [
      {
        id: "vid-processing",
        originalFileName: "still_transcoding.mp4",
        status: "PROCESSING",
        createdAt: "2026-11-15T10:00:00Z",
      },
      {
        id: "vid-pending",
        originalFileName: "pending_lecture.mp4",
        status: "PENDING_REVIEW",
        hlsPlaylistUrl: "/api/v1/videos/vid-pending/hls/master.m3u8",
        rawStorageUrl: "https://pub.r2.dev/raw/pending_lecture.mp4",
        createdAt: "2026-11-15T09:00:00Z",
      },
    ];

    const approvedVideos: VideoModerationItem[] = [
      {
        id: "27b0f7b2-4f3c-4e8b-8bb2-4c3281dc1875",
        originalFileName: "2026-11-01 20-48-10.mp4",
        status: "APPROVED",
        hlsPlaylistUrl:
          "/api/v1/videos/27b0f7b2-4f3c-4e8b-8bb2-4c3281dc1875/hls/master.m3u8",
        rawStorageUrl: "https://pub.r2.dev/raw/2026-11-01.mp4",
        createdAt: "2026-11-15T08:00:00Z",
      },
      {
        id: "vid-raw-only",
        originalFileName: "raw_fallback_only.mp4",
        status: "APPROVED",
        rawStorageUrl: "/api/v1/videos/vid-raw-only/raw",
        createdAt: "2026-11-14T08:00:00Z",
      },
    ];

    vi.mocked(adminApi.getVideos).mockImplementation(async (status) => {
      if (status === "APPROVED") return approvedVideos;
      return pendingVideos;
    });

    const { container } = render(<VideoModerationPage />);

    await waitFor(() => {
      expect(screen.getByText("still_transcoding.mp4")).toBeInTheDocument();
    });
    expect(adminApi.getVideos).toHaveBeenCalledWith("PENDING_REVIEW");

    // PROCESSING card displays explicit processing notice, NOT a spinning video element
    expect(screen.getByText("Đang xử lý video HLS")).toBeInTheDocument();
    expect(screen.getByText("Đang xử lý")).toBeInTheDocument();
    // Only the PENDING_REVIEW card mounts a <video> (lazyLoad: preload=none, no src yet)
    expect(container.querySelectorAll("video")).toHaveLength(1);
    expect(screen.queryByLabelText("Đang tải video")).not.toBeInTheDocument();

    // Switch to "Đã duyệt" tab
    fireEvent.click(screen.getByRole("button", { name: "Đã duyệt" }));

    await waitFor(() => {
      expect(screen.getByText("2026-11-01 20-48-10.mp4")).toBeInTheDocument();
    });
    expect(adminApi.getVideos).toHaveBeenCalledWith("APPROVED");
    expect(screen.getByText("raw_fallback_only.mp4")).toBeInTheDocument();

    // Both APPROVED cards (HLS and raw-only) mount lazy players cleanly with Play buttons and zero endless spinners
    const videoEls = container.querySelectorAll("video");
    expect(videoEls).toHaveLength(2);
    expect(videoEls[0].getAttribute("src")).toBeNull();
    expect(videoEls[1].getAttribute("src")).toBeNull();
    expect(screen.queryByLabelText("Đang tải video")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Phát video")).toHaveLength(2);

    // Activating the raw-only card loads its fallback raw URL without hanging
    fireEvent.click(screen.getAllByLabelText("Phát video")[1]);
    expect(videoEls[1].getAttribute("src")).toBe("/api/v1/videos/vid-raw-only/raw");
  });
});
