import { create } from "zustand";
import type {
  DownloadInfo,
  DownloadProgress,
  DownloadStatus,
  SidebarView,
  SortDirection,
  SortField,
  DownloadCategory,
} from "@/types/download";
import { listDownloads } from "@/lib/tauri";

// ─── Store Interface ─────────────────────────────────────────────────────────

interface DownloadStore {
  // State
  downloads: DownloadInfo[];
  activeProgress: Map<string, DownloadProgress>;
  currentView: SidebarView;
  selectedCategory: DownloadCategory | null;
  isAddDialogOpen: boolean;
  isSiteGrabberOpen: boolean;
  setAddDialogOpen: (open: boolean) => void;
  setSiteGrabberOpen: (open: boolean) => void;

  // ── Intercept State ──
  interceptedUrl: string | null;
  interceptedAudioUrl: string | null;
  interceptedFilename: string | null;
  interceptedBatchUrl: string | null;
  setInterceptedUrl: (url: string | null, audio_url?: string | null, filename?: string | null) => void;
  setInterceptedBatchUrl: (url: string | null) => void;

  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  isLoading: boolean;
  activeDownloadId: string | null;

  // View actions
  setActiveDownloadId: (id: string | null) => void;
  setCurrentView: (view: SidebarView) => void;
  setSelectedCategory: (category: DownloadCategory | null) => void;
  setSearchQuery: (query: string) => void;
  setSorting: (field: SortField, dir: SortDirection) => void;
}

// ─── Store Implementation ────────────────────────────────────────────────────

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  // Initial state
  downloads: [],
  activeProgress: new Map(),
  currentView: "all",
  selectedCategory: null,
  searchQuery: "",
  sortField: "created_at",
  sortDirection: "desc",
  // ── Modals ──
  isAddDialogOpen: false,
  isSiteGrabberOpen: false,
  setAddDialogOpen: (open) => set({ isAddDialogOpen: open }),
  setSiteGrabberOpen: (open) => set({ isSiteGrabberOpen: open }),

  // ── Intercept ──
  interceptedUrl: null,
  interceptedAudioUrl: null,
  interceptedFilename: null,
  interceptedBatchUrl: null,
  setInterceptedUrl: (url, audio_url, filename) => 
    set({ interceptedUrl: url, interceptedAudioUrl: audio_url || null, interceptedFilename: filename || null }),
  setInterceptedBatchUrl: (url) => set({ interceptedBatchUrl: url }),

  isLoading: false,
  activeDownloadId: null,

  // ── View actions ─────────────────────────────────────────────
  setActiveDownloadId: (id) => set({ activeDownloadId: id }),

  setCurrentView: (view) =>
    set({ currentView: view, selectedCategory: null }),

  setSelectedCategory: (category) =>
    set({ selectedCategory: category, currentView: "category" }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSorting: (field, dir) =>
    set({ sortField: field, sortDirection: dir }),

  // ── Data actions ─────────────────────────────────────────────

  fetchDownloads: async () => {
    set({ isLoading: true });
    try {
      const downloads = await listDownloads();
      set({ downloads, isLoading: false });
    } catch (err) {
      console.error("Failed to fetch downloads:", err);
      set({ isLoading: false });
    }
  },

  updateProgress: (progress) => {
    const newMap = new Map(get().activeProgress);
    newMap.set(progress.id, progress);

    // Also update downloaded_size on the download entry for consistency
    const downloads = get().downloads.map((d) => {
      if (d.id === progress.id) {
        return {
          ...d,
          downloaded_size: progress.downloaded_bytes,
        };
      }
      return d;
    });

    set({ activeProgress: newMap, downloads });
  },

  updateDownloadStatus: (id, status) => {
    const downloads = get().downloads.map((d) =>
      d.id === id ? { ...d, status } : d
    );

    // Clean up progress if no longer active
    if (
      status === "completed" ||
      status === "failed" ||
      status === "cancelled"
    ) {
      const newMap = new Map(get().activeProgress);
      newMap.delete(id);
      set({ downloads, activeProgress: newMap });
    } else {
      set({ downloads });
    }
  },

  addDownloadToList: (info) => {
    set({ downloads: [info, ...get().downloads] });
  },

  removeDownloadFromList: (id) => {
    const downloads = get().downloads.filter((d) => d.id !== id);
    const newMap = new Map(get().activeProgress);
    newMap.delete(id);
    set({ downloads, activeProgress: newMap });
  },

  markCompleted: (id) => {
    const downloads = get().downloads.map((d) =>
      d.id === id
        ? {
            ...d,
            status: "completed" as DownloadStatus,
            completed_at: new Date().toISOString(),
          }
        : d
    );
    const newMap = new Map(get().activeProgress);
    newMap.delete(id);
    set({ downloads, activeProgress: newMap });
  },

  setError: (id, error) => {
    const downloads = get().downloads.map((d) =>
      d.id === id
        ? { ...d, status: "failed" as DownloadStatus, error_message: error }
        : d
    );
    const newMap = new Map(get().activeProgress);
    newMap.delete(id);
    set({ downloads, activeProgress: newMap });
  },
}));
