import { useEffect, useRef, useState } from "react";
import { Star, Pencil, LayoutGrid, Code2 } from "lucide-react";
import type { Session } from "../types";
import { formatModel, formatRelative, formatTokens } from "../format";

interface Props {
  session: Session;
  isFavorite: boolean;
  onToggleFavorite: (s: Session) => void;
  onRename: (s: Session, title: string) => Promise<void>;
  onResume: (s: Session) => void;
  onFinder: (s: Session) => void;
  onVscode: (s: Session) => void;
}

export function SessionCard({
  session,
  isFavorite,
  onToggleFavorite,
  onRename,
  onResume,
  onFinder,
  onVscode,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(session.name ?? "");
    setEditing(true);
  };

  const commit = async () => {
    const next = draft.trim();
    if (next && next !== session.name) {
      await onRename(session, next);
    }
    setEditing(false);
  };

  const title = session.name ?? "Untitled session";

  return (
    <div className="card">
      <div className="card-header">
        <button
          className={`star ${isFavorite ? "starred" : ""}`}
          title={isFavorite ? "Unfavorite" : "Favorite"}
          onClick={() => onToggleFavorite(session)}
        >
          <Star size={16} fill={isFavorite ? "currentColor" : "none"} aria-hidden />
        </button>

        {editing ? (
          <input
            ref={inputRef}
            className="rename-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <span
            className={`card-title ${session.name ? "" : "untitled"}`}
            title="Click to rename"
            onClick={startEdit}
          >
            {title}
          </span>
        )}

        {!editing && (
          <button className="rename-btn" onClick={startEdit} title="Rename">
            <Pencil size={12} aria-hidden /> Rename
          </button>
        )}

        <div className="card-meta-right">
          <span className="badge">{formatModel(session.model)}</span>
          <span className="badge tokens">
            {formatTokens(session.totalTokens)} tok
          </span>
        </div>
      </div>

      <div className="card-sub">
        <span className="project-label">{session.projectLabel}</span>
        <span className="dot">•</span>
        <span>{formatRelative(session.lastActive)}</span>
        {session.messageCount != null && (
          <>
            <span className="dot">•</span>
            <span>{session.messageCount} messages</span>
          </>
        )}
      </div>

      {session.firstMessage && (
        <div className="snippet">
          <span className="snippet-label">First</span>
          <span className="snippet-text">{session.firstMessage}</span>
        </div>
      )}
      {session.lastMessage && (
        <div className="snippet">
          <span className="snippet-label">Last</span>
          <span className="snippet-text">{session.lastMessage}</span>
        </div>
      )}

      <div className="card-actions">
        <button
          className="action-copy"
          onClick={() => onResume(session)}
          title="Copy resume command"
          aria-label="Copy resume"
        >
          Copy <code className="cmd-chip">claude --resume</code>
        </button>
        <button
          onClick={() => onFinder(session)}
          disabled={!session.cwd}
          title={session.cwd ?? "No working directory"}
        >
          <LayoutGrid size={13} aria-hidden /> Open Finder
        </button>
        <button
          onClick={() => onVscode(session)}
          disabled={!session.cwd}
          title={session.cwd ?? "No working directory"}
        >
          <Code2 size={13} aria-hidden /> Open VS Code
        </button>
      </div>
    </div>
  );
}
