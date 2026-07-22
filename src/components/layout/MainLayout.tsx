import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TitleBar } from "@/components/layout/TitleBar";
import { DownloadList } from "@/components/downloads/DownloadList";
import { AddDownloadDialog } from "@/components/downloads/AddDownloadDialog";
import { SiteGrabberDialog } from "@/components/downloads/SiteGrabberDialog";
import { DownloadInspector } from "@/components/downloads/DownloadInspector";
import { ConvertView } from "@/components/convert/ConvertView";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useSettingsStore } from "@/stores/settingsStore";
import { useDownloadStore } from "@/stores/downloadStore";
import { useEffect } from "react";

export function MainLayout() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const isSiteGrabberOpen = useDownloadStore((s) => s.isSiteGrabberOpen);
  const setSiteGrabberOpen = useDownloadStore((s) => s.setSiteGrabberOpen);
  const interceptedBatchUrl = useDownloadStore((s) => s.interceptedBatchUrl);
  const currentView = useDownloadStore((s) => s.currentView);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div id="main-layout" className="flex flex-col h-screen w-screen overflow-hidden bg-[#050505] text-zinc-200 relative">
      {/* ── Dynamic Fluid Background ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/30 rounded-full blur-[100px] animate-blob mix-blend-screen" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px] animate-blob mix-blend-screen" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[50%] bg-blue-600/20 rounded-full blur-[100px] animate-blob mix-blend-screen" style={{ animationDelay: "4s" }} />
      </div>

      <div className="relative z-10 flex flex-col h-full w-full">
        {/* ── Custom Window Title Bar ────────────────────────── */}
        <TitleBar />
      
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ────────────────────────────────────────── */}
        <Sidebar />

        {/* ── Main Content ───────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden border-l border-white/5 shadow-2xl">
          <Header />
          <main className="flex flex-1 flex-col overflow-hidden bg-zinc-950/50">
            {currentView === "convert" ? (
              <ConvertView />
            ) : (
              <>
                <DownloadList />
                <DownloadInspector />
              </>
            )}
          </main>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      <AddDownloadDialog />
      <SiteGrabberDialog 
        isOpen={isSiteGrabberOpen} 
        onClose={() => setSiteGrabberOpen(false)}
        initialUrl={interceptedBatchUrl || undefined}
      />
      <SettingsDialog />
      </div>
    </div>
  );
}
