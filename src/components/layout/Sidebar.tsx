import {
  LayoutGrid,
  ArrowDownToLine,
  CheckCircle2,
  XCircle,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Package,
  Archive,
  File,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDownloadStore } from "@/stores/downloadStore";
import { useDownloads } from "@/hooks/useDownloads";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DownloadCategory, SidebarView } from "@/types/download";

// ─── Navigation items ────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  view: SidebarView;
  category?: DownloadCategory;
}

const mainNav: NavItem[] = [
  {
    id: "nav-all",
    label: "All Downloads",
    icon: <LayoutGrid className="h-4 w-4" />,
    view: "all",
  },
  {
    id: "nav-active",
    label: "Active",
    icon: <ArrowDownToLine className="h-4 w-4" />,
    view: "active",
  },
  {
    id: "nav-completed",
    label: "Completed",
    icon: <CheckCircle2 className="h-4 w-4" />,
    view: "completed",
  },
  {
    id: "nav-failed",
    label: "Failed",
    icon: <XCircle className="h-4 w-4" />,
    view: "failed",
  },
];

interface CategoryNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: DownloadCategory;
}

const categoryNav: CategoryNavItem[] = [
  { id: "cat-video", label: "Videos", icon: <Film className="h-4 w-4" />, category: "video" },
  { id: "cat-audio", label: "Audio", icon: <Music className="h-4 w-4" />, category: "audio" },
  { id: "cat-image", label: "Images", icon: <ImageIcon className="h-4 w-4" />, category: "image" },
  { id: "cat-document", label: "Documents", icon: <FileText className="h-4 w-4" />, category: "document" },
  { id: "cat-program", label: "Programs", icon: <Package className="h-4 w-4" />, category: "program" },
  { id: "cat-compressed", label: "Compressed", icon: <Archive className="h-4 w-4" />, category: "compressed" },
  { id: "cat-other", label: "Other", icon: <File className="h-4 w-4" />, category: "other" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function Sidebar() {
  const currentView = useDownloadStore((s) => s.currentView);
  const selectedCategory = useDownloadStore((s) => s.selectedCategory);
  const setCurrentView = useDownloadStore((s) => s.setCurrentView);
  const setSelectedCategory = useDownloadStore((s) => s.setSelectedCategory);
  const { counts, getCategoryCounts } = useDownloads();

  function getCount(view: SidebarView): number | null {
    switch (view) {
      case "all":
        return counts.all || null;
      case "active":
        return counts.active || null;
      case "completed":
        return counts.completed || null;
      case "failed":
        return counts.failed || null;
      default:
        return null;
    }
  }

  return (
    <aside
      id="sidebar"
      className="flex h-full w-60 flex-col border-r border-zinc-800/60 bg-zinc-950/70 backdrop-blur-xl"
    >
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-blue-500/20">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-lg font-bold tracking-tight text-transparent">
          NextGenDM
        </span>
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1 py-2">
          {mainNav.map((item) => {
            const isActive =
              currentView === item.view && !selectedCategory;
            const count = getCount(item.view);

            return (
              <button
                key={item.id}
                id={item.id}
                onClick={() => setCurrentView(item.view)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-zinc-800/80 text-foreground shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                )}
              >
                <span
                  className={cn(
                    "transition-colors",
                    isActive
                      ? "text-cyan-400"
                      : "text-zinc-500 group-hover:text-zinc-300"
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {count !== null && (
                  <span
                    className={cn(
                      "min-w-[20px] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none",
                      isActive
                        ? "bg-cyan-500/15 text-cyan-400"
                        : "bg-zinc-800 text-zinc-500"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <Separator className="mx-1 my-2" />

        {/* ── Categories ──────────────────────────────────────── */}
        <div className="py-2">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Categories
          </p>
          <nav className="space-y-0.5">
            {categoryNav.map((item) => {
              const isActive =
                currentView === "category" &&
                selectedCategory === item.category;
              const count = getCategoryCounts(item.category);

              return (
                <button
                  key={item.id}
                  id={item.id}
                  onClick={() => setSelectedCategory(item.category)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-zinc-800/80 text-foreground"
                      : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                  )}
                >
                  <span
                    className={cn(
                      "transition-colors",
                      isActive
                        ? "text-cyan-400"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {count > 0 && (
                    <span className="text-[11px] text-zinc-600">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </ScrollArea>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="border-t border-zinc-800/60 px-5 py-3">
        <p className="text-[11px] text-zinc-600">
          NextGenDM v0.1.0
        </p>
      </div>
    </aside>
  );
}
