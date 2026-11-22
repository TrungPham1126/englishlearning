// src/features/student/components/VideoPlayer.tsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Hls, { type Level } from "hls.js";
import { studentApi } from "../api/studentApi";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  CheckCircle2,
  Loader2,
  Settings,
  SlidersHorizontal,
  Wifi,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface VideoPlayerProps {
  videoId: string;
  streamUrl: string;
  /** Optional fallback raw MP4 URL (used after backend /raw proxy if HLS fails). */
  rawUrl?: string;
  initialSeconds?: number;
  enableProgressSync?: boolean;
  /** Defer media loading and cap buffer size until playback starts (for multi-card lists). */
  lazyLoad?: boolean;
}

export type QualityHeight = 1080 | 720 | 480 | 360;
export type QualitySelection = "auto" | QualityHeight;

interface NetworkInformationLike {
  downlink?: number;
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];
const QUALITY_OPTIONS: QualityHeight[] = [1080, 720, 480, 360];

function getNetworkConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection;
}

export function mapSpeedToQuality(speedMbps: number): QualityHeight {
  if (speedMbps >= 5) return 1080;
  if (speedMbps >= 2.5) return 720;
  if (speedMbps >= 1.0) return 480;
  return 360;
}

export function detectNetworkSpeedAndQuality(): {
  quality: QualityHeight;
  speedMbps: number;
} {
  const conn = getNetworkConnection();
  if (!conn) {
    return { quality: 720, speedMbps: 4.0 };
  }

  const downlink =
    typeof conn.downlink === "number" && Number.isFinite(conn.downlink) && conn.downlink > 0
      ? conn.downlink
      : null;
  const effectiveType = conn.effectiveType?.toLowerCase();

  if (effectiveType === "slow-2g" || effectiveType === "2g") {
    return { quality: 360, speedMbps: downlink ?? 0.5 };
  }

  if (downlink !== null) {
    return { quality: mapSpeedToQuality(downlink), speedMbps: downlink };
  }

  if (effectiveType === "3g") {
    return { quality: 480, speedMbps: 1.5 };
  }

  return { quality: 720, speedMbps: 4.0 };
}

function normalizeHeightToQuality(height: number): QualityHeight {
  if (height >= 900) return 1080;
  if (height >= 600) return 720;
  if (height >= 420) return 480;
  return 360;
}

function stepDownQuality(
  current: QualityHeight,
  options: QualityHeight[],
): QualityHeight {
  const sortedDesc = [...options].sort((a, b) => b - a);
  const idx = sortedDesc.indexOf(current);
  if (idx === -1) {
    return sortedDesc[sortedDesc.length - 1] ?? 360;
  }
  return sortedDesc[Math.min(idx + 1, sortedDesc.length - 1)] ?? 360;
}

