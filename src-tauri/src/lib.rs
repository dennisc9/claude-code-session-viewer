use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;

/// One Claude Code session, distilled from a single `.jsonl` file.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Session {
    /// UUID taken from the filename.
    id: String,
    /// Absolute path to the `.jsonl` file (used for rename writes).
    file_path: String,
    /// The raw `~/.claude/projects` subdirectory name this session lives in.
    project_dir: String,
    /// Friendly project label (basename of the cwd, falling back to the dir).
    project_label: String,
    /// Last-seen `ai-title`, if any.
    name: Option<String>,
    /// Working directory from user messages.
    cwd: Option<String>,
    /// Timestamp of the first user message (ISO string).
    created: Option<String>,
    /// Timestamp of the last entry (ISO string).
    last_active: Option<String>,
    /// Message count from the last `turn_duration` system entry.
    message_count: Option<u64>,
    /// Sum of input + output tokens across assistant messages.
    total_tokens: u64,
    /// Last-seen assistant model id.
    model: Option<String>,
    /// First real user message text.
    first_message: Option<String>,
    /// Last-seen `last-prompt`.
    last_message: Option<String>,
}

/// Pull a plain-text representation out of a message `content` field, which may
/// be either a string or an array of content blocks.
fn extract_text(content: &Value) -> Option<String> {
    match content {
        Value::String(s) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }
        Value::Array(blocks) => {
            let mut parts: Vec<String> = Vec::new();
            for b in blocks {
                if b.get("type").and_then(|v| v.as_str()) == Some("text") {
                    if let Some(t) = b.get("text").and_then(|v| v.as_str()) {
                        if !t.trim().is_empty() {
                            parts.push(t.trim().to_string());
                        }
                    }
                }
            }
            if parts.is_empty() {
                None
            } else {
                Some(parts.join("\n"))
            }
        }
        _ => None,
    }
}

/// Parse a single session file into a `Session`. Returns `None` if the file is
/// empty or unreadable.
fn parse_session(path: &Path, project_dir: &str) -> Option<Session> {
    let file = fs::File::open(path).ok()?;
    let reader = BufReader::new(file);

    let id = path.file_stem()?.to_string_lossy().to_string();

    let mut name: Option<String> = None;
    let mut cwd: Option<String> = None;
    let mut created: Option<String> = None;
    let mut last_active: Option<String> = None;
    let mut message_count: Option<u64> = None;
    let mut total_tokens: u64 = 0;
    let mut model: Option<String> = None;
    let mut first_message: Option<String> = None;
    let mut last_message: Option<String> = None;

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let obj: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => continue,
        };

        // Track the last timestamp seen anywhere in the file.
        if let Some(ts) = obj.get("timestamp").and_then(|v| v.as_str()) {
            last_active = Some(ts.to_string());
        }

        let entry_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");

        match entry_type {
            "ai-title" => {
                if let Some(t) = obj.get("aiTitle").and_then(|v| v.as_str()) {
                    name = Some(t.to_string());
                }
            }
            "last-prompt" => {
                if let Some(p) = obj.get("lastPrompt").and_then(|v| v.as_str()) {
                    last_message = Some(p.to_string());
                }
            }
            "user" => {
                if cwd.is_none() {
                    if let Some(c) = obj.get("cwd").and_then(|v| v.as_str()) {
                        cwd = Some(c.to_string());
                    }
                }
                if let Some(content) = obj.get("message").and_then(|m| m.get("content")) {
                    if let Some(text) = extract_text(content) {
                        if first_message.is_none() {
                            first_message = Some(text);
                            // First user message also fixes the created time.
                            if let Some(ts) = obj.get("timestamp").and_then(|v| v.as_str()) {
                                created = Some(ts.to_string());
                            }
                        }
                    }
                }
            }
            "assistant" => {
                if let Some(message) = obj.get("message") {
                    if let Some(m) = message.get("model").and_then(|v| v.as_str()) {
                        model = Some(m.to_string());
                    }
                    if let Some(usage) = message.get("usage") {
                        let input = usage
                            .get("input_tokens")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        let output = usage
                            .get("output_tokens")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        total_tokens += input + output;
                    }
                }
            }
            "system" => {
                if obj.get("subtype").and_then(|v| v.as_str()) == Some("turn_duration") {
                    if let Some(mc) = obj.get("messageCount").and_then(|v| v.as_u64()) {
                        message_count = Some(mc);
                    }
                }
            }
            _ => {}
        }
    }

    // Friendly label: basename of cwd, else last segment of the dir name.
    let project_label = cwd
        .as_ref()
        .and_then(|c| c.rsplit('/').next())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            project_dir
                .rsplit('-')
                .next()
                .unwrap_or(project_dir)
                .to_string()
        });

    Some(Session {
        id,
        file_path: path.to_string_lossy().to_string(),
        project_dir: project_dir.to_string(),
        project_label,
        name,
        cwd,
        created,
        last_active,
        message_count,
        total_tokens,
        model,
        first_message,
        last_message,
    })
}

