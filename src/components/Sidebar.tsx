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
}: Props) {
  return (
    <nav className="sidebar">
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
        {projects.map((p) => (
          <button
            key={p.dir}
            className={`nav-item ${
              isActive(filter, { type: "project", dir: p.dir }) ? "active" : ""
            }`}
            onClick={() => onSelect({ type: "project", dir: p.dir })}
            title={p.dir}
          >
            <span className="nav-label">{p.label}</span>
            <span className="nav-count">{p.count}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
