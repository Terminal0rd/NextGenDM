import { useState, useRef, useEffect, useCallback } from 'react';
import { Pause, Play, FolderOpen, X, Trash2, FileText, RotateCcw, Copy, Power } from 'lucide-react';
import { cn, formatBytes, formatSpeed, formatEta, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useDownloadStore } from '@/stores/downloadStore';
import { GRID_COLS } from '@/components/downloads/DownloadList';
import { setShutdownAfter, getShutdownAfter } from '@/lib/tauri';
import type { DownloadInfo, DownloadProgress } from '@/types/download';

interface Props {
  index: number;
  download: DownloadInfo;
  progress: DownloadProgress | null;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string, del: boolean) => void;
  onOpen: (id: string) => void;
  onOpenFolder: (id: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export function DownloadItem({ index, download, progress, onPause, onResume, onCancel, onRemove, onOpen, onOpenFolder }: Props) {
  const { id, filename, status, total_size, downloaded_size, created_at } = download;
  const isActive = status === 'downloading' || status === 'connecting';
  const isPaused = status === 'paused';
  const isQueued = status === 'queued';
  const isComplete = status === 'completed';
  const isFailed = status === 'failed' || status === 'cancelled';

  const pct = progress?.percentage ?? (total_size && total_size > 0 ? (downloaded_size / total_size) * 100 : 0);
  const speed = progress?.speed_bytes_per_sec ?? 0;
  const eta = progress?.eta_seconds ?? null;

  const activeId = useDownloadStore(s => s.activeDownloadId);
  const setActiveId = useDownloadStore(s => s.setActiveDownloadId);
  const isSelected = activeId === id;

  // ── Context Menu ────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const ctxRef = useRef<HTMLDivElement>(null);
  const [shutdownAfterThis, setShutdownAfterThis] = useState(false);

  // Check shutdown_after status when context menu opens
  useEffect(() => {
    if (ctxMenu.visible) {
      getShutdownAfter().then(sid => setShutdownAfterThis(sid === id));
    }
  }, [ctxMenu.visible, id]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveId(id);
    setCtxMenu({ visible: true, x: e.clientX, y: e.clientY });
  }, [id, setActiveId]);

  useEffect(() => {
    if (!ctxMenu.visible) return;
    const close = () => setCtxMenu(prev => ({ ...prev, visible: false }));
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [ctxMenu.visible]);

  const ctxAction = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setCtxMenu(prev => ({ ...prev, visible: false }));
    fn();
  };

  return (
    <>
      <div
        onClick={() => setActiveId(id)}
        onContextMenu={handleContextMenu}
        className={cn(
          `${GRID_COLS} items-center text-xs px-3 py-2 border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors gap-2`,
          isSelected && "bg-zinc-800/60 hover:bg-zinc-800/60"
        )}
      >
        {/* # */}
        <div className="text-center text-zinc-500">{index}</div>
        {/* File Name */}
        <div className="font-medium text-zinc-200 truncate min-w-0" title={filename}>{filename}</div>
        {/* Size */}
        <div className="text-zinc-400 truncate">{total_size ? formatBytes(total_size) : '—'}</div>
        {/* Status */}
        <div className={cn("font-medium truncate", getStatusColor(status))}>
          {getStatusLabel(status)}
          {isActive && <span className="text-zinc-500 font-normal ml-1">{pct.toFixed(1)}%</span>}
        </div>
        {/* Speed */}
        <div className="text-zinc-400 truncate">{isActive && speed > 0 ? formatSpeed(speed) : '—'}</div>
        {/* ETA */}
        <div className="text-zinc-400 truncate">{isActive && eta ? formatEta(eta) : '—'}</div>
        {/* Date Added */}
        <div className="text-zinc-500 truncate">{formatDate(created_at)}</div>
        {/* Actions */}
        <div className="flex justify-center gap-0.5">
          {isActive && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10" onClick={(e) => { e.stopPropagation(); onPause(id); }} title="Pause">
              <Pause className="h-3.5 w-3.5" />
            </Button>
          )}
          {(isPaused || isQueued || isFailed) && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500 hover:text-green-400 hover:bg-green-500/10" onClick={(e) => { e.stopPropagation(); onResume(id); }} title="Resume">
              <Play className="h-3.5 w-3.5" />
            </Button>
          )}
          {isActive && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); onCancel(id); }} title="Cancel">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          {isComplete && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10" onClick={(e) => { e.stopPropagation(); onOpenFolder(id); }} title="Open Folder">
              <FolderOpen className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); onRemove(id, false); }} title="Remove">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Right-Click Context Menu ─────────────────────────────── */}
      {ctxMenu.visible && (
        <div
          ref={ctxRef}
          className="fixed z-50 min-w-[180px] rounded-lg bg-zinc-900 border border-zinc-700/60 shadow-2xl py-1 text-xs"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(isPaused || isQueued || isFailed) && (
            <button onClick={ctxAction(() => onResume(id))} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 transition-colors">
              <Play className="h-3.5 w-3.5 text-green-500" /> Resume
            </button>
          )}
          {isActive && (
            <button onClick={ctxAction(() => onPause(id))} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 transition-colors">
              <Pause className="h-3.5 w-3.5 text-yellow-500" /> Pause
            </button>
          )}
          {(isActive || isPaused || isQueued) && (
            <button onClick={ctxAction(() => onCancel(id))} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 transition-colors">
              <X className="h-3.5 w-3.5 text-red-500" /> Cancel
            </button>
          )}
          {isFailed && (
            <button onClick={ctxAction(() => onResume(id))} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 transition-colors">
              <RotateCcw className="h-3.5 w-3.5 text-blue-500" /> Retry
            </button>
          )}

          <div className="h-px bg-zinc-800 my-1" />

          {isComplete && (
            <button onClick={ctxAction(() => onOpen(id))} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 transition-colors">
              <FileText className="h-3.5 w-3.5 text-blue-400" /> Open File
            </button>
          )}
          <button onClick={ctxAction(() => onOpenFolder(id))} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 transition-colors">
            <FolderOpen className="h-3.5 w-3.5 text-cyan-400" /> Open Folder
          </button>
          <button onClick={ctxAction(() => navigator.clipboard.writeText(download.url))} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 transition-colors">
            <Copy className="h-3.5 w-3.5 text-zinc-400" /> Copy URL
          </button>

          <div className="h-px bg-zinc-800 my-1" />

          {/* Shutdown after this download */}
          {!isComplete && (
            <button
              onClick={ctxAction(() => {
                const newVal = !shutdownAfterThis;
                setShutdownAfter(newVal ? id : null);
                setShutdownAfterThis(newVal);
              })}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-1.5 text-left transition-colors",
                shutdownAfterThis
                  ? "text-orange-400 hover:bg-orange-500/10"
                  : "text-zinc-200 hover:bg-zinc-800"
              )}
            >
              <Power className={cn("h-3.5 w-3.5", shutdownAfterThis ? "text-orange-400" : "text-zinc-400")} />
              {shutdownAfterThis ? "✓ Shutdown after this" : "Shutdown after this"}
            </button>
          )}

          <div className="h-px bg-zinc-800 my-1" />

          <button onClick={ctxAction(() => onRemove(id, false))} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-zinc-400" /> Remove from List
          </button>
          <button onClick={ctxAction(() => onRemove(id, true))} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> Delete with File
          </button>
        </div>
      )}
    </>
  );
}
