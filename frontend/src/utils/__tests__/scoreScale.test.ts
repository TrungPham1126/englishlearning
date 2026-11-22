import { describe, expect, it } from "vitest";
import {
  formatScore10,
  normalizeAiScoreTo10,
  normalizeScoreTo10,
  normalizeScoreTo10OrZero,
} from "../scoreScale";

describe("scoreScale utilities", () => {
  it("normalizes 0-10 and legacy 0-100 scores to 0.0-10.0", () => {
    expect(normalizeScoreTo10(null)).toBeNull();
    expect(normalizeScoreTo10(undefined)).toBeNull();
    expect(normalizeScoreTo10("")).toBeNull();
    expect(normalizeScoreTo10(Number.NaN)).toBeNull();

    expect(normalizeScoreTo10(-5)).toBe(0);
    expect(normalizeScoreTo10(0)).toBe(0);
    expect(normalizeScoreTo10(8.4)).toBe(8.4);
    expect(normalizeScoreTo10(10)).toBe(10);
    expect(normalizeScoreTo10(36.5)).toBe(3.7);
    expect(normalizeScoreTo10(76)).toBe(7.6);
    expect(normalizeScoreTo10("78")).toBe(7.8);
    expect(normalizeScoreTo10(120)).toBe(10);
  });

  it("returns 0 fallback for normalizeScoreTo10OrZero", () => {
    expect(normalizeScoreTo10OrZero(null)).toBe(0);
    expect(normalizeScoreTo10OrZero(undefined)).toBe(0);
    expect(normalizeScoreTo10OrZero(77)).toBe(7.7);
  });

  it("formats score on scale 10 with 1 decimal place and fallback", () => {
    expect(formatScore10(null, "—")).toBe("—");
    expect(formatScore10(undefined)).toBe("0.0");
    expect(formatScore10(36.5)).toBe("3.7");
    expect(formatScore10(8)).toBe("8.0");
    expect(formatScore10(76)).toBe("7.6");
    expect(formatScore10(8.46, "0.0", 2)).toBe("8.50");
  });

  it("normalizes AI scores across Band-9, Shadowing, and legacy 0-100 modes", () => {
    expect(normalizeAiScoreTo10(null)).toBeNull();
    expect(normalizeAiScoreTo10(undefined)).toBeNull();
    expect(normalizeAiScoreTo10("")).toBeNull();
    expect(normalizeAiScoreTo10("not-a-number")).toBeNull();
    expect(normalizeAiScoreTo10(82)).toBe(8.2);
    expect(normalizeAiScoreTo10(150)).toBe(10);
    expect(normalizeAiScoreTo10(-4, "WRITING", true)).toBe(0);
    expect(normalizeAiScoreTo10(9.0, "WRITING", true)).toBe(10);
    expect(normalizeAiScoreTo10(7.5, "WRITING", true)).toBe(8.3);
    expect(normalizeAiScoreTo10(9.5, "WRITING", true)).toBe(9.5);
    expect(normalizeAiScoreTo10(8.5, "SHADOWING", true)).toBe(8.5);
    expect(normalizeAiScoreTo10(8.5, "SPEAKING", false)).toBe(8.5);
  });
});
