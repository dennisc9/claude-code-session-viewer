# Design TODO — macOS cleanup pass

Goal: bring the UI closer to the cleaner, more "native macOS" reference mockup.
Cleaner color use, one Claude-ecosystem highlight color (coral) alongside the macOS
selection blue, a clean-line resizable sidebar with a larger hit area and a grip icon
on hover, and a consistent line-icon set throughout.

**Icon library:** [Lucide](https://lucide.dev) (`lucide-react`). Single consistent
stroke weight, tree-shakeable, matches the reference's clean line icons. Replaces the
emoji/text glyphs (`★ ☆ ⟳ • ⊞ <>`) currently used.

Each unchecked box below is one focused commit. Keep `npm run build` and `npm test`
green after every change; update tests only when a label/markup change is intentional
(say so in the commit). Preserve accessible names (`aria-label`/`title`) when swapping
visible text for icons so role-based queries keep working.

## Foundation

- [x] Add `lucide-react` dependency.
- [x] **Design tokens** — add a Claude coral accent (`--claude: #d97757` family) for the
  refresh button, Copy-resume button, and brand mark; keep macOS blue (`--accent`) for the
  sidebar active selection only. Add sidebar tokens (rounded item radius, hover/active fills).
  Define them in `:root` in `App.css`; don't hardcode hex elsewhere.

## Top bar

- [x] **Search field** — rounded pill (radius ~8px), inset left `Search` icon, softer
  border, subtle focus ring. Slightly taller.
- [x] **Sort control** — restyle as a pill button group with an `ArrowUpDown` icon; keep the
  native `<select>` for behavior but visually present it as a pill ("Sort: Last active ⇅").
- [x] **Refresh button** — coral-tinted icon button using Lucide `RefreshCw` instead of the
  `⟳` glyph; coral hover.
- [x] **Brand mark** — tighten spacing/weight so the icon + "Claude Session Viewer" reads as
  one clean lockup.

## Sidebar

- [x] **Clean-line look** — sidebar shares the content background (no elevated panel); the
  separation is the 1px resizer line only. Section heading + spacing refined.
- [x] **Rounded nav items** — items get horizontal margin + rounded corners; hover is a soft
  fill, active is the rounded macOS-blue pill (not full-bleed). Count chip on the right.
- [x] **Sidebar icons** — `Star` (gold, filled when favorited) for Favorites and project rows;
  remove the `★/☆` glyphs. Project star still only appears on hover or when starred.
- [x] **Resizer hit area + grip** — keep the visible line 1px but widen the hit target; on
  hover, reveal a centered `GripVertical` icon and tint the line coral. (Behavior in
  `layout.ts` is unchanged.)

## Session cards

- [x] **Card surface** — slightly larger radius/padding, calmer border, subtle hover lift to
  match the reference's roomier cards.
- [x] **Title row** — `Star` (gold) toggle; inline **Rename** as a small pill button with a
  `Pencil` icon next to the title (still also reachable by clicking the title to edit).
- [x] **Badges** — refine the model/token pills; tokens use the coral/accent text. Sub-line
  project label switched from blue to dim (matches reference).
- [ ] **Action buttons** — `Copy` shows the command in a monospace inset chip
  ("Copy `claude --resume`"); `Open Finder` gets a `LayoutGrid` icon, `Open VS Code` a
  `Code2` icon. Coral hover on the primary Copy action; neutral hover on the others.

## Wrap-up

- [ ] Run `/update-readme` (UI changed → retake `docs/screenshot.png` with mock data).
