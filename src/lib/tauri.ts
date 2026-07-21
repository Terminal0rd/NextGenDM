import { invoke } from "@tauri-apps/api/core";
import type {
  DownloadInfo,
  DownloadProgress,
  NewDownloadRequest,
} from "@/types/download";

// ─── Download Management Commands ────────────────────────────────────────────

export async function addDownload(
  request: NewDownloadRequest
): Promise<DownloadInfo> {
  return invoke<DownloadInfo>("add_download", { request });
}

export async function startDownload(id: string): Promise<void> {
  return invoke<void>("start_download", { id });
}

export async function pauseDownload(id: string): Promise<void> {
  return invoke<void>("pause_download", { id });
}

export async function resumeDownload(id: string): Promise<void> {
  return invoke<void>("resume_download", { id });
}

export async function cancelDownload(id: string): Promise<void> {
  return invoke<void>("cancel_download", { id });
}

export async function removeDownload(
  id: string,
  deleteFile: boolean
): Promise<void> {
  return invoke<void>("remove_download", { id, deleteFile });
}

export async function getDownload(id: string): Promise<DownloadInfo> {
  return invoke<DownloadInfo>("get_download", { id });
}

// ─── Listing & Query Commands ────────────────────────────────────────────────

export async function listDownloads(options?: {
  statusFilter?: string;
  categoryFilter?: string;
  sortBy?: string;
  sortDir?: string;
  limit?: number;
  offset?: number;
}): Promise<DownloadInfo[]> {
  return invoke<DownloadInfo[]>("list_downloads", {
    statusFilter: options?.statusFilter ?? null,
    categoryFilter: options?.categoryFilter ?? null,
    sortBy: options?.sortBy ?? null,
    sortDir: options?.sortDir ?? null,
    limit: options?.limit ?? null,
    offset: options?.offset ?? null,
  });
}

export async function getActiveProgress(): Promise<DownloadProgress[]> {
  return invoke<DownloadProgress[]>("get_active_progress");
}

// ─── File Operations ─────────────────────────────────────────────────────────

export async function openFile(id: string): Promise<void> {
  return invoke<void>("open_file", { id });
}

export async function openFolder(id: string): Promise<void> {
  return invoke<void>("open_folder", { id });
}

// ─── Settings Commands ───────────────────────────────────────────────────────

import type { AppSettings, AppSettingsUpdate } from "@/types/settings";

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function updateSettings(settingsUpdate: AppSettingsUpdate): Promise<AppSettings> {
  return invoke<AppSettings>("update_settings", { settingsUpdate });
}

// ─── Media Extraction Commands ───────────────────────────────────────────────

export async function extractMediaInfo(url: string): Promise<{ title: string | null; url: string; filename: string | null }> {
  return invoke("extract_media_info", { url });
}
