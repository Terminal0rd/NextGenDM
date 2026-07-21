import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DownloadCategory, DownloadStatus } from "@/types/download";

/**
 * Merge tailwind classes with clsx for conditional class composition.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a byte count into a human-readable string.
 * @example formatBytes(1536) => "1.5 KB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Format bytes-per-second into a readable speed string.
 * @example formatSpeed(1572864) => "1.5 MB/s"
 */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "0 B/s";
  return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Format seconds into a human-readable ETA.
 * @example formatEta(150) => "2m 30s"
 */
export function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format an ISO date string into a relative or absolute date string.
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Map a download category to a Lucide icon name.
 */
export function getCategoryIcon(category: DownloadCategory): string {
  const icons: Record<DownloadCategory, string> = {
    video: "Film",
    audio: "Music",
    image: "Image",
    document: "FileText",
    compressed: "Archive",
    program: "Package",
    iso: "Disc",
    other: "File",
  };
  return icons[category];
}

/**
 * Map a download status to a tailwind color class for the status dot.
 */
export function getStatusColor(status: DownloadStatus): string {
  const colors: Record<DownloadStatus, string> = {
    completed: "text-emerald-500",
    downloading: "text-blue-500",
    connecting: "text-blue-400",
    paused: "text-amber-500",
    failed: "text-red-500",
    cancelled: "text-zinc-500",
    queued: "text-zinc-400",
  };
  return colors[status];
}

/**
 * Human-readable label for a download status.
 */
export function getStatusLabel(status: DownloadStatus): string {
  const labels: Record<DownloadStatus, string> = {
    completed: "Completed",
    downloading: "Downloading",
    connecting: "Connecting",
    paused: "Paused",
    failed: "Failed",
    cancelled: "Cancelled",
    queued: "Queued",
  };
  return labels[status];
}
