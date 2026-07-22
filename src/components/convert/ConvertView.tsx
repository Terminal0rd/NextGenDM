import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { File, UploadCloud, RefreshCw, X, FileAudio, FileVideo, FileImage, FileText, CheckCircle2, AlertCircle, FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSettingsStore } from "@/stores/settingsStore";

interface ConvertFile {
  id: string;
  path: string;
  name: string;
  type: "audio" | "video" | "image" | "document" | "unknown";
  targetFormat: string;
  status: "idle" | "converting" | "completed" | "error";
  error?: string;
  outputPath?: string;
}

const FORMATS = {
  audio: ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"],
  video: ["mp4", "mkv", "webm", "avi", "mov", "flv", "wmv", "mp3"],
  image: ["jpg", "png", "webp", "bmp", "tiff", "ico"],
  document: ["pdf", "docx", "html", "txt", "rtf", "epub"],
  unknown: [],
};

const ICONS = {
  audio: FileAudio,
  video: FileVideo,
  image: FileImage,
  document: FileText,
  unknown: File,
};

function guessType(filename: string): ConvertFile["type"] {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return "unknown";
  if (["mp3", "wav", "flac", "ogg", "m4a", "aac", "wma", "opus", "aiff"].includes(ext)) return "audio";
  if (["mp4", "mkv", "webm", "avi", "mov", "flv", "wmv", "ts", "m4v", "3gp"].includes(ext)) return "video";
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "ico", "svg"].includes(ext)) return "image";
  if (["pdf", "doc", "docx", "html", "htm", "txt", "rtf", "epub", "md", "odt"].includes(ext)) return "document";
  return "unknown";
}

function getDefaultFormat(type: ConvertFile["type"]): string {
  switch (type) {
    case "audio": return "mp3";
    case "video": return "mp4";
    case "image": return "jpg";
    case "document": return "pdf";
    default: return "";
  }
}

export function ConvertView() {
  const [files, setFiles] = useState<ConvertFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  
  const defaultDir = useSettingsStore(s => s.settings?.default_download_path || "");
  const [outputDir, setOutputDir] = useState<string | null>(null);

  useEffect(() => {
    if (defaultDir && !outputDir) {
      setOutputDir(defaultDir);
    }
  }, [defaultDir, outputDir]);

  const handleChangeLocation = async () => {
    try {
      const selected = await open({ directory: true });
      if (typeof selected === "string") {
        setOutputDir(selected);
      }
    } catch (err) {
      console.error("Failed to choose directory", err);
    }
  };

  const handleSelectFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
      });
      if (Array.isArray(selected)) {
        const newFiles = selected.map((path) => {
          const name = path.split(/[/\\]/).pop() || "unknown_file";
          const type = guessType(name);
          return {
            id: Math.random().toString(36).substring(7),
            path,
            name,
            type,
            targetFormat: getDefaultFormat(type),
            status: "idle" as const,
          };
        });
        setFiles((prev) => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.error("Failed to open dialog", err);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFormat = (id: string, format: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, targetFormat: format } : f)));
  };

  const handleConvertAll = async () => {
    setIsConvertingAll(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.status === "completed") continue;
      
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: "converting" } : f))
      );

      try {
        const outputPath = await invoke<string>("convert_media", { 
          inputPath: file.path, 
          targetExt: file.targetFormat,
          outputDir: outputDir 
        });
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, status: "completed", outputPath } : f))
        );
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, status: "error", error: err.toString() } : f
          )
        );
      }
    }
    setIsConvertingAll(false);
  };

  return (
    <div className="flex-1 p-6 h-full flex flex-col items-center justify-start overflow-hidden relative">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Convert Files</h1>
        <p className="text-zinc-400">Quickly convert your media and documents offline.</p>
      </div>

      {files.length === 0 ? (
        <div className="flex-1 w-full max-w-4xl flex items-center justify-center">
          <div
            className={cn(
              "w-full h-80 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300",
              isDragging
                ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_30px_rgba(6,182,212,0.2)]"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleSelectFiles();
            }}
          >
            <UploadCloud className="h-16 w-16 text-zinc-500 mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Drag & drop files here</h3>
            <p className="text-sm text-zinc-400 mb-6">or select files from your device</p>
            <Button
              onClick={handleSelectFiles}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] border-0 h-10 px-6 rounded-lg font-medium"
            >
              Choose Files
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-4xl flex-1 flex flex-col bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
            <span className="text-sm font-medium text-zinc-300">{files.length} file(s) selected</span>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectFiles}
                className="border-white/10 hover:bg-white/10 text-zinc-300 h-9"
              >
                Add More
              </Button>
              <Button
                size="sm"
                onClick={handleConvertAll}
                disabled={isConvertingAll || files.every(f => f.status === "completed")}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-0 shadow-[0_0_15px_rgba(6,182,212,0.4)] h-9 gap-2"
              >
                {isConvertingAll ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Convert All
              </Button>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-sm font-medium text-zinc-400 shrink-0">Save to:</span>
              <span className="text-sm text-cyan-300 font-mono truncate bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-500/20">
                {outputDir || "Same as source file"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleChangeLocation}
              className="border-white/10 hover:bg-white/10 text-zinc-300 h-8 shrink-0 ml-4"
            >
              Change Location
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              <AnimatePresence>
                {files.map((file) => {
                  const Icon = ICONS[file.type] || File;
                  const availableFormats = FORMATS[file.type] || [];
                  
                  return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors group"
                    >
                      <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-cyan-400 shadow-inner">
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate mb-1">
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <span className="uppercase">{file.type}</span>
                          {file.status === "error" && (
                            <span className="text-red-400 truncate flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> {file.error}
                            </span>
                          )}
                        </div>
                      </div>

                      {availableFormats.length > 0 && file.status === "idle" && (
                        <select
                          value={file.targetFormat}
                          onChange={(e) => updateFormat(file.id, e.target.value)}
                          className="bg-black/50 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer hover:bg-black"
                        >
                          {availableFormats.map((fmt) => (
                            <option key={fmt} value={fmt} className="bg-zinc-900 text-white">
                              to .{fmt.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      )}

                      {file.status !== "idle" && (
                        <div className="px-4 py-1.5 flex items-center gap-2">
                          {file.status === "converting" && <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin" />}
                          {file.status === "completed" && (
                            <>
                              <CheckCircle2 className="h-5 w-5 text-green-400" />
                              <button 
                                onClick={() => file.outputPath && invoke('show_in_folder', { path: file.outputPath })}
                                className="h-8 w-8 rounded-full flex items-center justify-center text-cyan-400 hover:bg-cyan-500/20 transition-colors ml-1"
                                title="Show in folder"
                              >
                                <FolderOpen className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {file.status === "error" && <AlertCircle className="h-5 w-5 text-red-400" />}
                        </div>
                      )}

                      <button
                        onClick={() => removeFile(file.id)}
                        disabled={file.status === "converting"}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
