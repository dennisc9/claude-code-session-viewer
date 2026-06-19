import { describe, it, expect } from "vitest";
import { formatTokens, formatDate, formatRelative, formatModel } from "./format";

describe("formatTokens", () => {
  it("renders raw counts under 1000", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
  });

  it("renders thousands with a k suffix", () => {
    expect(formatTokens(1000)).toBe("1.0k");
    expect(formatTokens(1500)).toBe("1.5k");
    expect(formatTokens(999_999)).toBe("1000.0k");
  });

  it("renders millions with an M suffix", () => {
    expect(formatTokens(1_000_000)).toBe("1.0M");
    expect(formatTokens(2_500_000)).toBe("2.5M");
  });
});

describe("formatDate", () => {
  it("returns an em dash for null or invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formats a valid ISO timestamp into a readable string", () => {
    const out = formatDate("2026-01-15T10:30:00Z");
    // Locale/timezone-dependent exact text, but the year and month must appear.
    expect(out).toContain("2026");
    expect(out).toMatch(/Jan/);
  });
});

describe("formatRelative", () => {
  it("returns an em dash for null or invalid input", () => {
    expect(formatRelative(null)).toBe("—");
    expect(formatRelative("nope")).toBe("—");
  });

  it("buckets recent timestamps into relative phrases", () => {
    const now = Date.now();
    const iso = (ms: number) => new Date(now - ms).toISOString();
    expect(formatRelative(iso(10_000))).toBe("just now"); // < 1 min
    expect(formatRelative(iso(5 * 60_000))).toBe("5m ago");
    expect(formatRelative(iso(3 * 3_600_000))).toBe("3h ago");
    expect(formatRelative(iso(2 * 86_400_000))).toBe("2d ago");
  });

  it("falls back to an absolute date beyond 30 days", () => {
    const old = new Date(Date.now() - 60 * 86_400_000).toISOString();
    expect(formatRelative(old)).not.toMatch(/ago|just now/);
    expect(formatRelative(old)).not.toBe("—");
  });
});

describe("formatModel", () => {
  it("returns an em dash for null", () => {
    expect(formatModel(null)).toBe("—");
  });

  it("shortens known claude model ids", () => {
    expect(formatModel("claude-opus-4-7")).toBe("Opus 4.7");
    expect(formatModel("claude-sonnet-4-6")).toBe("Sonnet 4.6");
    expect(formatModel("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
    expect(formatModel("claude-fable-5-0")).toBe("Fable 5.0");
  });

  it("passes through unrecognised ids unchanged", () => {
    expect(formatModel("gpt-4o")).toBe("gpt-4o");
    expect(formatModel("custom-model")).toBe("custom-model");
  });
});
