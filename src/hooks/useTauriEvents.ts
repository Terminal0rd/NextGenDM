import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useDownloadStore } from "@/stores/downloadStore";
import type { DownloadProgress } from "@/types/download";

/**
 * Subscribe to Tauri backend events.
 * Call once at the app root – handles setup & teardown automatically.
 */
export function useTauriEvents(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateProgress = useDownloadStore((s) => s.updateProgress);
  const updateDownloadStatus = useDownloadStore((s) => s.updateDownloadStatus);
  const markCompleted = useDownloadStore((s) => s.markCompleted);
  const setError = useDownloadStore((s) => s.setError);
  const fetchDownloads = useDownloadStore((s) => s.fetchDownloads);
  const removeDownloadFromList = useDownloadStore((s) => s.removeDownloadFromList);
  const setInterceptedUrl = useDownloadStore((s) => s.setInterceptedUrl);
  const setAddDialogOpen = useDownloadStore((s) => s.setAddDialogOpen);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    async function setup() {
      // ── Progress events from the download engine ────────────
      const u1 = await listen<DownloadProgress>(
        "download-progress",
        (event) => {
          updateProgress(event.payload);
        }
      );
      unlisteners.push(u1);

      // ── Status change events ────────────────────────────────
      const u2 = await listen<any>(
        "download-status-changed",
        (event) => {
          const { id, status, error } = event.payload;
          if (status === "completed") {
            markCompleted(id);
            fetchDownloads();
          } else if (status === "failed" && error) {
            setError(id, error);
          } else {
            updateDownloadStatus(id, status);
          }
        }
      );
      unlisteners.push(u2);

      // ── Download removed events ─────────────────────────────
      const u3 = await listen<any>(
        "download-removed",
        (event) => {
          removeDownloadFromList(event.payload.id);
        }
      );
      unlisteners.push(u3);

      // ── Browser Intercepts ──────────────────────────────────
      const u4 = await listen<any>(
        "intercept-download",
        (event) => {
          const { url, audio_url, filename } = event.payload;
          if (url) {
            setInterceptedUrl(url, audio_url, filename);
            setAddDialogOpen(true);
          }
        }
      );
      unlisteners.push(u4);
    }

    setup();

    return () => {
      for (const u of unlisteners) u();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
