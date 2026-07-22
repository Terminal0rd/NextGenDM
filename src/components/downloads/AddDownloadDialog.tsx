import { useState, useCallback, useEffect } from "react";
import { Clipboard, FolderOpen } from "lucide-react";
import { getCategoryFromFilename } from "@/lib/utils";
import { extractMediaInfo } from "@/lib/tauri";
import {
  AnimatedDialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDownloadStore } from "@/stores/downloadStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useDownloads } from "@/hooks/useDownloads";
import type { DownloadCategory, DownloadPriority } from "@/types/download";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "download";
  } catch {
    return "download";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddDownloadDialog() {
  const open = useDownloadStore((s) => s.isAddDialogOpen);
  const setOpen = useDownloadStore((s) => s.setAddDialogOpen);
  const interceptedUrl = useDownloadStore((s) => s.interceptedUrl);
  const interceptedAudioUrl = useDownloadStore((s) => s.interceptedAudioUrl);
  const interceptedFilename = useDownloadStore((s) => s.interceptedFilename);
  const setInterceptedUrl = useDownloadStore((s) => s.setInterceptedUrl);
  const settings = useSettingsStore((s) => s.settings);
  const { add } = useDownloads();

  const [url, setUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [savePath, setSavePath] = useState("");
  const [category, setCategory] = useState<DownloadCategory>("other");
  const [priority, setPriority] = useState<DownloadPriority>("normal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [mediaTitle, setMediaTitle] = useState<string | null>(null);

  const urlValid = isValidUrl(url);

  useEffect(() => {
    if (open) {
      if (interceptedUrl) {
        setUrl(interceptedUrl);
        const name = interceptedFilename || filenameFromUrl(interceptedUrl);
        setFilename(name);
        
        // Auto-route based on file extension
        const cat = getCategoryFromFilename(name);
        setCategory(cat);
        if (settings?.routing_rules && settings.routing_rules[cat]) {
            setSavePath(settings.routing_rules[cat]);
        } else if (settings?.default_download_path) {
            setSavePath(settings.default_download_path);
        }
        
        setInterceptedUrl(null);
      } else {
        if (settings?.default_download_path && !savePath) {
          setSavePath(settings.default_download_path);
        }
      }
    } else {
        // Reset when closed if not submitting
        if (!isSubmitting) {
            setUrl("");
            setFilename("");
            setError(null);
        }
    }
  }, [open, interceptedUrl, interceptedAudioUrl, interceptedFilename, setInterceptedUrl, settings?.default_download_path]);

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setUrl(val);
      setError(null);
      if (isValidUrl(val)) {
        if (val.includes("youtube.com") || val.includes("youtu.be") || val.includes("twitter.com") || val.includes("x.com")) {
            setIsExtracting(true);
            setMediaTitle(null);
            extractMediaInfo(val)
                .then(res => {
                    setUrl(res.url); // Use the direct extracted URL
                    if (res.title) setMediaTitle(res.title);
                    if (res.filename) {
                        setFilename(res.filename);
                        setCategory(getCategoryFromFilename(res.filename));
                    }
                })
                .catch(err => setError(String(err)))
                .finally(() => setIsExtracting(false));
        } else if (!filename) {
            const name = filenameFromUrl(val);
            setFilename(name);
            const cat = getCategoryFromFilename(name);
            setCategory(cat);
            if (settings?.routing_rules && settings.routing_rules[cat]) {
                setSavePath(settings.routing_rules[cat]);
            }
        }
      }
    },
    [filename, settings?.routing_rules]
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setError(null);
        if (isValidUrl(text)) {
          if (text.includes("youtube.com") || text.includes("youtu.be") || text.includes("twitter.com") || text.includes("x.com")) {
              setIsExtracting(true);
              setMediaTitle(null);
              extractMediaInfo(text)
                  .then(res => {
                      setUrl(res.url); // Use the direct extracted URL
                      if (res.title) setMediaTitle(res.title);
                      if (res.filename) {
                          setFilename(res.filename);
                          setCategory(getCategoryFromFilename(res.filename));
                      }
                  })
                  .catch(err => setError(String(err)))
                  .finally(() => setIsExtracting(false));
          } else if (!filename) {
            const name = filenameFromUrl(text);
            setFilename(name);
            const cat = getCategoryFromFilename(name);
            setCategory(cat);
            if (settings?.routing_rules && settings.routing_rules[cat]) {
                setSavePath(settings.routing_rules[cat]);
            }
          }
        }
      }
    } catch {
      // Clipboard access denied
    }
  }, [filename]);

  const handleBrowse = useCallback(async () => {
    try {
      const { open: dialogOpen } = await import(
        "@tauri-apps/plugin-dialog"
      );
      const selected = await dialogOpen({
        directory: true,
        multiple: false,
        title: "Select download folder",
      });
      if (typeof selected === "string") {
        setSavePath(selected);
      }
    } catch {
      // Dialog cancelled or plugin not available
    }
  }, []);

  const handleSubmit = useCallback(
    async (start_now: boolean = true) => {
      if (!urlValid || isSubmitting) return;
      setIsSubmitting(true);
      setError(null);

      try {
        await add({
          url,
          audio_url: interceptedAudioUrl || undefined,
          filename: filename || undefined,
          save_path: savePath || undefined,
          category,
          priority,
          start_now,
        });

        // Reset & close
        setUrl("");
        setFilename("");
        setSavePath("");
        setCategory("other");
        setPriority("normal");
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err) ? String((err as any).message) : typeof err === 'object' ? JSON.stringify(err) : String(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [url, filename, savePath, category, priority, urlValid, isSubmitting, add, setOpen, interceptedAudioUrl]
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setUrl("");
        setFilename("");
        setSavePath("");
        setCategory("other");
        setPriority("normal");
        setError(null);
      }
      setOpen(next);
    },
    [setOpen]
  );

  return (
    <AnimatedDialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Download</DialogTitle>
          <DialogDescription>
            Paste a URL to start downloading a file.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* ── URL ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="input-url">URL</Label>
            <div className="flex gap-2">
              <Input
                id="input-url"
                value={url}
                onChange={handleUrlChange}
                placeholder={interceptedUrl ? "URL fetched automatically" : "https://example.com/file.zip"}
                className="flex-1 font-mono text-xs"
                autoFocus
                readOnly={!!interceptedUrl}
              />
              {!interceptedUrl && (
                <Button
                  id="btn-paste-url"
                  variant="outline"
                  size="icon"
                  onClick={handlePaste}
                  title="Paste from clipboard"
                  type="button"
                >
                  <Clipboard className="h-4 w-4" />
                </Button>
              )}
            </div>
            {url && !urlValid && (
              <p className="text-xs text-red-400">Enter a valid HTTP/HTTPS URL</p>
            )}
            {isExtracting && (
              <p className="text-xs text-blue-400 animate-pulse">Extracting media info...</p>
            )}
            {mediaTitle && (
              <p className="text-xs text-emerald-400">Title: {mediaTitle}</p>
            )}
          </div>

          {/* ── Filename ─────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="input-filename">Filename</Label>
            <Input
              id="input-filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Auto-detected from URL"
              className="text-xs"
            />
          </div>

          {/* ── Save Location ────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="input-save-path">Save Location</Label>
            <div className="flex gap-2">
              <Input
                id="input-save-path"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                placeholder={settings?.default_download_path || "Default download folder"}
                className="flex-1 text-xs"
              />
              <Button
                id="btn-browse"
                variant="outline"
                size="icon"
                onClick={handleBrowse}
                title="Browse"
                type="button"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── Category & Priority ──────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as DownloadCategory)}
              >
                <SelectTrigger id="select-category" className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="compressed">Compressed</SelectItem>
                  <SelectItem value="program">Program</SelectItem>
                  <SelectItem value="iso">ISO</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as DownloadPriority)}
              >
                <SelectTrigger id="select-priority" className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Error ────────────────────────────────────────── */}
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <DialogFooter className="mt-6 flex items-center justify-between">
          <Button
            id="btn-cancel-dialog"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              id="btn-queue-download"
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={!urlValid || isSubmitting}
              className="border-zinc-800 hover:bg-zinc-800"
            >
              Download Later
            </Button>
            <Button
              id="btn-start-download"
              variant="gradient"
              onClick={() => handleSubmit(true)}
              disabled={!urlValid || isSubmitting}
            >
              {isSubmitting ? "Adding…" : "Download Now"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </AnimatedDialog>
  );
}
