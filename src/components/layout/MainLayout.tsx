import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DownloadList } from "@/components/downloads/DownloadList";
import { AddDownloadDialog } from "@/components/downloads/AddDownloadDialog";
import { DownloadInspector } from "@/components/downloads/DownloadInspector";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useSettingsStore } from "@/stores/settingsStore";
import { useEffect } from "react";

export function MainLayout() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div id="main-layout" className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      {/* ── Sidebar ────────────────────────────────────────── */}
      <Sidebar />

      {/* ── Main Content ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden border-l border-zinc-800">
        <Header />
        <main className="flex flex-1 flex-col overflow-hidden">
          <DownloadList />
          <DownloadInspector />
        </main>
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      <AddDownloadDialog />
      <SettingsDialog />
    </div>
  );
}
