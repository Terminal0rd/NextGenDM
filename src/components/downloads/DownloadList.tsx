
import { ArrowDownToLine } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DownloadItem } from '@/components/downloads/DownloadItem';
import { useDownloads } from '@/hooks/useDownloads';
import { useDownloadStore } from '@/stores/downloadStore';

// Shared grid template used by both header and rows
export const GRID_COLS = "grid grid-cols-[32px_1fr_72px_120px_80px_72px_100px_96px]";

export function DownloadList() {
  const { downloads, isLoading, getProgress, pause, resume, cancel, remove, openFile, openFolder } = useDownloads();
  const setAddDialogOpen = useDownloadStore(s => s.setAddDialogOpen);

  if (downloads.length === 0 && !isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/50">
          <ArrowDownToLine className="h-8 w-8 text-zinc-600" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-medium text-zinc-300">No downloads yet</h3>
          <p className="mt-1 text-xs text-zinc-500">Click <button onClick={() => setAddDialogOpen(true)} className="text-cyan-400 hover:underline">Add Download</button> to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
      {/* ── Column Header ──────────────────────────────────── */}
      <div className={`${GRID_COLS} items-center text-[11px] font-semibold text-zinc-400 bg-zinc-900 border-b border-zinc-800 px-3 py-1.5 gap-2`}>
        <div className="text-center">#</div>
        <div className="truncate">File Name</div>
        <div>Size</div>
        <div>Status</div>
        <div>Speed</div>
        <div>ETA</div>
        <div>Date Added</div>
        <div className="text-center">Actions</div>
      </div>
      {/* ── Rows ───────────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {downloads.map((download, idx) => (
            <DownloadItem
              key={download.id}
              index={idx + 1}
              download={download}
              progress={getProgress(download.id)}
              onPause={pause}
              onResume={resume}
              onCancel={cancel}
              onRemove={remove}
              onOpen={openFile}
              onOpenFolder={openFolder}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
