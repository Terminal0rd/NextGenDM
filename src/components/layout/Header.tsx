import { Plus, Play, Pause, Settings, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useDownloadStore } from '@/stores/downloadStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDownloads } from '@/hooks/useDownloads';

export function Header() {
  const setAddDialogOpen = useDownloadStore((s) => s.setAddDialogOpen);
  const setSiteGrabberOpen = useDownloadStore((s) => s.setSiteGrabberOpen);
  const setSettingsOpen = useSettingsStore((s) => s.setIsOpen);
  const { downloads, pause, resume } = useDownloads();

  const startAll = () => {
    downloads.filter(d => d.status === 'queued' || d.status === 'paused' || d.status === 'failed').forEach(d => resume(d.id));
  };

  const pauseAll = () => {
    downloads.filter(d => d.status === 'downloading').forEach(d => pause(d.id));
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-white/5 bg-black/20 backdrop-blur-xl px-4 z-10 relative shadow-sm">
      <motion.div whileTap={{ scale: 0.95 }}>
        <Button variant="ghost" className="flex flex-col h-14 w-16 gap-1 text-zinc-400 hover:text-cyan-400 hover:bg-white/5 transition-all" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-5 w-5 drop-shadow-sm" />
          <span className="text-[10px] font-medium tracking-wide">Add URL</span>
        </Button>
      </motion.div>
      <motion.div whileTap={{ scale: 0.95 }}>
        <Button variant="ghost" className="flex flex-col h-14 w-16 gap-1 text-zinc-400 hover:text-indigo-400 hover:bg-white/5 transition-all" onClick={() => setSiteGrabberOpen(true)}>
          <Globe className="h-5 w-5 drop-shadow-sm" />
          <span className="text-[10px] font-medium tracking-wide">Grab Site</span>
        </Button>
      </motion.div>
      <div className="w-px h-8 bg-white/10 mx-1 rounded-full" />
      <motion.div whileTap={{ scale: 0.95 }}>
        <Button variant="ghost" className="flex flex-col h-14 w-16 gap-1 text-zinc-400 hover:text-green-400 hover:bg-white/5 transition-all" onClick={startAll}>
          <Play className="h-5 w-5 drop-shadow-sm" />
          <span className="text-[10px] font-medium tracking-wide">Start All</span>
        </Button>
      </motion.div>
      <motion.div whileTap={{ scale: 0.95 }}>
        <Button variant="ghost" className="flex flex-col h-14 w-16 gap-1 text-zinc-400 hover:text-yellow-400 hover:bg-white/5 transition-all" onClick={pauseAll}>
          <Pause className="h-5 w-5 drop-shadow-sm" />
          <span className="text-[10px] font-medium tracking-wide">Pause All</span>
        </Button>
      </motion.div>

      <div className="flex-1" />
      <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all" onClick={() => setSettingsOpen(true)}>
        <Settings className="h-5 w-5" />
      </Button>
    </header>
  );
}
