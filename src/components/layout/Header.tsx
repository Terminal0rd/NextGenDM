import { Plus, Play, Pause, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDownloadStore } from '@/stores/downloadStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDownloads } from '@/hooks/useDownloads';

export function Header() {
  const setAddDialogOpen = useDownloadStore((s) => s.setAddDialogOpen);
  const setSettingsOpen = useSettingsStore((s) => s.setIsOpen);
  const { downloads, pause, resume } = useDownloads();

  const startAll = () => {
    downloads.filter(d => d.status === 'queued' || d.status === 'paused' || d.status === 'failed').forEach(d => resume(d.id));
  };

  const pauseAll = () => {
    downloads.filter(d => d.status === 'downloading').forEach(d => pause(d.id));
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4">
      <Button variant="ghost" className="flex flex-col h-14 w-16 gap-1 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10" onClick={() => setAddDialogOpen(true)}>
        <Plus className="h-5 w-5" />
        <span className="text-[10px] font-medium">Add URL</span>
      </Button>
      <div className="w-px h-8 bg-zinc-800 mx-1" />
      <Button variant="ghost" className="flex flex-col h-14 w-16 gap-1 text-zinc-400 hover:text-green-400 hover:bg-green-500/10" onClick={startAll}>
        <Play className="h-5 w-5" />
        <span className="text-[10px] font-medium">Start All</span>
      </Button>
      <Button variant="ghost" className="flex flex-col h-14 w-16 gap-1 text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10" onClick={pauseAll}>
        <Pause className="h-5 w-5" />
        <span className="text-[10px] font-medium">Pause All</span>
      </Button>
      <div className="w-px h-8 bg-zinc-800 mx-1" />
      <Button variant="ghost" className="flex flex-col h-14 w-16 gap-1 text-zinc-400 hover:text-red-400 hover:bg-red-500/10">
        <Trash2 className="h-5 w-5" />
        <span className="text-[10px] font-medium">Delete All</span>
      </Button>
      <div className="flex-1" />
      <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-300" onClick={() => setSettingsOpen(true)}>
        <Settings className="h-5 w-5" />
      </Button>
    </header>
  );
}