function findHlsLevelIndex(levels: Level[], targetHeight: QualityHeight): number {
  if (!levels || levels.length === 0) return -1;
  let bestIdx = -1;
  let bestDiff = Number.POSITIVE_INFINITY;
  levels.forEach((level, idx) => {
    const height = level.height || 0;
    const diff = Math.abs(height - targetHeight);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

function getChunkSizeForQuality(quality: QualityHeight, speedMbps: number): number {
  if (quality >= 1080 || speedMbps >= 8) return 4 * 1024 * 1024;
  if (quality >= 720 || speedMbps >= 2.5) return 2 * 1024 * 1024;
  return 1 * 1024 * 1024;
}

function formatQualityOptionLabel(height: QualityHeight): string {
  if (height === 1080) return "1080p (FHD)";
  if (height === 720) return "720p (HD)";
  return `${height}p`;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export function normalizeStreamUrl(url: string): string {
  if (!url) return "";
  return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1):8080/, "");
}

function isSameOriginUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (typeof window === "undefined") return false;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

export interface VideoSourceFields {
  id?: string;
  hlsPlaylistUrl?: string | null;
  rawStorageUrl?: string | null;
  videoUrl?: string | null;
  status?: string | null;
}

export interface ResolvedVideoSources {
  isProcessing: boolean;
  streamUrl: string;
  rawUrl?: string;
}

/**
 * Resolves primary stream URL, raw fallback URL, and processing status from a video DTO.
 */
export function resolveVideoSources(video?: VideoSourceFields | null): ResolvedVideoSources {
  if (!video) {
    return { isProcessing: false, streamUrl: "", rawUrl: undefined };
  }
  const isProcessing = video.status === "PROCESSING" || video.status === "DRAFT";
  const proxyRawUrl = video.id ? `/api/v1/videos/${video.id}/raw` : "";
  const rawUrl = video.rawStorageUrl || video.videoUrl || proxyRawUrl || undefined;
  const streamUrl = video.hlsPlaylistUrl || video.rawStorageUrl || video.videoUrl || "";
  return { isProcessing, streamUrl, rawUrl };
}

/**
 * Builds an ordered, deduplicated playback fallback list: primary stream -> same-origin raw ->
 * backend /raw proxy -> external raw fallback.
 */
export function buildCandidateStreamUrls(
  videoId: string,
  streamUrl: string,
  rawUrl?: string,
): string[] {
  const candidates: string[] = [];
  const pushUnique = (value?: string) => {
    if (!value) return;
    const normalized = normalizeStreamUrl(value);
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  pushUnique(streamUrl);
  const normalizedRaw = rawUrl ? normalizeStreamUrl(rawUrl) : "";
  if (normalizedRaw && isSameOriginUrl(normalizedRaw)) {
    pushUnique(normalizedRaw);
  }
  if (videoId) {
    pushUnique(`/api/v1/videos/${videoId}/raw`);
  }
  if (normalizedRaw) {
    pushUnique(normalizedRaw);
  }
  return candidates;
}

export default function VideoPlayer({
  videoId,
  streamUrl,
  rawUrl,
  initialSeconds = 0,
  enableProgressSync = true,
  lazyLoad = false,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const prefetchAbortRef = useRef<AbortController | null>(null);

  // Guards & Timers
  const hasAppliedInitialSeekRef = useRef<boolean>(false);
  const bufferingTimerRef = useRef<number | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const lastSyncRef = useRef<number>(initialSeconds);
  const isMountedRef = useRef<boolean>(true);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const hasActivatedContinuousLoadRef = useRef<boolean>(false);
  const shouldResumePlaybackRef = useRef<boolean>(false);
  const isSwitchingSourceRef = useRef<boolean>(false);
  const previousSourceKeyRef = useRef<string>(
    `${videoId}|${streamUrl}|${rawUrl ?? ""}`,
  );

  // Video State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [hasActivatedContinuousLoad, setHasActivatedContinuousLoad] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);

  // Adaptive Quality & Network State (defaults to Auto matching network speed)
  const [selectedQuality, setSelectedQuality] = useState<QualitySelection>("auto");
  const [effectiveQuality, setEffectiveQuality] = useState<QualityHeight>(
    () => detectNetworkSpeedAndQuality().quality,
  );
  const [networkSpeedMbps, setNetworkSpeedMbps] = useState<number>(
    () => detectNetworkSpeedAndQuality().speedMbps,
  );
  const [availableQualities, setAvailableQualities] =
    useState<QualityHeight[]>(QUALITY_OPTIONS);

  const selectedQualityRef = useRef<QualitySelection>(selectedQuality);
  const effectiveQualityRef = useRef<QualityHeight>(effectiveQuality);
  const networkSpeedRef = useRef<number>(networkSpeedMbps);
  const availableQualitiesRef = useRef<QualityHeight[]>(availableQualities);
  const durationRef = useRef<number>(duration);
  const playbackErrorRef = useRef<string | null>(playbackError);

  selectedQualityRef.current = selectedQuality;
  effectiveQualityRef.current = effectiveQuality;
  networkSpeedRef.current = networkSpeedMbps;
  availableQualitiesRef.current = availableQualities;
  durationRef.current = duration;
  playbackErrorRef.current = playbackError;

  // UI Control states
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const candidateUrls = useMemo(
    () => buildCandidateStreamUrls(videoId, streamUrl, rawUrl),
    [videoId, streamUrl, rawUrl],
  );
  const activeStreamUrl = candidateUrls[candidateIndex] ?? "";
  const candidateUrlsRef = useRef<string[]>(candidateUrls);
  const candidateIndexRef = useRef<number>(candidateIndex);
  candidateUrlsRef.current = candidateUrls;
  candidateIndexRef.current = candidateIndex;

  const shouldLoadMedia = !lazyLoad || hasActivatedContinuousLoad;
  const isHlsStream = activeStreamUrl.toLowerCase().includes(".m3u8");
  const isHlsJsSupported = typeof Hls?.isSupported === "function" && Hls.isSupported();
  const canUseHlsJs = Boolean(
    shouldLoadMedia && !playbackError && activeStreamUrl && isHlsStream && isHlsJsSupported,
  );

  const clearBufferingState = useCallback(() => {
    if (bufferingTimerRef.current !== null) {
      window.clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
    setIsBuffering(false);
  }, []);

  const safePlay = useCallback(
    (videoEl: HTMLVideoElement) => {
      try {
        const playResult = videoEl.play?.() as unknown;
        if (
          playResult &&
          typeof (playResult as Promise<void>).catch === "function"
        ) {
          (playResult as Promise<void>).catch((err) => {
            if (err?.name === "NotAllowedError" && isMountedRef.current) {
              shouldResumePlaybackRef.current = false;
              setIsPlaying(false);
              clearBufferingState();
            }
          });
        }
      } catch {
        // Ignore synchronous play() errors in restricted environments
      }
    },
    [clearBufferingState],
  );

  const failCurrentCandidate = useCallback(
    (failedUrl: string) => {
      clearBufferingState();
      const urls = candidateUrlsRef.current;
      const currentIdx = candidateIndexRef.current;
      if (urls[currentIdx] !== failedUrl) {
        return;
      }
      if (currentIdx + 1 < urls.length) {
        isSwitchingSourceRef.current = true;
        candidateIndexRef.current = currentIdx + 1;
        setCandidateIndex(currentIdx + 1);
        setPlaybackError(null);
        return;
      }
      isSwitchingSourceRef.current = false;
      shouldResumePlaybackRef.current = false;
      setIsPlaying(false);
      setPlaybackError(
        "Không thể tải hoặc phát video. Vui lòng kiểm tra kết nối và thử lại.",
      );
    },
    [clearBufferingState],
  );

  // Reset seek guard, fallback index, adaptive quality and playback UI state when source changes
  useEffect(() => {
    const nextSourceKey = `${videoId}|${streamUrl}|${rawUrl ?? ""}`;
    if (previousSourceKeyRef.current === nextSourceKey) {
      return;
    }
    previousSourceKeyRef.current = nextSourceKey;

    dragCleanupRef.current?.();
    prefetchAbortRef.current?.abort();
    prefetchAbortRef.current = null;
    clearBufferingState();
    shouldResumePlaybackRef.current = false;
    isSwitchingSourceRef.current = false;
    candidateIndexRef.current = 0;
    setCandidateIndex(0);
    setRetryNonce(0);
    setPlaybackError(null);
    playbackErrorRef.current = null;
    hasAppliedInitialSeekRef.current = false;
    hasActivatedContinuousLoadRef.current = false;
    lastSyncRef.current = initialSeconds;
    const detected = detectNetworkSpeedAndQuality();
    setSelectedQuality("auto");
    setEffectiveQuality(detected.quality);
    setNetworkSpeedMbps(detected.speedMbps);
    setAvailableQualities(QUALITY_OPTIONS);
    setHasActivatedContinuousLoad(false);
    setIsQualityMenuOpen(false);
    setIsSpeedMenuOpen(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedEnd(0);
    setIsPlaying(false);
    setCompleted(false);
    setIsScrubbing(false);
  }, [videoId, streamUrl, rawUrl, clearBufferingState]);

  // Listen to browser Network Information changes when in Auto mode
  useEffect(() => {
    const conn = getNetworkConnection();
    if (!conn?.addEventListener) return;
    const handleConnectionChange = () => {
      const detected = detectNetworkSpeedAndQuality();
      setNetworkSpeedMbps(detected.speedMbps);
      if (selectedQualityRef.current === "auto") {
        setEffectiveQuality(detected.quality);
      }
    };
    conn.addEventListener("change", handleConnectionChange);
    return () => {
      conn.removeEventListener?.("change", handleConnectionChange);
    };
  }, []);

  // Clean up timers, active drag listeners, hls instance, and range prefetch on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      dragCleanupRef.current?.();
      prefetchAbortRef.current?.abort();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (bufferingTimerRef.current) {
        window.clearTimeout(bufferingTimerRef.current);
      }
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  // Buffer progress handler: Updates buffered range as chunks arrive over the network
  const updateBufferedProgress = useCallback(() => {
    if (!videoRef.current) return;
    const b = videoRef.current.buffered;
    if (b && b.length > 0) {
      const curr = videoRef.current.currentTime;
      let targetEnd = 0;
      // Tìm dải buffer đang chứa currentTime hoặc mút xa nhất đã tải
      for (let i = 0; i < b.length; i++) {
        if (curr >= b.start(i) && curr <= b.end(i)) {
          targetEnd = b.end(i);
          break;
        }
      }
      if (targetEnd === 0) {
        targetEnd = b.end(b.length - 1);
      }
      setBufferedEnd((prev) => Math.max(prev, targetEnd));
    }
  }, []);

  const activateContinuousLoad = useCallback(() => {
    if (!hasActivatedContinuousLoadRef.current) {
      hasActivatedContinuousLoadRef.current = true;
      setHasActivatedContinuousLoad(true);
    }
    if (hlsRef.current) {
      hlsRef.current.startLoad();
    }
  }, []);

  // Attach hls.js for adaptive bitrate streaming & large forward buffer
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!canUseHlsJs || !videoEl) {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      return;
    }
    isSwitchingSourceRef.current = false;

    const hls = new Hls({
      autoStartLoad: true,
      startFragPrefetch: !lazyLoad,
      maxBufferLength: lazyLoad ? 60 : 600,
      maxMaxBufferLength: lazyLoad ? 120 : 1800,
      maxBufferSize: lazyLoad ? 30 * 1000 * 1000 : 250 * 1000 * 1000,
      maxBufferHole: 0.5,
      backBufferLength: lazyLoad ? 30 : 120,
      abrEwmaDefaultEstimate: Math.max(
        300_000,
        Math.round(networkSpeedRef.current * 1_000_000),
      ),
    });
    hlsRef.current = hls;

    let mediaRecoveryAttempted = false;
    let networkRetryAttempted = false;
    let isDestroyed = false;

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(activeStreamUrl);
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (isMountedRef.current) {
        clearBufferingState();
        setPlaybackError(null);
      }
      const parsedHeights = Array.from(
        new Set(
          (hls.levels || [])
            .map((lvl) => (lvl.height ? normalizeHeightToQuality(lvl.height) : null))
            .filter((h): h is QualityHeight => h !== null),
        ),
      ).sort((a, b) => b - a);

      if (parsedHeights.length > 0 && isMountedRef.current) {
        setAvailableQualities(parsedHeights);
      }

      if (selectedQualityRef.current === "auto") {
        hls.currentLevel = -1;
        hls.nextLevel = -1;
        hls.loadLevel = -1;
        const targetIdx = findHlsLevelIndex(hls.levels, effectiveQualityRef.current);
        if (targetIdx !== -1) {
          hls.nextAutoLevel = targetIdx;
        }
      } else {
        const targetIdx = findHlsLevelIndex(hls.levels, selectedQualityRef.current);
        if (targetIdx !== -1) {
          hls.currentLevel = targetIdx;
          hls.loadLevel = targetIdx;
        }
      }
      hls.startLoad();

      if (shouldResumePlaybackRef.current && videoEl.paused) {
        safePlay(videoEl);
      }
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      const lvl = hls.levels?.[data.level];
      if (lvl?.height && isMountedRef.current) {
        setEffectiveQuality(normalizeHeightToQuality(lvl.height));
      }
    });

    hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
      const est = hls.bandwidthEstimate;
      let measuredMbps = 0;
      if (typeof est === "number" && Number.isFinite(est) && est > 0) {
        measuredMbps = Number((est / 1_000_000).toFixed(2));
      } else if (data?.frag?.stats?.loading) {
        const loading = data.frag.stats.loading;
        const elapsedSec = Math.max(0.005, (loading.end - loading.start) / 1000);
        if (data.frag.stats.total > 0) {
          measuredMbps = Number(
            ((data.frag.stats.total * 8) / (elapsedSec * 1_000_000)).toFixed(2),
          );
        }
      }
      if (measuredMbps > 0 && isMountedRef.current) {
        setNetworkSpeedMbps(Math.max(0.2, measuredMbps));
      }
      updateBufferedProgress();
    });

    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      updateBufferedProgress();
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;

      const statusCode = data.response?.code;
      const isClientHttpError =
        typeof statusCode === "number" && statusCode >= 400 && statusCode < 500;
      const manifestErrorDetails = [
        Hls.ErrorDetails?.MANIFEST_LOAD_ERROR,
        Hls.ErrorDetails?.MANIFEST_LOAD_TIMEOUT,
        Hls.ErrorDetails?.MANIFEST_PARSING_ERROR,
        Hls.ErrorDetails?.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
      ].filter(Boolean);
      const isManifestOrEmpty =
        !hls.levels?.length || manifestErrorDetails.includes(data.details);

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecoveryAttempted) {
        mediaRecoveryAttempted = true;
        hls.recoverMediaError();
        return;
      }

      const hasMoreCandidates =
        candidateIndexRef.current + 1 < candidateUrlsRef.current.length;

      if (
        data.type === Hls.ErrorTypes.NETWORK_ERROR &&
        !networkRetryAttempted &&
        !isClientHttpError
      ) {
        if (!isManifestOrEmpty) {
          networkRetryAttempted = true;
          hls.startLoad();
          return;
        }
        // Only reload manifest via loadSource when no fallback candidate exists;
        // startLoad() is a no-op when !hls.levels?.length (State.STOPPED).
        if (!hasMoreCandidates) {
          networkRetryAttempted = true;
          hls.loadSource(activeStreamUrl);
          return;
        }
      }

      clearBufferingState();
      if (hasMoreCandidates) {
        isSwitchingSourceRef.current = true;
      }
      if (!isDestroyed) {
        isDestroyed = true;
        hls.destroy();
      }
      if (hlsRef.current === hls) {
        hlsRef.current = null;
      }
      if (isMountedRef.current) {
        failCurrentCandidate(activeStreamUrl);
      }
    });

    hls.attachMedia(videoEl);

    return () => {
      if (!isDestroyed) {
        isDestroyed = true;
        hls.destroy();
      }
      if (hlsRef.current === hls) {
        hlsRef.current = null;
      }
    };
  }, [
    activeStreamUrl,
    canUseHlsJs,
    retryNonce,
    lazyLoad,
    updateBufferedProgress,
    clearBufferingState,
    failCurrentCandidate,
    safePlay,
  ]);

  // Reload or resume playback for native <video> sources after lazy activation, retry, or fallback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || canUseHlsJs || !shouldLoadMedia || !activeStreamUrl || playbackError) {
      return;
    }
    isSwitchingSourceRef.current = false;
    if (retryNonce > 0) {
      videoEl.load?.();
    }
    if (shouldResumePlaybackRef.current && videoEl.paused) {
      safePlay(videoEl);
    }
  }, [
    activeStreamUrl,
    canUseHlsJs,
    shouldLoadMedia,
    playbackError,
    retryNonce,
    safePlay,
  ]);

  // Continuous background chunk prefetch for same-origin non-HLS MP4/raw streams once playback starts
  useEffect(() => {
    prefetchAbortRef.current?.abort();
    prefetchAbortRef.current = null;

    if (
      !hasActivatedContinuousLoad ||
      canUseHlsJs ||
      !activeStreamUrl ||
      isHlsStream ||
      Boolean(playbackError) ||
      !isSameOriginUrl(activeStreamUrl)
    ) {
      return;
    }
    if (typeof fetch !== "function") {
      return;
    }

    const controller = new AbortController();
    prefetchAbortRef.current = controller;

    const runBackgroundRangePrefetch = async () => {
      let offset = 0;
      let totalBytes: number | null = null;
      let consecutiveFailures = 0;

      while (!controller.signal.aborted && isMountedRef.current) {
        if (totalBytes !== null && offset >= totalBytes) {
          break;
        }
        const chunkBytes = getChunkSizeForQuality(
          effectiveQualityRef.current,
          networkSpeedRef.current,
        );
        const end =
          totalBytes !== null
            ? Math.min(offset + chunkBytes - 1, totalBytes - 1)
            : offset + chunkBytes - 1;

        try {
          const startedAt = performance.now();
          const response = await fetch(activeStreamUrl, {
            headers: { Range: `bytes=${offset}-${end}` },
            signal: controller.signal,
            credentials: "same-origin",
          });

          if (!response || (!response.ok && response.status !== 206)) {
            if (response && [401, 403, 404, 410, 416].includes(response.status)) {
              break;
            }
            consecutiveFailures += 1;
            if (consecutiveFailures >= 2) break;
            await new Promise((r) => window.setTimeout(r, 300));
            continue;
          }
          consecutiveFailures = 0;

          const contentRange = response.headers?.get?.("content-range") || "";
          const rangeMatch = contentRange.match(/bytes\s+\d+-\d+\/(\d+)/i);
          if (rangeMatch && rangeMatch[1]) {
            totalBytes = Number(rangeMatch[1]);
          }

          const buffer = await response.arrayBuffer();
          const receivedBytes = buffer.byteLength;
          if (receivedBytes <= 0) {
            break;
          }

          const elapsedSec = Math.max(0.005, (performance.now() - startedAt) / 1000);
          const measuredMbps = Number(
            ((receivedBytes * 8) / (elapsedSec * 1_000_000)).toFixed(2),
          );
          if (isMountedRef.current && Number.isFinite(measuredMbps) && measuredMbps > 0) {
            setNetworkSpeedMbps(Math.max(0.2, measuredMbps));
            if (selectedQualityRef.current === "auto") {
              setEffectiveQuality(mapSpeedToQuality(measuredMbps));
            }
          }

          offset += receivedBytes;
          if (totalBytes !== null && totalBytes > 0 && isMountedRef.current) {
            const mediaDuration = videoRef.current?.duration || durationRef.current;
            if (mediaDuration && Number.isFinite(mediaDuration) && mediaDuration > 0) {
              const estBuffered = Math.min(
                mediaDuration,
                (offset / totalBytes) * mediaDuration,
              );
              setBufferedEnd((prev) => Math.max(prev, estBuffered));
            }
          }

          if (
            response.status !== 206 ||
            (totalBytes !== null && offset >= totalBytes) ||
            (totalBytes === null && receivedBytes < chunkBytes)
          ) {
            break;
          }

          await new Promise((r) => window.setTimeout(r, 40));
        } catch {
          break;
        }
      }
    };

    void runBackgroundRangePrefetch();

    return () => {
      controller.abort();
      if (prefetchAbortRef.current === controller) {
        prefetchAbortRef.current = null;
      }
    };
  }, [hasActivatedContinuousLoad, canUseHlsJs, activeStreamUrl, isHlsStream, playbackError]);

  // Time update handler
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);
    updateBufferedProgress();
  };

  // One-time initial seek on loadedmetadata
  const handleLoadedMetadata = () => {
    clearBufferingState();
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    setDuration(dur);
    if (initialSeconds > 0 && !hasAppliedInitialSeekRef.current) {
      videoRef.current.currentTime = initialSeconds;
      hasAppliedInitialSeekRef.current = true;
    }
    updateBufferedProgress();
  };

  // Debounced buffering state (250ms delay to prevent flickering spinner)
  const handleWaiting = () => {
    if (playbackErrorRef.current) return;
    if (bufferingTimerRef.current !== null) {
      window.clearTimeout(bufferingTimerRef.current);
    }
    bufferingTimerRef.current = window.setTimeout(() => {
      bufferingTimerRef.current = null;
      if (!isMountedRef.current || playbackErrorRef.current) return;
      setIsBuffering(true);
      if (selectedQualityRef.current === "auto") {
        setEffectiveQuality((prev) =>
          stepDownQuality(prev, availableQualitiesRef.current),
        );
        if (
          hlsRef.current &&
          hlsRef.current.levels.length > 1 &&
          hlsRef.current.nextAutoLevel > 0
        ) {
          hlsRef.current.nextAutoLevel = hlsRef.current.nextAutoLevel - 1;
        }
      }
    }, 250);
  };

  const handlePlaying = () => {
    clearBufferingState();
    setPlaybackError(null);
    setIsPlaying(true);
    shouldResumePlaybackRef.current = true;
    activateContinuousLoad();
  };

  const handleReadyToPlay = () => {
    clearBufferingState();
    setPlaybackError(null);
  };

  // ==========================================
  // STUDENT PROGRESS PERSISTENCE (Every 10s)
  // ==========================================
  useEffect(() => {
    if (!enableProgressSync) return;

    const interval = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused) {
        const current = Math.floor(videoRef.current.currentTime);
        const dur = videoRef.current.duration || 1;
        const isFinished = current >= dur * 0.95;

        if (Math.abs(current - lastSyncRef.current) >= 5 || isFinished) {
          lastSyncRef.current = current;
          try {
            await studentApi.updateVideoProgress(videoId, current, isFinished);
            if (isFinished) setCompleted(true);
            window.dispatchEvent(
              new CustomEvent("student-progress-updated", {
                detail: { videoId, completed: isFinished, watchedSeconds: current },
              }),
            );
          } catch (e) {
            console.error("Không thể cập nhật tiến độ video:", e);
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [videoId, enableProgressSync]);

  // ==========================================
  // PLAY / PAUSE / SEEK / QUALITY CONTROLS
  // ==========================================
  const handleRetry = () => {
    clearBufferingState();
    setPlaybackError(null);
    playbackErrorRef.current = null;
    candidateIndexRef.current = 0;
    setCandidateIndex(0);
    shouldResumePlaybackRef.current = true;
    setIsPlaying(true);
    activateContinuousLoad();
    setRetryNonce((n) => n + 1);
    resetHideControlsTimer();
  };

  const togglePlay = () => {
    if (playbackErrorRef.current) {
      handleRetry();
      return;
    }
    if (!videoRef.current) return;
    setIsQualityMenuOpen(false);
    setIsSpeedMenuOpen(false);
    if (!shouldLoadMedia) {
      shouldResumePlaybackRef.current = true;
      setIsPlaying(true);
      activateContinuousLoad();
      resetHideControlsTimer();
      return;
    }
    activateContinuousLoad();
    if (videoRef.current.paused) {
      shouldResumePlaybackRef.current = true;
      safePlay(videoRef.current);
      setIsPlaying(true);
    } else {
      shouldResumePlaybackRef.current = false;
      clearBufferingState();
      videoRef.current.pause();
      setIsPlaying(false);
      // Keep downloading video continuously even when paused
      if (!lazyLoad) {
        hlsRef.current?.startLoad();
      }
    }
    resetHideControlsTimer();
  };

  const seekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    const target = Math.max(
      0,
      Math.min(videoRef.current.currentTime + seconds, duration),
    );
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    resetHideControlsTimer();
  };

  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(newVol, 1));
    videoRef.current.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
    resetHideControlsTimer();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
      if (volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
    resetHideControlsTimer();
  };

  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setIsSpeedMenuOpen(false);
    resetHideControlsTimer();
  };

  const changeQuality = (quality: QualitySelection) => {
    setSelectedQuality(quality);
    selectedQualityRef.current = quality;
    if (quality === "auto") {
      const autoTarget = mapSpeedToQuality(networkSpeedRef.current);
      setEffectiveQuality(autoTarget);
      if (hlsRef.current) {
        hlsRef.current.currentLevel = -1;
        hlsRef.current.nextLevel = -1;
        hlsRef.current.loadLevel = -1;
        hlsRef.current.startLoad();
      }
    } else {
      setEffectiveQuality(quality);
      if (hlsRef.current) {
        const levelIndex = findHlsLevelIndex(hlsRef.current.levels, quality);
        if (levelIndex !== -1) {
          hlsRef.current.currentLevel = levelIndex;
          hlsRef.current.loadLevel = levelIndex;
        }
        hlsRef.current.startLoad();
      }
    }
    setIsQualityMenuOpen(false);
    resetHideControlsTimer();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
    }
    resetHideControlsTimer();
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // ==========================================
  // AUTO-HIDE CONTROLS (Netflix / YouTube style)
  // ==========================================
  const resetHideControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying && !isSpeedMenuOpen && !isQualityMenuOpen) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }, [isPlaying, isSpeedMenuOpen, isQualityMenuOpen]);

  const handleMouseMove = () => {
    resetHideControlsTimer();
  };

  const handleMouseLeave = () => {
    if (isPlaying && !isSpeedMenuOpen && !isQualityMenuOpen) {
      setControlsVisible(false);
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    } else {
      resetHideControlsTimer();
    }
  }, [isPlaying, resetHideControlsTimer]);

  // ==========================================
  // SCRUBBER / SEEK BAR INTERACTION
  // ==========================================
  const calculateScrubPosition = (e: ReactMouseEvent | MouseEvent) => {
    if (!scrubberRef.current || duration <= 0) return 0;
    const rect = scrubberRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    return pos * duration;
  };

  const handleScrubberMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    if (!videoRef.current) return;
    dragCleanupRef.current?.();
    setIsScrubbing(true);
    const target = calculateScrubPosition(e);
    videoRef.current.currentTime = target;
    setCurrentTime(target);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!videoRef.current) return;
      const nextTarget = calculateScrubPosition(moveEvent);
      videoRef.current.currentTime = nextTarget;
      setCurrentTime(nextTarget);
    };

    const cleanupDrag = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (dragCleanupRef.current === cleanupDrag) {
        dragCleanupRef.current = null;
      }
    };

    const onMouseUp = () => {
      cleanupDrag();
      if (isMountedRef.current) {
        setIsScrubbing(false);
      }
    };

    dragCleanupRef.current = cleanupDrag;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleScrubberHover = (e: ReactMouseEvent) => {
    if (!scrubberRef.current || duration <= 0) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    setHoverPosition(ratio * 100);
    setHoverTime(ratio * duration);
  };

  const handleScrubberLeave = () => {
    setHoverPosition(null);
    setHoverTime(null);
  };

  // ==========================================
  // KEYBOARD SHORTCUTS
  // ==========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (!containerRef.current?.contains(document.activeElement)) {
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekRelative(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekRelative(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, volume, isMuted, duration]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`aspect-video relative w-full rounded-xl overflow-hidden bg-black select-none outline-none group/player shadow-elevated transition-all ${
        !controlsVisible && isPlaying ? "cursor-none" : "cursor-default"
      }`}
    >
      {/* 1. BACKGROUND GRADIENT: Thay thế hoàn toàn video nền thứ 2 gây nghẽn băng thông */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-slate-900 to-black pointer-events-none"
      />

      {/* 2. FOREGROUND VIDEO: Video phát chính duy nhất */}
      <video
        ref={videoRef}
        src={
          shouldLoadMedia && !playbackError && !canUseHlsJs && activeStreamUrl
            ? activeStreamUrl
            : undefined
        }
        preload={shouldLoadMedia ? (lazyLoad ? "metadata" : "auto") : "none"}
        playsInline
        controls={false}
        onError={() => {
          if (canUseHlsJs || !shouldLoadMedia || !activeStreamUrl) {
            return;
          }
          failCurrentCandidate(activeStreamUrl);
        }}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          clearBufferingState();
          setPlaybackError(null);
          setIsPlaying(true);
          shouldResumePlaybackRef.current = true;
          activateContinuousLoad();
        }}
        onPause={() => {
          clearBufferingState();
          setIsPlaying(false);
          if (!playbackErrorRef.current && !isSwitchingSourceRef.current) {
            shouldResumePlaybackRef.current = false;
            if (!lazyLoad) {
              activateContinuousLoad();
            }
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onProgress={updateBufferedProgress}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={handleReadyToPlay}
        onCanPlay={handleReadyToPlay}
        onCanPlayThrough={clearBufferingState}
        onAbort={clearBufferingState}
        onEmptied={clearBufferingState}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onEnded={async () => {
          clearBufferingState();
          shouldResumePlaybackRef.current = false;
          if (!isMountedRef.current) return;
          setIsPlaying(false);
          const videoEl = videoRef.current;
          if (enableProgressSync && videoEl) {
            const dur = Math.floor(videoEl.duration || currentTime);
            try {
              await studentApi.updateVideoProgress(videoId, dur, true);
              if (!isMountedRef.current) return;
              setCompleted(true);
              window.dispatchEvent(
                new CustomEvent("student-progress-updated", {
                  detail: { videoId, completed: true, watchedSeconds: dur },
                }),
              );
            } catch (e) {
              console.error("Không thể cập nhật tiến độ video khi kết thúc:", e);
              if (isMountedRef.current) {
                setCompleted(true);
              }
            }
          } else {
            setCompleted(true);
          }
        }}
        className="relative z-10 w-full h-full object-contain cursor-pointer"
      />

      {/* 3. CENTER PLAY / PAUSE / BUFFERING / ERROR OVERLAY */}
      {playbackError ? (
        <div
          role="alert"
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-white max-w-xs mb-3">
            {playbackError}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>
        </div>
      ) : (
        <div
          onClick={togglePlay}
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
        >
          {isBuffering ? (
            <div
              role="status"
              aria-label="Đang tải video"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-elevated animate-in zoom-in-75 duration-200"
            >
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-white" />
            </div>
          ) : !isPlaying ? (
            <button
              type="button"
              aria-label="Phát video"
              className="pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 hover:bg-rose-600/90 text-white backdrop-blur-md border border-white/20 flex items-center justify-center shadow-elevated transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer group"
            >
              <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-white translate-x-1 group-hover:scale-105 transition-transform" />
            </button>
          ) : null}
        </div>
      )}

      {/* 4. COMPLETED BADGE (Top right) */}
      {completed && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 rounded-md bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md shadow-md border border-emerald-400/40 animate-in fade-in duration-300">
          <CheckCircle2 size={15} className="text-emerald-200" />
          <span>Hoàn thành bài học</span>
        </div>
      )}

      {/* 5. NETFLIX / YOUTUBE CUSTOM CONTROLS OVERLAY */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 pt-16 pb-3 sm:pb-4 px-4 sm:px-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-all duration-300 flex flex-col justify-end gap-2.5 ${
          !playbackError && (controlsVisible || !isPlaying)
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        {/* A. SCRUBBER / SEEK BAR */}
        <div
          ref={scrubberRef}
          onMouseDown={handleScrubberMouseDown}
          onMouseMove={handleScrubberHover}
          onMouseLeave={handleScrubberLeave}
          className="relative w-full h-4 flex items-center cursor-pointer group/scrubber select-none"
        >
          {/* Rail Background */}
          <div className="w-full h-1.5 group-hover/scrubber:h-2 bg-white/25 rounded-full overflow-hidden transition-all duration-150 relative">
            {/* Buffered Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/40 rounded-full transition-all duration-200"
              style={{ width: `${Math.min(bufferedPercent, 100)}%` }}
            />
            {/* Played Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-rose-600 rounded-full transition-all"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>

          {/* Scrubber Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-rose-600 border-2 border-white rounded-full shadow-lg scale-0 group-hover/scrubber:scale-100 transition-transform -translate-x-1/2 pointer-events-none"
            style={{ left: `${Math.min(progressPercent, 100)}%` }}
          />

          {/* Hover Time Tooltip */}
          {hoverPosition !== null && hoverTime !== null && (
            <div
              className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/90 border border-white/10 text-[11px] font-mono font-semibold text-white pointer-events-none shadow-card backdrop-blur-sm"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* B. TOOLBAR BUTTONS */}
        <div className="flex items-center justify-between text-white select-none">
          {/* Left Controls: Play, 10s skip, Volume, Timestamp */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            {/* Play / Pause Toggle */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Tạm dừng" : "Phát"}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white translate-x-0.5" />
              )}
            </button>

            {/* Rewind 10s */}
            <button
              type="button"
              onClick={() => seekRelative(-10)}
              title="Lùi 10 giây (←)"
              aria-label="Lùi 10 giây"
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors cursor-pointer relative group/btn"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="absolute -bottom-1 -right-0.5 text-[8px] font-extrabold text-white/80 pointer-events-none">
                10
              </span>
            </button>

            {/* Forward 10s */}
            <button
              type="button"
              onClick={() => seekRelative(10)}
              title="Tiến 10 giây (→)"
              aria-label="Tiến 10 giây"
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors cursor-pointer relative group/btn"
            >
              <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="absolute -bottom-1 -right-0.5 text-[8px] font-extrabold text-white/80 pointer-events-none">
                10
              </span>
            </button>

            {/* Volume Control with hover-expanding slider */}
            <div className="flex items-center group/volume">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <div className="overflow-hidden transition-all duration-300 w-0 group-hover/volume:w-16 sm:group-hover/volume:w-20 group-hover/volume:ml-1 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-rose-600 focus:outline-none"
                  aria-label="Thanh âm lượng"
                />
              </div>
            </div>

            {/* Timestamp Display */}
            <div className="text-xs sm:text-sm font-medium text-white/90 font-mono tracking-tight ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/40 mx-1">/</span>
              <span className="text-white/60">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls: Quality Selector, Playback Speed, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2 relative">
            {/* Quality Selector Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsQualityMenuOpen((prev) => !prev);
                  setIsSpeedMenuOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg hover:bg-white/15 text-xs font-bold text-white/90 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                title="Chất lượng phát"
                aria-label="Chất lượng phát"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>
                  {selectedQuality === "auto"
                    ? `Tự động (${effectiveQuality}p)`
                    : `${selectedQuality}p`}
                </span>
              </button>

              {/* Quality Popover */}
              {isQualityMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2 py-1.5 bg-zinc-900/95 border border-white/15 rounded-xl shadow-elevated backdrop-blur-md min-w-[170px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-3 py-1.5 border-b border-white/10 mb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                      Chất lượng
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 tabular-nums">
                      <Wifi className="w-3 h-3" />
                      ~{networkSpeedMbps.toFixed(1)} Mbps
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => changeQuality("auto")}
                    className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer ${
                      selectedQuality === "auto"
                        ? "text-rose-400 font-bold"
                        : "text-white/80"
                    }`}
                  >
                    <span>Tự động ({effectiveQuality}p)</span>
                    {selectedQuality === "auto" && (
                      <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                  </button>

                  {availableQualities.map((quality) => (
                    <button
                      key={quality}
                      type="button"
                      onClick={() => changeQuality(quality)}
                      className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer ${
                        selectedQuality === quality
                          ? "text-rose-400 font-bold"
                          : "text-white/80"
                      }`}
                    >
                      <span>{formatQualityOptionLabel(quality)}</span>
                      {selectedQuality === quality && (
                        <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Playback Speed Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsSpeedMenuOpen((prev) => !prev);
                  setIsQualityMenuOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg hover:bg-white/15 text-xs font-bold text-white/90 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                title="Tốc độ phát"
                aria-label="Tốc độ phát"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{playbackSpeed === 1 ? "1x" : `${playbackSpeed}x`}</span>
              </button>

              {/* Speed Popover */}
              {isSpeedMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2 py-1.5 bg-zinc-900/95 border border-white/15 rounded-xl shadow-elevated backdrop-blur-md min-w-[110px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white/40 border-b border-white/10 mb-1">
                    Tốc độ phát
                  </div>
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => changePlaybackSpeed(rate)}
                      className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer ${
                        playbackSpeed === rate
                          ? "text-rose-400 font-bold"
                          : "text-white/80"
                      }`}
                    >
                      <span>{rate === 1 ? "Chuẩn (1.0x)" : `${rate}x`}</span>
                      {playbackSpeed === rate && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Thu nhỏ (f)" : "Toàn màn hình (f)"}
              aria-label={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
