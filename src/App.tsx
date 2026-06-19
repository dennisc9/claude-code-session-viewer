import { useCallback, useEffect, useMemo, useState } from "react";
import {
  copyResumeCommand,
  getFavorites,
  listSessions,
  openInVscode,
  renameSession,
  setFavorite,
} from "./api";
import type { Session, SortKey } from "./types";
import { filterSortSessions } from "./filter";
import { Sidebar, type Filter, type ProjectGroup } from "./components/Sidebar";
import { SessionCard } from "./components/SessionCard";
import "./App.css";

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>({ type: "all" });
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, favs] = await Promise.all([listSessions(), getFavorites()]);
      setSessions(s);
      setFavorites(new Set(favs));
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

  // Project groups for the sidebar.
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
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [sessions]);

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
        <div className="brand">Claude Session Viewer</div>
        <input
          className="search"
          type="text"
          placeholder="Search name, first or last message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="sort">
          Sort:
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="lastActive">Last active</option>
            <option value="created">Created</option>
          </select>
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
                onVscode={onVscode}
              />
            ))}
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
