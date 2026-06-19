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

/// Read the set of favorited session ids from app data.
#[tauri::command]
fn get_favorites(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = favorites_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let ids: Vec<String> = serde_json::from_str(&data).unwrap_or_default();
    Ok(ids)
}

/// Toggle a session's favorite state and persist the full set.
#[tauri::command]
fn set_favorite(
    app: tauri::AppHandle,
    session_id: String,
    favorite: bool,
) -> Result<Vec<String>, String> {
    let path = favorites_path(&app)?;
    let mut ids: BTreeSet<String> = if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str::<Vec<String>>(&data)
            .unwrap_or_default()
            .into_iter()
            .collect()
    } else {
        BTreeSet::new()
    };

    if favorite {
        ids.insert(session_id);
    } else {
        ids.remove(&session_id);
    }

    let out: Vec<String> = ids.into_iter().collect();
    fs::write(&path, serde_json::to_string(&out).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            list_sessions,
            rename_session,
            open_in_vscode,
            get_favorites,
            set_favorite
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
