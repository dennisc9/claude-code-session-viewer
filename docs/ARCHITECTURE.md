# Architecture

This document covers the non-obvious parts: how data flows from disk to UI, the exact
shape of the Claude Code session files we read, and the IPC command surface between the
Rust backend and the React frontend. For the product spec and feature scope, see
[`../PLAN.md`](../PLAN.md).

## Stack

| Layer            | Choice                          | Notes                                                        |
| ---------------- | ------------------------------- | ------------------------------------------------------------ |
| Shell            | Tauri 2 (Rust)                  | macOS system WebView; ~5 MB app vs ~150 MB for Electron.     |
| UI               | React 19 + TypeScript + Vite    | Plain CSS, always dark (VSCode dark theme).                  |
| Backend deps     | `serde`, `serde_json`, `dirs`   | No async runtime; all commands are synchronous.              |
| Plugins          | `opener`, `clipboard-manager`   | Must be allowlisted in `capabilities/default.json`.          |

## Data flow

```
~/.claude/projects/<project-dir>/<uuid>.jsonl
        │
        │  fs::read_dir + line-by-line JSONL parse
        ▼
  parse_session()  ──►  Session (Rust struct, serde camelCase)
        │
        │  Tauri IPC (invoke "list_sessions")
        ▼
  src/api.ts  ──►  Session (TS interface, mirrors the struct)
        │
        ▼
  App.tsx state  ──►  Sidebar + SessionCard (filter / sort / search in-memory)
```

- **No database.** Every launch re-scans `~/.claude/projects/` and parses each `.jsonl` from scratch.
  Filtering, sorting, and search all happen client-side in `App.tsx` over the in-memory list.
- **Favorites are the one piece of state with no native Claude equivalent.** They persist as JSON
  arrays inside the Tauri app-data dir: session-id favorites in `favorites.json`, and favorited
  project dirs (which pin a project to the top of the sidebar) in `favorite_projects.json`. Both files
  share the same read/write helpers (`read_favorites`/`write_favorite`), which operate on any string-id
  set. The location is resolved at runtime via `app.path().app_data_dir()`, which Tauri maps to the
  per-user, per-OS data directory (e.g. `~/Library/Application Support/<identifier>/` on macOS,
  `%APPDATA%\<identifier>\` on Windows, `~/.local/share/<identifier>/` on Linux). `<identifier>` is the
  `identifier` set in `tauri.conf.json`. Never hardcode this path — always resolve it through Tauri.

## Session file format (the read contract)

Each `.jsonl` file is one session; every line is a standalone JSON object with a `type` field.
The parser (`parse_session` in `src-tauri/src/lib.rs`) walks the lines once and pulls out:

| `Session` field  | Source line / rule                                                                 |
| ---------------- | ---------------------------------------------------------------------------------- |
| `id`             | The filename UUID (file stem).                                                     |
| `name`           | `{"type":"ai-title","aiTitle":"…"}` — **last** occurrence wins.                    |
| `cwd`            | `cwd` on the **first** `{"type":"user"}` message that has one.                     |
| `created`        | `timestamp` on the first user message that has text.                               |
| `lastActive`     | `timestamp` on the **last** line that carries one (any type).                      |
| `messageCount`   | `{"type":"system","subtype":"turn_duration","messageCount":N}` — last seen.        |
| `totalTokens`    | Sum of `message.usage.input_tokens + output_tokens` across all `assistant` lines.  |
| `model`          | `message.model` on `assistant` lines — last seen.                                  |
| `firstMessage`   | Text of the first `{"type":"user"}` message (see text extraction below).           |
| `lastMessage`    | `{"type":"last-prompt","lastPrompt":"…"}` — last seen.                             |
| `projectDir`     | Raw `~/.claude/projects` subdirectory name (path with `/` → `-`).                  |
| `projectLabel`   | Basename of `cwd`, falling back to the last `-`-segment of `projectDir`.           |

**Text extraction:** a message `content` field may be either a plain string or an array of
content blocks. `extract_text()` handles both — for arrays it concatenates the `text` of each
`{"type":"text"}` block. Blank/whitespace-only content is treated as absent.

**Robustness:** unparseable lines, empty lines, and unreadable files are skipped, not fatal —
the scan never aborts on one bad file or line.

### Write contract — rename

`rename_session` **appends** a new line to the JSONL:

```json
{"type":"ai-title","aiTitle":"<new title>","sessionId":"<uuid>"}
```

It never rewrites the file. Because the parser takes the last-seen `ai-title`, the appended line
becomes the effective name while history is preserved. This mirrors what `claude /rename` does.

## IPC command surface

All commands are defined in `src-tauri/src/lib.rs`, registered in the `invoke_handler![...]` macro
at the bottom of that file, and wrapped with typed functions in `src/api.ts`.

| Command            | Args (camelCase)                          | Returns          | Effect                                              |
| ------------------ | ----------------------------------------- | ---------------- | --------------------------------------------------- |
| `list_sessions`    | —                                         | `Session[]`      | Scan + parse all session files.                     |
| `rename_session`   | `filePath`, `sessionId`, `newTitle`       | —                | Append an `ai-title` line.                          |
| `open_in_vscode`   | `path`                                    | —                | Open a folder in VS Code (CLI, then `open -a`).     |
| `get_favorites`    | —                                         | `string[]`       | Read favorited session ids from app data.           |
| `set_favorite`     | `sessionId`, `favorite`                   | `string[]`       | Toggle and persist; returns the full updated set.   |
| `get_favorite_projects` | —                                    | `string[]`       | Read favorited project dirs from app data.          |
| `set_favorite_project`  | `projectDir`, `favorite`             | `string[]`       | Toggle and persist; returns the full updated set.   |

`copyResumeCommand` (in `api.ts`) is **not** a Rust command — it writes `claude --resume <id>` to the
clipboard via the clipboard-manager plugin directly from the frontend.

### Adding a command — checklist

1. Write the `#[tauri::command]` fn in `lib.rs`.
2. Add its name to `invoke_handler![...]`.
3. Add a typed wrapper in `src/api.ts` (argument keys must be camelCase).
4. If it returns session data, keep the Rust `Session` struct and `src/types.ts` in sync.
5. If it uses a new plugin capability, add it to `src-tauri/capabilities/default.json`.
