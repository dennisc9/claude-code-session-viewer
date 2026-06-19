import { describe, it, expect, beforeEach } from "vitest";
import {
  clampSidebarWidth,
  loadSidebarWidth,
  saveSidebarWidth,
  SIDEBAR_MIN,
  SIDEBAR_MAX,
  SIDEBAR_DEFAULT,
} from "./layout";

describe("clampSidebarWidth", () => {
  it("keeps an in-range width unchanged (rounded)", () => {
    expect(clampSidebarWidth(300)).toBe(300);
    expect(clampSidebarWidth(300.6)).toBe(301);
  });

  it("clamps below the minimum and above the maximum", () => {
    expect(clampSidebarWidth(10)).toBe(SIDEBAR_MIN);
    expect(clampSidebarWidth(9999)).toBe(SIDEBAR_MAX);
  });

  it("falls back to the default for non-finite input", () => {
    expect(clampSidebarWidth(NaN)).toBe(SIDEBAR_DEFAULT);
    expect(clampSidebarWidth(Infinity)).toBe(SIDEBAR_DEFAULT);
  });
});

describe("loadSidebarWidth / saveSidebarWidth", () => {
  beforeEach(() => localStorage.clear());

  it("defaults when nothing is stored", () => {
    expect(loadSidebarWidth()).toBe(SIDEBAR_DEFAULT);
  });

  it("round-trips a saved width", () => {
    saveSidebarWidth(320);
    expect(loadSidebarWidth()).toBe(320);
  });

  it("clamps a saved width on the way in and out", () => {
    saveSidebarWidth(99999);
    expect(loadSidebarWidth()).toBe(SIDEBAR_MAX);
  });

  it("defaults when the stored value is unparseable", () => {
    localStorage.setItem("sidebarWidth", "not-a-number");
    expect(loadSidebarWidth()).toBe(SIDEBAR_DEFAULT);
  });
});
