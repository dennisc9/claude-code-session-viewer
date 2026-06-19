# Claude Session Viewer

A Tauri desktop app to browse, search, and manage local Claude Code sessions. It reads
native session files from `~/.claude/projects/` directly — there is no separate database.

See @PLAN.md for the product spec and @docs/ARCHITECTURE.md for the data flow, the JSONL
session-file contract, and the IPC command surface.

## Commands

- `npm run tauri dev` — run the desktop app (compiles Rust + serves Vite, hot-reloads both)
- `npm run tauri build` — produce the bundled `.app` / installer in `src-tauri/target/release/bundle/`
- `npm run build` — `tsc` typecheck + Vite build of the frontend only (no Rust); use this to verify the TS compiles
- `npm run dev` — Vite dev server only; the app's IPC calls fail without the Tauri shell, so prefer `tauri dev`

There is no test suite or linter configured. Verify changes by running `npm run build` (typecheck) and `npm run tauri dev`.

## Architecture

- **Backend** (`src-tauri/src/lib.rs`) — Rust. All filesystem access, JSONL parsing, and the five
  `#[tauri::command]` functions live here. `main.rs` is just an entry point.
- **Frontend** (`src/`) — React 19 + TypeScript. `App.tsx` owns all state; `api.ts` wraps every
  `invoke` call; `components/` holds the UI; `format.ts` has display helpers.

## Conventions & gotchas

- **The Rust `Session` struct, `src/types.ts`, and `src/api.ts` are a single contract — change them together.**
  Rust serializes with `#[serde(rename_all = "camelCase")]`, so a snake_case Rust field (`file_path`)
  arrives in TS as camelCase (`filePath`). `invoke` argument keys are also camelCase (`filePath`, `sessionId`, `newTitle`).
- **Adding a backend command takes three edits:** define the `#[tauri::command]` fn, register it in
  `invoke_handler![...]` (bottom of `lib.rs`), and add a typed wrapper in `src/api.ts`.
- **New Tauri plugin capabilities must be allowlisted** in `src-tauri/capabilities/default.json`, or the
  call is denied at runtime (e.g. clipboard, opener).
- **Rename appends, never rewrites.** `rename_session` appends a new `{"type":"ai-title",...}` line to the
  JSONL; the parser uses the last-seen title. This preserves history and matches `claude /rename`. Do not
  rewrite session files in place.
- **macOS-first.** `open_in_vscode` tries the `code` CLI then falls back to `open -a "Visual Studio Code"`,
  because a Finder-launched app inherits a minimal `PATH`. Keep that fallback when touching it.
- **Always dark** (VSCode dark theme), not OS-adaptive. Styling is plain CSS in `src/App.css`.
- The dev server is pinned to port **1420** (`strictPort`) — Tauri requires it.

## Repository etiquette

- Default branch is `main`. Branch before committing; only commit or push when asked.
- Treat `~/.claude/projects/` as real user data during manual testing — rename/favorite actions write to live session files.