/// Scan `~/.claude/projects/` and return every parsed session.
#[tauri::command]
fn list_sessions() -> Result<Vec<Session>, String> {
    let home = dirs::home_dir().ok_or("Could not resolve home directory")?;
    let projects = home.join(".claude").join("projects");
    if !projects.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();
    let dirs = fs::read_dir(&projects).map_err(|e| e.to_string())?;
    for dir_entry in dirs.flatten() {
        let dir_path = dir_entry.path();
        if !dir_path.is_dir() {
            continue;
        }
        let project_dir = dir_entry.file_name().to_string_lossy().to_string();
        let files = match fs::read_dir(&dir_path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        for file_entry in files.flatten() {
            let file_path = file_entry.path();
            if file_path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }
            if let Some(session) = parse_session(&file_path, &project_dir) {
                sessions.push(session);
            }
        }
    }

    Ok(sessions)
}

/// Append a new `ai-title` entry to the session file. The viewer reads the
/// last-seen title, so appending renames without destroying history — the same
/// approach `claude /rename` uses.
#[tauri::command]
fn rename_session(file_path: String, session_id: String, new_title: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("Session file not found: {file_path}"));
    }

    let entry = serde_json::json!({
        "type": "ai-title",
        "aiTitle": new_title,
        "sessionId": session_id,
    });

    let mut file = fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{}", entry).map_err(|e| e.to_string())?;
    Ok(())
}

/// Open a directory in Finder.
#[tauri::command]
fn open_in_finder(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Could not open Finder: {e}"))?;
    Ok(())
}

/// Open a directory in VS Code. Uses the `code` CLI when available, otherwise
/// falls back to macOS `open -a`.
#[tauri::command]
fn open_in_vscode(path: String) -> Result<(), String> {
    // Try the `code` CLI first (handles common install locations since a
    // Finder-launched app has a minimal PATH).
    let candidates = [
        "code",
        "/usr/local/bin/code",
        "/opt/homebrew/bin/code",
    ];
    for c in candidates {
        if Command::new(c).arg(&path).spawn().is_ok() {
            return Ok(());
        }
    }
    // Fallback: open the folder with the VS Code application bundle.
    Command::new("open")
        .args(["-a", "Visual Studio Code", &path])
        .spawn()
        .map_err(|e| format!("Could not open VS Code: {e}"))?;
    Ok(())
}

fn favorites_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("favorites.json"))
}

/// Read favorited session ids from a `favorites.json` at `path`. Missing or
/// malformed files yield an empty set rather than an error.
fn read_favorites(path: &Path) -> Result<Vec<String>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    Ok(serde_json::from_str(&data).unwrap_or_default())
}

