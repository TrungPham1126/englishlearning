import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UserSummaryDto } from "@/types/api";
import type { ShadowingEvaluationResponse } from "@/features/student/types";

const sampleUser: UserSummaryDto = {
  id: "101",
  email: "minh@elp.edu.vn",
  firstName: "Minh",
  lastName: "Tran",
  roles: ["ROLE_STUDENT"],
  avatarUrl: "/uploads/minh.png",
};

describe("store/useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("khởi tạo an toàn kể cả khi localStorage chứa JSON hỏng, mảng hoặc token 'null'/'undefined'", async () => {
    localStorage.setItem("accessToken", "null");
    localStorage.setItem("user", "{broken-json");
    let mod = await import("@/store/useAuthStore");
    expect(mod.useAuthStore.getState().accessToken).toBeNull();
    expect(mod.useAuthStore.getState().user).toBeNull();
    expect(mod.useAuthStore.getState().isAuthenticated).toBe(false);

    vi.resetModules();
    localStorage.setItem("accessToken", "undefined");
    localStorage.setItem("user", JSON.stringify(["not-an-object"]));
    mod = await import("@/store/useAuthStore");
    expect(mod.useAuthStore.getState().accessToken).toBeNull();
    expect(mod.useAuthStore.getState().user).toBeNull();
    expect(mod.useAuthStore.getState().isAuthenticated).toBe(false);

    vi.resetModules();
    localStorage.setItem("accessToken", "valid-jwt");
    localStorage.setItem("user", JSON.stringify(sampleUser));
    mod = await import("@/store/useAuthStore");
    expect(mod.useAuthStore.getState().accessToken).toBe("valid-jwt");
    expect(mod.useAuthStore.getState().user).toEqual(sampleUser);
    expect(mod.useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("hỗ trợ setAuth, setAccessToken, updateUser và logout đồng bộ localStorage", async () => {
    const { useAuthStore } = await import("@/store/useAuthStore");

    useAuthStore.getState().setAuth("tok-1", sampleUser);
    expect(localStorage.getItem("accessToken")).toBe("tok-1");
    expect(JSON.parse(localStorage.getItem("user")!)).toEqual(sampleUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().setAccessToken("tok-2");
    expect(localStorage.getItem("accessToken")).toBe("tok-2");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().setAccessToken("   ");
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    useAuthStore.getState().updateUser({ firstName: "Hoang", targetCefr: "C1" });
    expect(useAuthStore.getState().user?.firstName).toBe("Hoang");
    expect(useAuthStore.getState().user?.targetCefr).toBe("C1");
    expect(JSON.parse(localStorage.getItem("user")!).firstName).toBe("Hoang");

    localStorage.setItem("elp_student_streak", JSON.stringify({ currentStreak: 5 }));
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("elp_student_streak")).toBeNull();

    // updateUser khi user=null không làm thay đổi state hay ghi vào localStorage
    useAuthStore.getState().updateUser({ firstName: "Ghost" });
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });
});

describe("store/useAudioStore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ngăn phát chồng chéo giữa native, learner và recording, đồng thời thu hồi blob URL cũ", async () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const { useAudioStore } = await import("@/store/useAudioStore");

    useAudioStore.getState().resetAudioSession();

    useAudioStore.getState().setIsPlayingNative(true);
    expect(useAudioStore.getState().isPlayingNative).toBe(true);
    expect(useAudioStore.getState().isPlayingLearner).toBe(false);

    useAudioStore.getState().setIsPlayingLearner(true);
    expect(useAudioStore.getState().isPlayingLearner).toBe(true);
    expect(useAudioStore.getState().isPlayingNative).toBe(false);

    useAudioStore.getState().setRecordingState("recording");
    expect(useAudioStore.getState().recordingState).toBe("recording");
    expect(useAudioStore.getState().isPlayingNative).toBe(false);
    expect(useAudioStore.getState().isPlayingLearner).toBe(false);

    const blob1 = new Blob(["a"], { type: "audio/webm" });
    const blob2 = new Blob(["b"], { type: "audio/webm" });
    useAudioStore.getState().setRecordedAudio(blob1, "blob:http://localhost/rec-1");
    useAudioStore.getState().setRecordedAudio(blob2, "blob:http://localhost/rec-2");
    expect(revokeSpy).toHaveBeenCalledWith("blob:http://localhost/rec-1");

    useAudioStore.getState().pushLiveLearnerPeaks([0.2, 0.8]);
    expect(useAudioStore.getState().liveLearnerPeaks).toEqual([0.2, 0.8]);

    useAudioStore.getState().resetAudioSession();
    expect(revokeSpy).toHaveBeenCalledWith("blob:http://localhost/rec-2");
    expect(useAudioStore.getState().recordedBlob).toBeNull();
    expect(useAudioStore.getState().recordedAudioUrl).toBeNull();
    expect(useAudioStore.getState().liveLearnerPeaks).toEqual(Array(60).fill(0.06));
  });
});

describe("store/usePracticeStore", () => {
  it("buildDeterministicNativePeaks tạo mảng ổn định, không NaN khi count = 0 hoặc 1", async () => {
    const { buildDeterministicNativePeaks, usePracticeStore } = await import(
      "@/store/usePracticeStore"
    );

    expect(buildDeterministicNativePeaks("Hello world", 0)).toEqual([]);
    const single = buildDeterministicNativePeaks("Hello world", 1);
    expect(single).toHaveLength(1);
    expect(Number.isFinite(single[0])).toBe(true);
    expect(Number.isNaN(single[0])).toBe(false);

    const peaksA = buildDeterministicNativePeaks("Practice makes progress", 20);
    const peaksB = buildDeterministicNativePeaks("Practice makes progress", 20);
    expect(peaksA).toEqual(peaksB);
    expect(peaksA.every((p) => Number.isFinite(p) && p > 0 && p <= 1)).toBe(true);

    usePracticeStore.getState().resetPracticeState();
    usePracticeStore.getState().setTargetSentence("Speak clearly every day");
    expect(usePracticeStore.getState().targetSentence).toBe("Speak clearly every day");
    expect(usePracticeStore.getState().nativeStaticPeaks).toHaveLength(60);

    const evalRes = {
      overallScore: 91,
      transcript: "Speak clearly every day",
      wordEvaluations: [],
    } as unknown as ShadowingEvaluationResponse;

    usePracticeStore.getState().setEvaluationResult(evalRes, false);
    expect(usePracticeStore.getState().evaluationResult).toEqual(evalRes);
    expect(usePracticeStore.getState().isFeedbackDrawerOpen).toBe(false);

    usePracticeStore.getState().setEvaluationResult(evalRes);
    expect(usePracticeStore.getState().isFeedbackDrawerOpen).toBe(true);

    usePracticeStore.getState().resetPracticeState();
    expect(usePracticeStore.getState().evaluationResult).toBeNull();
    expect(usePracticeStore.getState().isFeedbackDrawerOpen).toBe(false);
    expect(usePracticeStore.getState().selectedWordKey).toBeNull();
  });
});
