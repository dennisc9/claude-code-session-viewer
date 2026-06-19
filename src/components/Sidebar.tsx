export interface ProjectGroup {
  dir: string;
  label: string;
  count: number;
}

export type Filter =
  | { type: "all" }
  | { type: "favorites" }
  | { type: "project"; dir: string };

interface Props {
  projects: ProjectGroup[];
  totalCount: number;
  favoritesCount: number;
  filter: Filter;
  onSelect: (f: Filter) => void;
  /** Dirs of favorited projects, pinned to the top of the project list. */
  favoriteProjects: Set<string>;
  onToggleFavoriteProject: (dir: string) => void;
  /** Current sidebar width in px (user-resizable). */
  width: number;
}

function isActive(filter: Filter, target: Filter): boolean {
  if (filter.type !== target.type) return false;
  if (filter.type === "project" && target.type === "project") {
    return filter.dir === target.dir;
  }
  return true;
}

export function Sidebar({
  projects,
  totalCount,
  favoritesCount,
  filter,
  onSelect,
  favoriteProjects,
  onToggleFavoriteProject,
  width,
}: Props) {
  return (
    <nav className="sidebar" style={{ width }}>
      <div className="sidebar-section">
        <button
          className={`nav-item ${isActive(filter, { type: "all" }) ? "active" : ""}`}
          onClick={() => onSelect({ type: "all" })}
        >
          <span className="nav-label">All sessions</span>
          <span className="nav-count">{totalCount}</span>
        </button>
        <button
          className={`nav-item ${isActive(filter, { type: "favorites" }) ? "active" : ""}`}
          onClick={() => onSelect({ type: "favorites" })}
        >
          <span className="nav-label">★ Favorites</span>
          <span className="nav-count">{favoritesCount}</span>
        </button>
      </div>

      <div className="sidebar-heading">Projects</div>
      <div className="sidebar-section scroll">
        {projects.map((p) => {
          const starred = favoriteProjects.has(p.dir);
          return (
            <div key={p.dir} className="project-row">
              <button
                className={`project-star star ${starred ? "starred" : ""}`}
                title={starred ? "Unfavorite project" : "Favorite project"}
                aria-label={starred ? "Unfavorite project" : "Favorite project"}
                onClick={() => onToggleFavoriteProject(p.dir)}
              >
                {starred ? "★" : "☆"}
              </button>
              <button
                className={`nav-item ${
                  isActive(filter, { type: "project", dir: p.dir })
                    ? "active"
                    : ""
                }`}
                onClick={() => onSelect({ type: "project", dir: p.dir })}
                title={p.label}
              >
                <span className="nav-label">{p.label}</span>
                <span className="nav-count">{p.count}</span>
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
