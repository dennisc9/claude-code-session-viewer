/** A single Claude Code session, mirrors the Rust `Session` struct. */
export interface Session {
  id: string;
  filePath: string;
  projectDir: string;
  projectLabel: string;
  name: string | null;
  cwd: string | null;
  created: string | null;
  lastActive: string | null;
  messageCount: number | null;
  totalTokens: number;
  model: string | null;
  firstMessage: string | null;
  lastMessage: string | null;
}

export type SortKey = "lastActive" | "created";
export type SortDir = "desc" | "asc";
