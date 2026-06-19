import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Session } from "./types";

export function listSessions(): Promise<Session[]> {
  return invoke<Session[]>("list_sessions");
}

export function renameSession(
  filePath: string,
  sessionId: string,
  newTitle: string,
): Promise<void> {
  return invoke("rename_session", { filePath, sessionId, newTitle });
}

export function openInFinder(path: string): Promise<void> {
  return invoke("open_in_finder", { path });
}

export function openInVscode(path: string): Promise<void> {
  return invoke("open_in_vscode", { path });
}

export function getFavorites(): Promise<string[]> {
  return invoke<string[]>("get_favorites");
}

export function setFavorite(
  sessionId: string,
  favorite: boolean,
): Promise<string[]> {
  return invoke<string[]>("set_favorite", { sessionId, favorite });
}

export function getFavoriteProjects(): Promise<string[]> {
  return invoke<string[]>("get_favorite_projects");
}

export function setFavoriteProject(
  projectDir: string,
  favorite: boolean,
): Promise<string[]> {
  return invoke<string[]>("set_favorite_project", { projectDir, favorite });
}

export function copyResumeCommand(sessionId: string): Promise<void> {
  return writeText(`claude --resume ${sessionId}`);
}
