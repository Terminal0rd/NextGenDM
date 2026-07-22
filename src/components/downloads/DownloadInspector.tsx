import { useDownloads } from '@/hooks/useDownloads';
import { useDownloadStore } from '@/stores/downloadStore';
import { formatBytes, formatSpeed, formatEta, getStatusColor, getStatusLabel } from '@/lib/utils';
import { X, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';

export function DownloadInspector() {
  const { downloads, getProgress } = useDownloads();
  const activeId = useDownloadStore(s => s.activeDownloadId);
  const setActiveId = useDownloadStore(s => s.setActiveDownloadId);
  const download = downloads.find(d => d.id === activeId);
  const progress = activeId ? getProgress(activeId) : null;

  return (
    <div className="shrink-0 h-40 border-t border-white/5 bg-black/40 backdrop-blur-2xl relative z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.3)] overflow-hidden">
      <AnimatePresence mode="wait">
        {!download ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full h-full p-4 flex flex-col items-center justify-center text-zinc-500 text-xs"
          >
            <Info className="h-6 w-6 mb-2 opacity-50" />
            Select a download to inspect details
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full h-full p-4 flex flex-col justify-between"
          >
            {/* Top Header Row with Close */}
            <div className="flex items-start justify-between gap-4 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white truncate drop-shadow-sm">{download.filename}</h3>
                <div className="text-[10px] text-zinc-400 mt-1 truncate">{download.url}</div>
              </div>
              <div className="flex items-start gap-3 shrink-0">
                <div className="text-right text-[11px]">
                  <span className="text-zinc-300 font-medium">
                    {formatBytes(progress?.downloaded_bytes ?? download.downloaded_size)} <span className="text-zinc-500">/</span> {download.total_size ? formatBytes(download.total_size) : '?'}
                  </span>
                </div>
                <button
                  onClick={() => setActiveId(null)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] bg-white/5 rounded-lg px-3 py-2 border border-white/5">
              <div>
                <span className="text-zinc-500 mr-1">Status:</span>
                <span className={`font-medium ${getStatusColor(download.status)} drop-shadow-sm`}>{getStatusLabel(download.status)}</span>
              </div>
              <div>
                <span className="text-zinc-500 mr-1">Speed:</span>
                <span className="text-zinc-200 font-medium">{(download.status === 'downloading' || download.status === 'connecting') && (progress?.speed_bytes_per_sec ?? 0) > 0 ? formatSpeed(progress?.speed_bytes_per_sec ?? 0) : '—'}</span>
              </div>
              <div>
                <span className="text-zinc-500 mr-1">ETA:</span>
                <span className="text-zinc-200 font-medium">{(download.status === 'downloading' || download.status === 'connecting') && progress?.eta_seconds ? formatEta(progress.eta_seconds) : '—'}</span>
              </div>
              <div>
                <span className="text-zinc-500 mr-1">Progress:</span>
                <span className="text-cyan-400 font-medium">{(progress?.percentage ?? (download.total_size && download.total_size > 0 ? (download.downloaded_size / download.total_size) * 100 : 0)).toFixed(1)}%</span>
              </div>
            </div>

            {/* Progress Bar Row */}
            <div className="mt-1">
              <Progress 
                value={progress?.percentage ?? (download.total_size && download.total_size > 0 ? (download.downloaded_size / download.total_size) * 100 : 0)} 
                animated={download.status === 'downloading' || download.status === 'connecting'}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
