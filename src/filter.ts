/** Pure filter/sort/search logic for the session list, extracted from App.tsx
 *  so it can be unit-tested without rendering the component. */
import type { Session, SortKey, SortDir } from "./types";
import type { Filter, ProjectGroup } from "./components/Sidebar";

/** Order the sidebar projects: favorited ones first (each group keeping its
 *  alphabetical order), so favorites are pinned to the top of the list.
 *  Returns a new array; the input is never mutated. */
export function sortProjects(
  projects: ProjectGroup[],
  favoriteProjects: Set<string>,
): ProjectGroup[] {
  return [...projects].sort((a, b) => {
    const af = favoriteProjects.has(a.dir);
    const bf = favoriteProjects.has(b.dir);
    if (af !== bf) return af ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export interface FilterOptions {
  /** Free-text query matched against name + first + last message. */
  search: string;
  /** Active sidebar filter (all / favorites / a project dir). */
  filter: Filter;
  /** Set of favorited session ids. */
  favorites: Set<string>;
  /** Which timestamp to sort by. */
  sortKey: SortKey;
  /** Sort direction: "desc" = newest first (default), "asc" = oldest first. */
  sortDir: SortDir;
}

/** Apply the favorites/project filter, the search query, and the sort.
 *  Returns a new array; the input is never mutated. */
export function filterSortSessions(
  sessions: Session[],
  { search, filter, favorites, sortKey, sortDir }: FilterOptions,
): Session[] {
  const q = search.trim().toLowerCase();
  let list = sessions;

  if (filter.type === "favorites") {
    list = list.filter((s) => favorites.has(s.id));
  } else if (filter.type === "project") {
    list = list.filter((s) => s.projectDir === filter.dir);
  }

  if (q) {
    list = list.filter((s) => {
      const haystack = [s.name, s.firstMessage, s.lastMessage]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return [...list].sort((a, b) => {
    const av = (sortKey === "created" ? a.created : a.lastActive) ?? "";
    const bv = (sortKey === "created" ? b.created : b.lastActive) ?? "";
    const cmp = bv.localeCompare(av); // newest first
    return sortDir === "asc" ? -cmp : cmp;
  });
}
