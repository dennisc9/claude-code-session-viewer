/** Build a Session for tests, overriding only the fields a test cares about. */
import type { Session } from "../types";

export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "id-1",
    filePath: "/tmp/id-1.jsonl",
    projectDir: "-Users-me-proj",
    projectLabel: "proj",
    name: "A session",
    cwd: "/Users/me/proj",
    created: "2026-01-01T00:00:00Z",
    lastActive: "2026-01-02T00:00:00Z",
    messageCount: 4,
    totalTokens: 1234,
    model: "claude-opus-4-7",
    firstMessage: "first message",
    lastMessage: "last message",
    ...overrides,
  };
}
