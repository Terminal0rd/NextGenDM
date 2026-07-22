import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettingsStore } from '@/stores/settingsStore';
import { FolderSearch } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

export function SettingsDialog() {
  const { isOpen, setIsOpen, settings, loadSettings, updateSettings } = useSettingsStore();

  useEffect(() => {
    if (isOpen && !settings) {
      loadSettings();
    }
  }, [isOpen, settings, loadSettings]);

  if (!settings) return null;

  const handlePickDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: settings.default_download_path,
      });
      if (selected && typeof selected === 'string') {
        updateSettings({ default_download_path: selected });
      }
    } catch (e) {
      console.error('Failed to pick directory:', e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[550px] bg-black/40 backdrop-blur-3xl border border-white/10 text-zinc-200 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white drop-shadow-sm">Settings</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Default Download Path */}
          <div className="grid gap-2">
            <Label className="text-xs text-zinc-400">Default Download Folder</Label>
            <div className="flex gap-2">
              <Input
                value={settings.default_download_path}
                readOnly
                className="bg-white/5 border-white/10 text-sm font-mono text-zinc-300 shadow-inner"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handlePickDirectory}
                className="shrink-0 border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <FolderSearch className="h-4 w-4 text-cyan-400" />
              </Button>
            </div>
          </div>

          {/* Max Concurrent Downloads */}
          <div className="grid gap-2">
            <Label className="text-xs text-zinc-400">Max Concurrent Downloads (Queue Limit)</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={settings.max_concurrent_downloads}
              onChange={(e) => updateSettings({ max_concurrent_downloads: parseInt(e.target.value) || 3 })}
              className="bg-white/5 border-white/10 shadow-inner focus-visible:ring-cyan-500/50"
            />
          </div>

          {/* Speed Limit */}
          <div className="grid gap-2">
            <Label className="text-xs text-zinc-400">Global Speed Limit (MB/s) — 0 for Unlimited</Label>
            <Input
              type="number"
              min={0}
              value={settings.speed_limit_bytes_per_sec / 1024 / 1024}
              onChange={(e) => {
                const mb = parseFloat(e.target.value) || 0;
                updateSettings({ speed_limit_bytes_per_sec: Math.floor(mb * 1024 * 1024) });
              }}
              className="bg-white/5 border-white/10 shadow-inner focus-visible:ring-cyan-500/50"
            />
          </div>

          {/* Auto Start */}
          <div className="flex items-center justify-between mt-2">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium">Auto-start Downloads</Label>
              <p className="text-xs text-zinc-500">Automatically begin downloading when a new URL is added.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.auto_start_downloads}
              onClick={() => updateSettings({ auto_start_downloads: !settings.auto_start_downloads })}
              className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${settings.auto_start_downloads ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-white/10'}`}
            >
              <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${settings.auto_start_downloads ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Run on Startup */}
          <div className="flex items-center justify-between mt-2">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium">Run on Startup</Label>
              <p className="text-xs text-zinc-500">Launch NextGenDM automatically when you log into your laptop.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.run_on_startup}
              onClick={async () => {
                const newVal = !settings.run_on_startup;
                updateSettings({ run_on_startup: newVal });
                try {
                  const { enable, disable } = await import('@tauri-apps/plugin-autostart');
                  if (newVal) {
                    await enable();
                  } else {
                    await disable();
                  }
                } catch(e) {
                  console.error("Failed to set autostart", e);
                }
              }}
              className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${settings.run_on_startup ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-white/10'}`}
            >
              <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${settings.run_on_startup ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Show Notifications */}
          <div className="flex items-center justify-between">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium">Desktop Notifications</Label>
              <p className="text-xs text-zinc-500">Show a notification when a download completes.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.show_notifications}
              onClick={() => updateSettings({ show_notifications: !settings.show_notifications })}
              className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${settings.show_notifications ? 'bg-cyan-500' : 'bg-zinc-700'}`}
            >
              <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${settings.show_notifications ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Scheduler Settings */}
          <div className="pt-4 mt-2 border-t border-white/10">
            <Label className="text-sm font-medium">Download Scheduler</Label>
            <p className="text-xs text-zinc-500 mb-4">Automatically start and stop queued downloads during a specific time window.</p>
            
            <div className="flex items-center justify-between mb-4">
              <Label className="text-xs text-zinc-400">Enable Scheduler</Label>
              <button
                type="button"
                role="switch"
                aria-checked={settings.scheduler_enabled}
                onClick={() => updateSettings({ scheduler_enabled: !settings.scheduler_enabled })}
                className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${settings.scheduler_enabled ? 'bg-cyan-500' : 'bg-zinc-700'}`}
              >
                <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${settings.scheduler_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className={`grid gap-3 transition-opacity ${settings.scheduler_enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs text-zinc-400">Start Time</Label>
                  <Input 
                    type="time" 
                    value={settings.scheduler_start_time} 
                    onChange={(e) => updateSettings({ scheduler_start_time: e.target.value })}
                    className="bg-zinc-900 border-zinc-800 h-8 mt-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-zinc-400">Stop Time</Label>
                  <Input 
                    type="time" 
                    value={settings.scheduler_stop_time} 
                    onChange={(e) => updateSettings({ scheduler_stop_time: e.target.value })}
                    className="bg-zinc-900 border-zinc-800 h-8 mt-1 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <Label className="text-xs text-zinc-400">Shutdown PC when done</Label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.scheduler_shutdown}
                  onClick={() => updateSettings({ scheduler_shutdown: !settings.scheduler_shutdown })}
                  className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${settings.scheduler_shutdown ? 'bg-cyan-500' : 'bg-zinc-700'}`}
                >
                  <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${settings.scheduler_shutdown ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Routing Rules */}
          <div className="pt-4 mt-2 border-t border-white/10">
            <Label className="text-sm font-medium">Auto-Routing Rules</Label>
            <p className="text-xs text-zinc-500 mb-4">Automatically save downloads of specific types to these folders.</p>
            
            <div className="grid gap-3">
              {['video', 'audio', 'image', 'compressed', 'document', 'program'].map(cat => (
                <div key={cat} className="flex items-center gap-2">
                  <Label className="w-24 text-xs text-zinc-400 capitalize">{cat}</Label>
                  <Input
                    value={settings.routing_rules?.[cat] || ""}
                    readOnly
                    placeholder="Use default folder"
                    className="h-8 text-xs bg-white/5 border-white/10 shadow-inner"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                    onClick={async () => {
                      const selected = await open({
                        directory: true,
                        multiple: false,
                        title: `Select folder for ${cat}`,
                      });
                      if (typeof selected === "string") {
                        updateSettings({
                          routing_rules: { ...settings.routing_rules, [cat]: selected }
                        });
                      }
                    }}
                  >
                    <FolderSearch className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="hover:bg-white/10 text-zinc-300">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
