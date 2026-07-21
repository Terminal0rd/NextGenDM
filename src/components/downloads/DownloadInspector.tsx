import { useDownloads } from '@/hooks/useDownloads';
import { useDownloadStore } from '@/stores/downloadStore';
import { formatBytes, formatSpeed, formatEta, getStatusColor, getStatusLabel } from '@/lib/utils';

export function DownloadInspector() {
  const { downloads, getProgress } = useDownloads();
  const activeId = useDownloadStore(s => s.activeDownloadId);
  const download = downloads.find(d => d.id === activeId);
  const progress = activeId ? getProgress(activeId) : null;

  if (!download) {
    return (
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 p-4 flex items-center justify-center text-zinc-500 text-xs">
        Select a download to inspect details
      </div>
    );
  }

  const isActive = download.status === 'downloading' || download.status === 'connecting';
  const isComplete = download.status === 'completed';
  const currentDownloaded = progress?.downloaded_bytes ?? download.downloaded_size;
  const pct = progress?.percentage ?? (download.total_size && download.total_size > 0 ? (download.downloaded_size / download.total_size) * 100 : 0);
  const speed = progress?.speed_bytes_per_sec ?? 0;
  const eta = progress?.eta_seconds ?? null;

  const barColor = isComplete
    ? 'bg-emerald-500/80'
    : download.status === 'failed' || download.status === 'cancelled'
    ? 'bg-red-500/60'
    : download.status === 'paused'
    ? 'bg-amber-500/60'
    : 'bg-blue-500/80';

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3 overflow-hidden">
      {/* Row 1: filename + size */}
      <div className="flex items-center justify-between gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-zinc-200 truncate">{download.filename}</h3>
          <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{download.url}</div>
        </div>
        <div className="text-right text-[11px] shrink-0">
          <span className="text-zinc-300 font-medium">
            {formatBytes(currentDownloaded)} / {download.total_size ? formatBytes(download.total_size) : '?'}
          </span>
        </div>
      </div>

      {/* Row 2: stats chips */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
        <div>
          <span className="text-zinc-500">Status: </span>
          <span className={`font-medium ${getStatusColor(download.status)}`}>{getStatusLabel(download.status)}</span>
        </div>
        <div>
          <span className="text-zinc-500">Speed: </span>
          <span className="text-zinc-300">{isActive && speed > 0 ? formatSpeed(speed) : '—'}</span>
        </div>
        <div>
          <span className="text-zinc-500">ETA: </span>
          <span className="text-zinc-300">{isActive && eta ? formatEta(eta) : '—'}</span>
        </div>
        <div>
          <span className="text-zinc-500">Progress: </span>
          <span className="text-zinc-300">{pct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Row 3: progress bar */}
      <div className="h-5 bg-zinc-950 rounded overflow-hidden relative border border-zinc-800/50">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        {isActive && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
        )}
      </div>
    </div>
  );
}
