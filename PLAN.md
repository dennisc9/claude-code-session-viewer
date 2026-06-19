# Claude Code Session Viewer

## Overview
A Tauri desktop app (double-click `.app`, no terminal needed) to browse, search, and manage Claude Code sessions. Reads native Claude session files directly — no separate database.

## Stack
- **Shell:** Tauri (Rust backend for filesystem access)
- **UI:** React + TypeScript
- **Theme:** VSCode dark (always dark)
- **Favorites storage:** Tauri app data dir (`~/Library/Application Support/claude-session-viewer/`)

## Data Source
Sessions live in `~/.claude/projects/`. Each subdirectory maps to a project folder (path with `/` replaced by `-`). Each `.jsonl` file inside is one session, named by its UUID.

### Fields extracted from each JSONL:
| Field | Source |
|---|---|
| Session ID | Filename UUID |
| Name | `{"type":"ai-title","aiTitle":"..."}` entry |
| Date created | `timestamp` on first user message |
| Last active | `timestamp` on last entry |
| Folder / CWD | `cwd` field on user messages |
| Message count | `{"type":"system","subtype":"turn_duration","messageCount":N}` |
| Total tokens | Sum of `usage.input_tokens + usage.output_tokens` across all assistant messages |
| Model | `model` field on assistant messages (last seen) |
| First message | Content of first `{"type":"user"}` entry |
| Last message | `{"type":"last-prompt","lastPrompt":"..."}` entry |

### Rename behavior
Updates the `ai-title` entry in the JSONL file directly — same as `claude /rename`. No separate metadata files.

## Features

### Session List (v1 scope)
- Display all sessions as a list/card view with all fields above
- No full conversation reader in v1

### Actions per session
- **Rename** — inline edit, writes to `ai-title` in JSONL
- **Copy resume** — copies `claude --resume {sessionId}` to clipboard
- **Open VSCode** — runs `code {cwd}`
- **Favorite / unfavorite** — toggled star, persisted in app data dir

### Navigation & Filtering
- **Left sidebar:** project folders derived from `~/.claude/projects/` directory names
- **Filter by folder** — click a folder in sidebar to scope the list
- **Filter by favorites** — show only starred sessions
- **Sort by date** — created or last active
- **Search** — searches across session name, first message, last message

## Layout
```
┌─────────────────────────────────────────────────────┐
│  [Search bar]                          [Sort: Date ▾]│
├──────────────┬──────────────────────────────────────┤
│ Folders      │  Session list                        │
│              │  ┌────────────────────────────────┐  │
│ All          │  │ ★ Name          Model  Tokens  │  │
│ Navatman     │  │   Folder • Date • N messages   │  │
│ Tess         │  │   First: "..."                 │  │
│ Tess-finance │  │   Last:  "..."                 │  │
│ ...          │  │   [Resume] [VSCode] [Rename]   │  │
│              │  └────────────────────────────────┘  │
│ ★ Favorites  │  ...                                 │
└──────────────┴──────────────────────────────────────┘
```

## Decisions Log
- **Tauri over Electron** — uses macOS system WebView, ~5MB app vs ~150MB
- **Native session files only** — no shadow database; rename writes directly to JSONL
- **Favorites in app data** — only data point with no native Claude equivalent
- **List view only for v1** — full conversation reader deferred to v2
- **Always dark** — VSCode dark theme, not OS-adaptive
