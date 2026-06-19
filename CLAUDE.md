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

## Tests

Run the relevant suite(s) after any change, plus `npm run build` to typecheck. There is no linter.

- `npm test` — frontend unit/component tests once (Vitest + React Testing Library, jsdom). `npm run test:watch` for watch mode.
  - Covers `src/format.ts`, `src/filter.ts` (the extracted filter/sort/search logic), the `components/`, and the `src/api.ts` IPC argument contract. Tests live next to the code as `*.test.ts(x)`; shared helpers/setup are in `src/test/`.
- `cd src-tauri && cargo test` — Rust backend tests in the `#[cfg(test)]` module at the bottom of `lib.rs`.
  - `cargo`/`rustc` are installed via rustup and may not be on a fresh shell's PATH — run `. "$HOME/.cargo/env"` first if `cargo` isn't found.
  - File-touching tests use the `tempfile` dev-dependency and never read or write real `~/.claude` data.

When you change something, run the matching suite: touch `lib.rs` → `cargo test`; touch anything under `src/` → `npm test`. Both must stay green.

**Every new feature must include tests.** New IPC commands get a test in `src/api.test.ts` verifying the command name and camelCase argument shape. New UI interactions (buttons, handlers) get tests in the relevant `*.test.tsx` covering the enabled/disabled state and the callback being fired.

**Never edit a test just to make it pass.** A failing test means the code regressed — fix the code, not the assertion. Only change a test when the behavior it checks was *intentionally* changed (and say so explicitly); otherwise treat a red test as a real bug to investigate, not an obstacle to silence. The frontend filter/sort logic is intentionally extracted into the pure `src/filter.ts` so it can be tested without rendering `App.tsx` — keep that logic there rather than re-inlining it into the `useMemo`. Favorites read/write logic lives in the pure `read_favorites`/`write_favorite` helpers (the `AppHandle`-bound commands just call them) so it stays unit-testable — keep that split.

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
