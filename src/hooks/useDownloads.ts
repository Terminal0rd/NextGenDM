import { useEffect, useMemo, useCallback } from "react";
import { useDownloadStore } from "@/stores/downloadStore";
import * as tauri from "@/lib/tauri";
import type {
  DownloadCategory,
  NewDownloadRequest,
} from "@/types/download";

/**
 * Primary hook for download list components.
 * Returns filtered/sorted downloads and action callbacks.
 */
export function useDownloads() {
  const downloads = useDownloadStore((s) => s.downloads);
  const activeProgress = useDownloadStore((s) => s.activeProgress);
  const currentView = useDownloadStore((s) => s.currentView);
  const selectedCategory = useDownloadStore((s) => s.selectedCategory);
  const searchQuery = useDownloadStore((s) => s.searchQuery);
  const sortField = useDownloadStore((s) => s.sortField);
  const sortDirection = useDownloadStore((s) => s.sortDirection);
  const isLoading = useDownloadStore((s) => s.isLoading);
  const fetchDownloads = useDownloadStore((s) => s.fetchDownloads);
  const addDownloadToList = useDownloadStore((s) => s.addDownloadToList);
  const removeDownloadFromList = useDownloadStore(
    (s) => s.removeDownloadFromList
  );

  // Fetch on mount
  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  // ── Filtering ────────────────────────────────────────────────

  const filteredDownloads = useMemo(() => {
    let list = [...downloads];

    // View filter
    switch (currentView) {
      case "active":
        list = list.filter((d) =>
          ["downloading", "connecting", "queued", "paused"].includes(d.status)
        );
        break;
      case "completed":
        list = list.filter((d) => d.status === "completed");
        break;
      case "failed":
        list = list.filter(
          (d) => d.status === "failed" || d.status === "cancelled"
        );
        break;
      case "category":
        if (selectedCategory) {
          list = list.filter((d) => d.category === selectedCategory);
        }
        break;
      case "all":
      default:
        break;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.filename.toLowerCase().includes(q) ||
          d.url.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "filename":
          cmp = a.filename.localeCompare(b.filename);
          break;
        case "total_size":
          cmp = (a.total_size ?? 0) - (b.total_size ?? 0);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "created_at":
        default:
          cmp =
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime();
          break;
      }
      return sortDirection === "desc" ? -cmp : cmp;
    });

    return list;
  }, [
    downloads,
    currentView,
    selectedCategory,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  // ── Counts for sidebar badges ────────────────────────────────

  const counts = useMemo(() => {
    const active = downloads.filter((d) =>
      ["downloading", "connecting", "queued", "paused"].includes(d.status)
    ).length;
    const completed = downloads.filter(
      (d) => d.status === "completed"
    ).length;
    const failed = downloads.filter(
      (d) => d.status === "failed" || d.status === "cancelled"
    ).length;
    return { all: downloads.length, active, completed, failed };
  }, [downloads]);

  // ── Actions ──────────────────────────────────────────────────

  const add = useCallback(
    async (request: NewDownloadRequest) => {
      const info = await tauri.addDownload(request);
      addDownloadToList(info);
      setTimeout(() => fetchDownloads(), 100);
      return info;
    },
    [addDownloadToList, fetchDownloads]
  );

  const start = useCallback(async (id: string) => {
    await tauri.startDownload(id);
  }, []);

  const pause = useCallback(async (id: string) => {
    await tauri.pauseDownload(id);
  }, []);

  const resume = useCallback(async (id: string) => {
    await tauri.resumeDownload(id);
  }, []);

  const cancel = useCallback(async (id: string) => {
    await tauri.cancelDownload(id);
  }, []);

  const remove = useCallback(
    async (id: string, deleteFile = false) => {
      await tauri.removeDownload(id, deleteFile);
      removeDownloadFromList(id);
    },
    [removeDownloadFromList]
  );

  const openFile = useCallback(async (id: string) => {
    await tauri.openFile(id);
  }, []);

  const openFolder = useCallback(async (id: string) => {
    await tauri.openFolder(id);
  }, []);

  const getProgress = useCallback(
    (id: string) => activeProgress.get(id) ?? null,
    [activeProgress]
  );

  const getCategoryCounts = useCallback(
    (category: DownloadCategory) =>
      downloads.filter((d) => d.category === category).length,
    [downloads]
  );

  return {
    downloads: filteredDownloads,
    allDownloads: downloads,
    counts,
    isLoading,
    activeProgress,
    getProgress,
    getCategoryCounts,
    refetch: fetchDownloads,
    add,
    start,
    pause,
    resume,
    cancel,
    remove,
    openFile,
    openFolder,
  } as const;
}

/**
 * Convenience selector: count of currently-active (downloading + connecting) items.
 */
export function useActiveCount(): number {
  return useDownloadStore(
    (s) =>
      s.downloads.filter(
        (d) => d.status === "downloading" || d.status === "connecting"
      ).length
  );
}
