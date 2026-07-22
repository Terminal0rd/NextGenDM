import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Globe, X, Download, Image as ImageIcon, Video, Music, File as FileIcon, Loader2 } from "lucide-react";
import { getCategoryFromFilename } from "@/lib/utils";
import { useDownloads } from "@/hooks/useDownloads";

interface GrabbedMedia {
  url: string;
  tag: string;
  filename?: string;
}

interface SiteGrabberDialogProps {
  initialUrl?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SiteGrabberDialog({ initialUrl, isOpen, onClose }: SiteGrabberDialogProps) {
  const [url, setUrl] = useState(initialUrl || "");
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [mediaList, setMediaList] = useState<GrabbedMedia[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { add: addDownload } = useDownloads();

  useEffect(() => {
    if (initialUrl && isOpen) {
      setUrl(initialUrl);
      handleGrab(initialUrl);
    }
  }, [initialUrl, isOpen]);

  if (!isOpen) return null;

  const handleGrab = async (target: string = url) => {
    if (!target) return;
    setIsGrabbing(true);
    setError(null);
    setMediaList([]);
    setSelectedUrls(new Set());
    
    try {
      const results = await invoke<GrabbedMedia[]>("grab_site", { targetUrl: target });
      setMediaList(results);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setIsGrabbing(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedUrls.size === mediaList.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(mediaList.map(m => m.url)));
    }
  };

  const toggleSelect = (u: string) => {
    const next = new Set(selectedUrls);
    if (next.has(u)) next.delete(u);
    else next.add(u);
    setSelectedUrls(next);
  };

  const handleDownloadSelected = () => {
    const selected = mediaList.filter(m => selectedUrls.has(m.url));
    for (const item of selected) {
      const filename = item.filename || item.url.split('/').pop() || "download";
      const category = getCategoryFromFilename(filename);
      addDownload({
        url: item.url,
        filename,
        category,
        priority: "normal",
        start_now: false,
      });
    }
    onClose();
  };

  const getIcon = (tag: string) => {
    switch(tag) {
      case "img": return <ImageIcon size={16} className="text-blue-400" />;
      case "video": return <Video size={16} className="text-pink-400" />;
      case "audio": return <Music size={16} className="text-green-400" />;
      default: return <FileIcon size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <Globe className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">Batch Download</h2>
              <p className="text-xs text-slate-400">Grab media directly from a website</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input */}
        <div className="p-6 border-b border-white/5 flex gap-3">
          <input 
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGrab()}
            placeholder="https://example.com/gallery"
            className="flex-1 bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
          />
          <button 
            onClick={() => handleGrab()}
            disabled={isGrabbing || !url}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            {isGrabbing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
            Grab Site
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-2 min-h-[300px]">
          {!isGrabbing && mediaList.length === 0 && !error && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
              <Globe size={48} className="opacity-20" />
              <p>Enter a URL above to find media</p>
            </div>
          )}

          {isGrabbing && (
            <div className="h-full flex flex-col items-center justify-center text-indigo-400 gap-4">
              <Loader2 size={48} className="animate-spin opacity-50" />
              <p className="animate-pulse text-sm font-medium">Scanning website...</p>
            </div>
          )}

          {!isGrabbing && mediaList.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Found {mediaList.length} items
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {selectedUrls.size === mediaList.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div className="grid gap-2">
                {mediaList.map((item, i) => (
                  <div 
                    key={i} 
                    onClick={() => toggleSelect(item.url)}
                    className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedUrls.has(item.url) 
                        ? 'bg-indigo-500/10 border-indigo-500/30' 
                        : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                      selectedUrls.has(item.url) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 bg-slate-900'
                    }`}>
                      {selectedUrls.has(item.url) && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                    </div>
                    
                    <div className="p-2 bg-slate-950/50 rounded-lg">
                      {getIcon(item.tag)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate" title={item.filename || item.url}>
                        {item.filename || "Unknown file"}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{item.url}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button 
            disabled={selectedUrls.size === 0}
            onClick={handleDownloadSelected}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all"
          >
            <Download size={16} />
            Download {selectedUrls.size > 0 ? `(${selectedUrls.size})` : ''}
          </button>
        </div>

      </div>
    </div>
  );
}
