---
name: update-readme
description: Proactively update README.md after any user-facing feature addition, UI change, command/script change, or dependency change. Use this automatically at the end of any session where new functionality was added or existing features were modified. Covers the "What it does" bullet list, Scripts table, Getting started/requirements, and docs/screenshot.png (retaken only when a UI change is visible on screen).
model: sonnet
---

# Update README

Run this automatically at the end of any session where a user-facing feature, UI element, npm script, or dependency changed. Skip for test-only, refactor-only, or purely internal changes with no user-visible effect.

## Step 1 — Understand what changed

Read the files that changed in this session and cross-reference against the current README:

```bash
git diff HEAD
```

Then read `README.md` to see what's currently documented.

## Step 2 — Update the README text

Edit `README.md` directly. Sections to own:

**"What it does" bullet list** — one short line per user-visible feature, verb-first (e.g. "**Favorite** sessions with a star"). Add new bullets; reword or remove outdated ones.

**Scripts table** — keep in sync with `package.json`. One row per user-facing script. Match the format of existing rows.

**Getting started / Requirements** — update only when new prerequisites, install steps, or Node/Rust version constraints change.

Rules:
- Keep bullets short — one line each.
- Don't document internal or developer-only things in the feature list.
- Never remove the caption `> The sessions shown above are sample data.` under the screenshot.

## Step 3 — Retake the screenshot (UI changes only)

**Skip this step** if the change was backend-only with no new or changed visible UI elements.

**Do this step** if a new UI element was added, existing UI layout changed, or a visible label/icon changed.

### 3a. Start the Vite dev server

```bash
npm run dev &
DEV_PID=$!
sleep 3
```

The dev server starts on port 1420.

### 3b. Open Chrome with mocked Tauri IPC

Use `mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page` to create a new page, then navigate to `http://localhost:1420` with `mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page` using the `initScript` parameter below.

**Always use this exact canonical mock data — never real `~/.claude` data:**

```javascript
window.__TAURI_INTERNALS__ = {
  invoke: async (cmd) => {
    if (cmd === 'list_sessions') {
      return [
        {
          id: 'a1b2c3d4-0001-0001-0001-000000000001',
          filePath: '/Users/demo/.claude/projects/-Users-demo-Documents-acme-web/a1b2c3d4.jsonl',
          projectDir: '-Users-demo-Documents-acme-web',
          projectLabel: 'acme-web',
          name: 'Add authentication flow',
          cwd: '/Users/demo/Documents/acme-web',
          created: '2026-06-10T09:00:00Z',
          lastActive: '2026-06-15T11:30:00Z',
          messageCount: 24,
          totalTokens: 45200,
          model: 'claude-sonnet-4-6',
          firstMessage: 'Can you help me set up OAuth2 authentication with Google?',
          lastMessage: 'The login button redirects correctly and token refresh is working.'
        },
        {
          id: 'b2c3d4e5-0002-0002-0002-000000000002',
          filePath: '/Users/demo/.claude/projects/-Users-demo-Documents-acme-api/b2c3d4e5.jsonl',
          projectDir: '-Users-demo-Documents-acme-api',
          projectLabel: 'acme-api',
          name: 'Refactor database connection pool',
          cwd: '/Users/demo/Documents/acme-api',
          created: '2026-06-12T14:00:00Z',
          lastActive: '2026-06-14T16:45:00Z',
          messageCount: 18,
          totalTokens: 32100,
          model: 'claude-sonnet-4-6',
          firstMessage: 'The connection pool is timing out under load. Can you help me tune it?',
          lastMessage: 'Pool config updated, idle timeout 30s, max connections 20.'
        },
        {
          id: 'c3d4e5f6-0003-0003-0003-000000000003',
          filePath: '/Users/demo/.claude/projects/-Users-demo-dotfiles/c3d4e5f6.jsonl',
          projectDir: '-Users-demo-dotfiles',
          projectLabel: 'dotfiles',
          name: 'Set up Zsh aliases and prompt',
          cwd: '/Users/demo/dotfiles',
          created: '2026-06-08T10:00:00Z',
          lastActive: '2026-06-13T09:15:00Z',
          messageCount: 12,
          totalTokens: 18900,
          model: 'claude-haiku-4-5',
          firstMessage: 'Help me set up a clean zsh prompt with git branch info.',
          lastMessage: 'Aliases added to .zshrc, prompt uses starship now.'
        },
        {
          id: 'd4e5f6a7-0004-0004-0004-000000000004',
          filePath: '/Users/demo/.claude/projects/-Users-demo-Documents-notes-app/d4e5f6a7.jsonl',
          projectDir: '-Users-demo-Documents-notes-app',
          projectLabel: 'notes-app',
          name: 'Add markdown export',
          cwd: '/Users/demo/Documents/notes-app',
          created: '2026-06-05T11:00:00Z',
          lastActive: '2026-06-11T15:30:00Z',
          messageCount: 31,
          totalTokens: 67800,
          model: 'claude-opus-4-8',
          firstMessage: 'I want to export notes as markdown files with frontmatter.',
          lastMessage: 'Export button added, generates .md files with YAML frontmatter.'
        },
        {
          id: 'e5f6a7b8-0005-0005-0005-000000000005',
          filePath: '/Users/demo/.claude/projects/-Users-demo-Documents-personal-site/e5f6a7b8.jsonl',
          projectDir: '-Users-demo-Documents-personal-site',
          projectLabel: 'personal-site',
          name: 'Migrate to Astro',
          cwd: '/Users/demo/Documents/personal-site',
          created: '2026-06-01T08:00:00Z',
          lastActive: '2026-06-09T14:00:00Z',
          messageCount: 42,
          totalTokens: 89300,
          model: 'claude-sonnet-4-6',
          firstMessage: 'Help me migrate my Next.js personal site to Astro.',
          lastMessage: 'Build passes, all pages render. Lighthouse score improved 87 → 98.'
        }
      ];
    }
    if (cmd === 'get_favorites') return [];
    if (cmd === 'get_favorite_projects') return [];
    if (cmd === 'set_favorite') return [];
    if (cmd === 'set_favorite_project') return [];
    return null;
  }
};
```

### 3c. Resize and screenshot

Use `mcp__plugin_chrome-devtools-mcp_chrome-devtools__resize_page` to set **1280×800**.

Wait ~1 second for React to render, then use `mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_screenshot` with `filePath` set to `docs/screenshot.png` (absolute path).

### 3d. Kill the dev server

```bash
pkill -f "vite" || true
```

## Step 4 — Verify

Confirm the README feature list accurately reflects the app's current capabilities. If the screenshot was retaken, confirm it shows the new UI element with the mock data sessions visible.
