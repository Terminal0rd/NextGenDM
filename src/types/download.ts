// ─── Download Domain Types ───────────────────────────────────────────────────

export type DownloadStatus =
  | "queued"
  | "connecting"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type DownloadCategory =
  | "video"
  | "audio"
  | "image"
  | "document"
  | "compressed"
  | "program"
  | "iso"
  | "other";

export type DownloadPriority = "low" | "normal" | "high" | "critical";

/** Full download information returned by the backend. */
export interface DownloadInfo {
  id: string;
  url: string;
  audio_url?: string;
  final_url: string | null;
  filename: string;
  save_path: string;
  total_size: number | null;
  downloaded_size: number;
  status: DownloadStatus;
  category: DownloadCategory;
  priority: DownloadPriority;
  mime_type: string | null;
  etag: string | null;
  last_modified: string | null;
  checksum_expected: string | null;
  checksum_actual: string | null;
  error_message: string | null;
  headers: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_resumable: boolean;
  average_speed: number;
}

/** Real-time progress data emitted during active downloads. */
export interface DownloadProgress {
  id: string;
  downloaded_bytes: number;
  total_bytes: number | null;
  speed_bytes_per_sec: number;
  eta_seconds: number | null;
  percentage: number;
  connections: number;
  status: DownloadStatus;
}

/** Request payload for creating a new download. */
export interface NewDownloadRequest {
  url: string;
  audio_url?: string;
  save_path?: string;
  filename?: string;
  category?: string;
  priority?: string;
  headers?: Record<string, string>;
}

// ─── UI State Types ──────────────────────────────────────────────────────────

export type SidebarView =
  | "all"
  | "active"
  | "completed"
  | "failed"
  | "category";

export type SortField = "created_at" | "filename" | "total_size" | "status";

export type SortDirection = "asc" | "desc";

/** Sidebar category filter entry. */
export interface CategoryFilter {
  category: DownloadCategory;
  label: string;
  icon: string;
}

// ─── Event Payloads ──────────────────────────────────────────────────────────

export interface DownloadStatusChangedPayload {
  id: string;
  status: DownloadStatus;
}

export interface DownloadCompletedPayload {
  id: string;
}

export interface DownloadErrorPayload {
  id: string;
  error: string;
}
