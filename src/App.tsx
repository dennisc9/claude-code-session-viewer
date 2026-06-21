import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  copyResumeCommand,
  getFavoriteProjects,
  getFavorites,
  listSessions,
  openInFinder,
  openInVscode,
  renameSession,
  setFavorite,
  setFavoriteProject,
} from "./api";
import type { Session, SortKey } from "./types";
import { filterSortSessions, sortProjects } from "./filter";
import { clampSidebarWidth, loadSidebarWidth, saveSidebarWidth } from "./layout";
import iconUrl from "./assets/icon.png";
import { Sidebar, type Filter, type ProjectGroup } from "./components/Sidebar";
import { SessionCard } from "./components/SessionCard";
import { Search, ArrowUpDown } from "lucide-react";
import "./App.css";

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteProjects, setFavoriteProjects] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>({ type: "all" });
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, favs, projFavs] = await Promise.all([
        listSessions(),
        getFavorites(),
        getFavoriteProjects(),
      ]);
      setSessions(s);
      setFavorites(new Set(favs));
      setFavoriteProjects(new Set(projFavs));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // Drag the divider to resize the sidebar; persist the final width.
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;
    let latest = startWidth;

    const onMove = (ev: MouseEvent) => {
      latest = clampSidebarWidth(startWidth + ev.clientX - startX);
      setSidebarWidth(latest);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      saveSidebarWidth(latest);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Project groups for the sidebar, favorited projects pinned to the top.
  const projects = useMemo<ProjectGroup[]>(() => {
    const map = new Map<string, ProjectGroup>();
    for (const s of sessions) {
      const existing = map.get(s.projectDir);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(s.projectDir, {
          dir: s.projectDir,
          label: s.projectLabel,
          count: 1,
        });
      }
    }
    return sortProjects([...map.values()], favoriteProjects);
  }, [sessions, favoriteProjects]);

  const visible = useMemo(
    () => filterSortSessions(sessions, { search, filter, favorites, sortKey }),
    [sessions, favorites, filter, search, sortKey],
  );

  const onToggleFavorite = useCallback(
    async (s: Session) => {
      const willFavorite = !favorites.has(s.id);
      try {
        const updated = await setFavorite(s.id, willFavorite);
        setFavorites(new Set(updated));
      } catch (e) {
        showToast(`Failed to update favorite: ${e}`);
      }
    },
    [favorites, showToast],
  );

  const onToggleFavoriteProject = useCallback(
    async (dir: string) => {
      const willFavorite = !favoriteProjects.has(dir);
      try {
        const updated = await setFavoriteProject(dir, willFavorite);
        setFavoriteProjects(new Set(updated));
      } catch (e) {
        showToast(`Failed to update project favorite: ${e}`);
      }
    },
    [favoriteProjects, showToast],
  );

  const onRename = useCallback(
    async (s: Session, title: string) => {
      try {
        await renameSession(s.filePath, s.id, title);
        setSessions((prev) =>
          prev.map((x) => (x.id === s.id ? { ...x, name: title } : x)),
        );
        showToast("Session renamed");
      } catch (e) {
        showToast(`Rename failed: ${e}`);
      }
    },
    [showToast],
  );

  const onResume = useCallback(
    async (s: Session) => {
      try {
        await copyResumeCommand(s.id);
        showToast("Resume command copied");
      } catch (e) {
        showToast(`Copy failed: ${e}`);
      }
    },
    [showToast],
  );

  const onFinder = useCallback(
    async (s: Session) => {
      if (!s.cwd) return;
      try {
        await openInFinder(s.cwd);
      } catch (e) {
        showToast(`Could not open Finder: ${e}`);
      }
    },
    [showToast],
  );

  const onVscode = useCallback(
    async (s: Session) => {
      if (!s.cwd) return;
      try {
        await openInVscode(s.cwd);
      } catch (e) {
        showToast(`Could not open VS Code: ${e}`);
      }
    },
    [showToast],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-icon" src={iconUrl} alt="" />
          Claude Session Viewer
        </div>
        <div className="search-wrap">
          <Search className="search-icon" size={15} aria-hidden />
          <input
            className="search"
            type="text"
            placeholder="Search name, first or last message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="sort">
          Sort:
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="lastActive">Last active</option>
            <option value="created">Created</option>
          </select>
          <ArrowUpDown className="sort-icon" size={13} aria-hidden />
        </label>
        <button className="refresh" onClick={load} title="Reload sessions">
          ⟳
        </button>
      </header>

      <div className="body">
        <Sidebar
          projects={projects}
          totalCount={sessions.length}
          favoritesCount={favorites.size}
          filter={filter}
          onSelect={setFilter}
          favoriteProjects={favoriteProjects}
          onToggleFavoriteProject={onToggleFavoriteProject}
          width={sidebarWidth}
        />

        <div
          className="resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onMouseDown={onResizeStart}
        />

        <main className="content">
          {loading && <div className="state">Loading sessions…</div>}
          {error && <div className="state error">{error}</div>}
          {!loading && !error && visible.length === 0 && (
            <div className="state">No sessions match.</div>
          )}
          {!loading &&
            !error &&
            visible.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                isFavorite={favorites.has(s.id)}
                onToggleFavorite={onToggleFavorite}
                onRename={onRename}
                onResume={onResume}
                onFinder={onFinder}
                onVscode={onVscode}
              />
            ))}
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
