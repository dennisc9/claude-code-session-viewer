import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Tauri IPC + clipboard plugin so api.ts can be tested without the
// native shell. These guard the camelCase argument contract documented in
// docs/ARCHITECTURE.md — a snake_case regression would break the real IPC call.
const invoke = vi.fn();
const writeText = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: (...a: unknown[]) => writeText(...a),
}));

import {
  listSessions,
  renameSession,
  openInVscode,
  getFavorites,
  setFavorite,
  copyResumeCommand,
} from "./api";

describe("api", () => {
  beforeEach(() => {
    invoke.mockReset();
    writeText.mockReset();
    invoke.mockResolvedValue(undefined);
    writeText.mockResolvedValue(undefined);
  });

  it("listSessions invokes list_sessions with no args", async () => {
    invoke.mockResolvedValue([]);
    await listSessions();
    expect(invoke).toHaveBeenCalledWith("list_sessions");
  });

  it("renameSession passes camelCase filePath/sessionId/newTitle", async () => {
    await renameSession("/tmp/x.jsonl", "sid-1", "New Title");
    expect(invoke).toHaveBeenCalledWith("rename_session", {
      filePath: "/tmp/x.jsonl",
      sessionId: "sid-1",
      newTitle: "New Title",
    });
  });

  it("openInVscode passes a path arg", async () => {
    await openInVscode("/Users/me/proj");
    expect(invoke).toHaveBeenCalledWith("open_in_vscode", {
      path: "/Users/me/proj",
    });
  });

  it("getFavorites invokes get_favorites with no args", async () => {
    invoke.mockResolvedValue(["a"]);
    await expect(getFavorites()).resolves.toEqual(["a"]);
    expect(invoke).toHaveBeenCalledWith("get_favorites");
  });

  it("setFavorite passes camelCase sessionId and favorite flag", async () => {
    invoke.mockResolvedValue(["sid-1"]);
    const out = await setFavorite("sid-1", true);
    expect(invoke).toHaveBeenCalledWith("set_favorite", {
      sessionId: "sid-1",
      favorite: true,
    });
    expect(out).toEqual(["sid-1"]);
  });

  it("copyResumeCommand writes the claude --resume command to the clipboard", async () => {
    await copyResumeCommand("sid-42");
    expect(writeText).toHaveBeenCalledWith("claude --resume sid-42");
    // It must NOT go through the IPC invoke channel.
    expect(invoke).not.toHaveBeenCalled();
  });
});
