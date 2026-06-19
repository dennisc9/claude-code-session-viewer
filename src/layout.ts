/** Sidebar width persistence + clamping, extracted so the bounds logic can be
 *  unit-tested without simulating a drag in the component. */

export const SIDEBAR_MIN = 160;
export const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 220;

const STORAGE_KEY = "sidebarWidth";

/** Keep a width within the allowed range. Non-finite input falls back to the
 *  default so a corrupt stored value can never wedge the layout. */
export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width)));
}

/** Read the persisted width, clamped; defaults when missing or unparseable. */
export function loadSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return SIDEBAR_DEFAULT;
    return clampSidebarWidth(Number(raw));
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

/** Persist the width (clamped). Storage failures are swallowed. */
export function saveSidebarWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampSidebarWidth(width)));
  } catch {
    // ignore (e.g. storage disabled)
  }
}