/// Toggle a session id in the `favorites.json` at `path` and persist the full,
/// sorted set. Returns the updated set.
fn write_favorite(path: &Path, session_id: &str, favorite: bool) -> Result<Vec<String>, String> {
    let mut ids: BTreeSet<String> = read_favorites(path)?.into_iter().collect();

    if favorite {
        ids.insert(session_id.to_string());
    } else {
        ids.remove(session_id);
    }

    let out: Vec<String> = ids.into_iter().collect();
    fs::write(path, serde_json::to_string(&out).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(out)
}

/// Read the set of favorited session ids from app data.
#[tauri::command]
fn get_favorites(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    read_favorites(&favorites_path(&app)?)
}

/// Toggle a session's favorite state and persist the full set.
#[tauri::command]
fn set_favorite(
    app: tauri::AppHandle,
    session_id: String,
    favorite: bool,
) -> Result<Vec<String>, String> {
    write_favorite(&favorites_path(&app)?, &session_id, favorite)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            list_sessions,
            rename_session,
            open_in_finder,
            open_in_vscode,
            get_favorites,
            set_favorite
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::{NamedTempFile, TempDir};

    // ---- extract_text -------------------------------------------------------

    #[test]
    fn extract_text_plain_string() {
        assert_eq!(
            extract_text(&json!("hello world")),
            Some("hello world".to_string())
        );
    }

    #[test]
    fn extract_text_trims_and_drops_blank_strings() {
        assert_eq!(extract_text(&json!("  spaced  ")), Some("spaced".to_string()));
        assert_eq!(extract_text(&json!("   ")), None);
        assert_eq!(extract_text(&json!("")), None);
    }

    #[test]
    fn extract_text_joins_text_blocks_and_ignores_others() {
        let content = json!([
            { "type": "text", "text": "first" },
            { "type": "tool_use", "name": "Bash", "input": {} },
            { "type": "tool_result", "content": "ignored" },
            { "type": "text", "text": "second" },
        ]);
        assert_eq!(extract_text(&content), Some("first\nsecond".to_string()));
    }

    #[test]
    fn extract_text_array_with_no_text_blocks_is_none() {
        let content = json!([{ "type": "tool_result", "content": "x" }]);
        assert_eq!(extract_text(&content), None);
    }

    #[test]
    fn extract_text_non_string_non_array_is_none() {
        assert_eq!(extract_text(&json!(42)), None);
        assert_eq!(extract_text(&json!(null)), None);
    }

    // ---- parse_session ------------------------------------------------------

    /// Write `lines` (already-serialized JSONL strings) to a temp `.jsonl` file
    /// whose stem is a fixed UUID, then parse it.
    fn parse_lines(lines: &[&str]) -> Session {
        let dir = TempDir::new().unwrap();
        let path = dir
            .path()
            .join("11111111-2222-3333-4444-555555555555.jsonl");
        let mut f = fs::File::create(&path).unwrap();
        for l in lines {
            writeln!(f, "{l}").unwrap();
        }
        f.flush().unwrap();
        parse_session(&path, "-Users-me-proj").expect("session should parse")
    }

    #[test]
    fn parse_session_id_comes_from_filename() {
        let s = parse_lines(&[]);
        assert_eq!(s.id, "11111111-2222-3333-4444-555555555555");
    }

    #[test]
    fn parse_session_last_ai_title_and_last_prompt_win() {
        let s = parse_lines(&[
            r#"{"type":"ai-title","aiTitle":"first title"}"#,
            r#"{"type":"last-prompt","lastPrompt":"first prompt"}"#,
            r#"{"type":"ai-title","aiTitle":"second title"}"#,
            r#"{"type":"last-prompt","lastPrompt":"final prompt"}"#,
        ]);
        assert_eq!(s.name.as_deref(), Some("second title"));
        assert_eq!(s.last_message.as_deref(), Some("final prompt"));
    }

    #[test]
    fn parse_session_sums_assistant_tokens() {
        let s = parse_lines(&[
            r#"{"type":"assistant","message":{"model":"claude-opus-4-7","usage":{"input_tokens":10,"output_tokens":5}}}"#,
            r#"{"type":"assistant","message":{"model":"claude-sonnet-4-6","usage":{"input_tokens":100,"output_tokens":50}}}"#,
        ]);
        assert_eq!(s.total_tokens, 165);
        // model = last seen assistant model.
        assert_eq!(s.model.as_deref(), Some("claude-sonnet-4-6"));
    }

    #[test]
    fn parse_session_missing_usage_fields_default_to_zero() {
        let s = parse_lines(&[
            r#"{"type":"assistant","message":{"usage":{"input_tokens":7}}}"#,
        ]);
        assert_eq!(s.total_tokens, 7);
    }

    #[test]
    fn parse_session_message_count_takes_last_turn_duration() {
        let s = parse_lines(&[
            r#"{"type":"system","subtype":"turn_duration","messageCount":2}"#,
            r#"{"type":"system","subtype":"other","messageCount":999}"#,
            r#"{"type":"system","subtype":"turn_duration","messageCount":8}"#,
        ]);
        assert_eq!(s.message_count, Some(8));
    }

    #[test]
    fn parse_session_created_and_last_active_timestamps() {
        let s = parse_lines(&[
            r#"{"type":"user","cwd":"/Users/me/proj","timestamp":"2026-01-01T00:00:00Z","message":{"content":"hi"}}"#,
            r#"{"type":"assistant","timestamp":"2026-01-01T00:00:05Z","message":{"usage":{"input_tokens":1,"output_tokens":1}}}"#,
            r#"{"type":"last-prompt","lastPrompt":"bye","timestamp":"2026-01-02T12:00:00Z"}"#,
        ]);
        // created = first user message with text; last_active = last timestamp anywhere.
        assert_eq!(s.created.as_deref(), Some("2026-01-01T00:00:00Z"));
        assert_eq!(s.last_active.as_deref(), Some("2026-01-02T12:00:00Z"));
        assert_eq!(s.first_message.as_deref(), Some("hi"));
        assert_eq!(s.cwd.as_deref(), Some("/Users/me/proj"));
    }

    #[test]
    fn parse_session_created_skips_blank_first_user_message() {
        let s = parse_lines(&[
            r#"{"type":"user","cwd":"/Users/me/proj","timestamp":"2026-01-01T00:00:00Z","message":{"content":"   "}}"#,
            r#"{"type":"user","timestamp":"2026-01-01T00:00:09Z","message":{"content":"real first"}}"#,
        ]);
        assert_eq!(s.first_message.as_deref(), Some("real first"));
        assert_eq!(s.created.as_deref(), Some("2026-01-01T00:00:09Z"));
    }

    #[test]
    fn parse_session_project_label_prefers_cwd_basename() {
        let s = parse_lines(&[
            r#"{"type":"user","cwd":"/Users/me/code/my-app","message":{"content":"hi"}}"#,
        ]);
        assert_eq!(s.project_label, "my-app");
    }

    #[test]
    fn parse_session_project_label_falls_back_to_dir_segment() {
        // No cwd anywhere -> fall back to last `-` segment of the project dir.
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("abc.jsonl");
        fs::File::create(&path).unwrap();
        let s = parse_session(&path, "-Users-me-Tess-finance").unwrap();
        assert_eq!(s.project_label, "finance");
        assert_eq!(s.cwd, None);
    }

    #[test]
    fn parse_session_skips_blank_and_malformed_lines() {
        let s = parse_lines(&[
            r#"{"type":"ai-title","aiTitle":"good"}"#,
            "",
            "   ",
            "{ this is not json",
            r#"{"type":"last-prompt","lastPrompt":"still parsed"}"#,
        ]);
        assert_eq!(s.name.as_deref(), Some("good"));
        assert_eq!(s.last_message.as_deref(), Some("still parsed"));
    }

    // ---- rename_session -----------------------------------------------------

    #[test]
    fn rename_session_appends_without_destroying_history() {
        let mut tmp = NamedTempFile::new().unwrap();
        writeln!(tmp, r#"{{"type":"ai-title","aiTitle":"old"}}"#).unwrap();
        writeln!(tmp, r#"{{"type":"user","message":{{"content":"hi"}}}}"#).unwrap();
        tmp.flush().unwrap();
        let path = tmp.path().to_path_buf();

        rename_session(
            path.to_string_lossy().to_string(),
            "sid-123".to_string(),
            "new name".to_string(),
        )
        .unwrap();

        let contents = fs::read_to_string(&path).unwrap();
        let lines: Vec<&str> = contents.lines().collect();
        // Original two lines preserved, one appended.
        assert_eq!(lines.len(), 3);
        assert!(lines[0].contains("\"old\""));
        let appended: Value = serde_json::from_str(lines[2]).unwrap();
        assert_eq!(appended["type"], "ai-title");
        assert_eq!(appended["aiTitle"], "new name");
        assert_eq!(appended["sessionId"], "sid-123");

        // Parser now reports the appended (last) title.
        let parsed = parse_session(&path, "-proj").unwrap();
        assert_eq!(parsed.name.as_deref(), Some("new name"));
    }

    #[test]
    fn rename_session_errors_on_missing_file() {
        let err = rename_session(
            "/no/such/file.jsonl".to_string(),
            "sid".to_string(),
            "x".to_string(),
        )
        .unwrap_err();
        assert!(err.contains("not found"));
    }

    // ---- favorites ----------------------------------------------------------

    #[test]
    fn read_favorites_missing_file_is_empty() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("favorites.json");
        assert_eq!(read_favorites(&path).unwrap(), Vec::<String>::new());
    }

    #[test]
    fn write_favorite_round_trips_add_and_remove() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("favorites.json");

        let after_add = write_favorite(&path, "b", true).unwrap();
        assert_eq!(after_add, vec!["b"]);
        // Sorted set: adding "a" puts it ahead of "b".
        let after_second = write_favorite(&path, "a", true).unwrap();
        assert_eq!(after_second, vec!["a", "b"]);
        // Persisted to disk between calls.
        assert_eq!(read_favorites(&path).unwrap(), vec!["a", "b"]);

        let after_remove = write_favorite(&path, "a", false).unwrap();
        assert_eq!(after_remove, vec!["b"]);
    }

    #[test]
    fn write_favorite_is_idempotent() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("favorites.json");
        write_favorite(&path, "x", true).unwrap();
        let twice = write_favorite(&path, "x", true).unwrap();
        assert_eq!(twice, vec!["x"]);
        // Removing something absent is a no-op, not an error.
        let removed = write_favorite(&path, "absent", false).unwrap();
        assert_eq!(removed, vec!["x"]);
    }
}
