import { Link, useLocation } from "react-router";
import {
  Brain,
  Search,
  Settings,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { usePendingCount } from "@/api/hooks/use-messages";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjects } from "@/api/hooks/use-projects";
import { useNotes } from "@/api/hooks/use-notes";
import { cn } from "@/lib/utils";
import { GLOBAL_PROJECT_ID } from "@agent-brain/shared";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { data: projectsData } = useProjects();
  const { data: recentData } = useNotes({ limit: 5, sort: "updated_desc" });
  const pendingCount = usePendingCount();

  const projects = projectsData?.items ?? [];
  const recentNotes = recentData?.items ?? [];

  return (
    <aside
      className="flex h-full flex-col select-none overflow-hidden border-r border-sidebar-border bg-sidebar"
      style={{
        width: collapsed ? 52 : 300,
        transition: "width 200ms ease-out",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4">
        {!collapsed && (
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm font-semibold text-sidebar-foreground"
          >
            <Brain className="h-5 w-5 text-sidebar-primary" />
            GERBER
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {collapsed ? (
        /* Collapsed icons */
        <div className="flex flex-1 flex-col items-center gap-1 pt-1">
          <Link
            to="/dashboard"
            className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <Brain className="size-4.5" />
          </Link>
          <Link
            to="/messages"
            className="relative flex size-8 items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <Inbox className="size-4.5" />
            {(pendingCount.data ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                {pendingCount.data}
              </span>
            )}
          </Link>
          <Link
            to="/settings"
            className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <Settings className="size-4.5" />
          </Link>
        </div>
      ) : (
        <>
          {/* Search trigger */}
          <div className="px-3 pb-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() =>
                document.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true }),
                )
              }
            >
              <Search className="h-4 w-4" />
              Search...
              <kbd className="ml-auto text-xs text-muted-foreground">⌘K</kbd>
            </Button>
          </div>

          {/* Messages link */}
          <Link
            to="/messages"
            className={cn(
              "mx-1.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium leading-tight transition-colors",
              location.pathname.startsWith("/messages")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
            )}
          >
            <Inbox className="size-4 shrink-0 opacity-70" />
            Messages
            {(pendingCount.data ?? 0) > 0 && (
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {pendingCount.data}
              </span>
            )}
          </Link>

          <div className="mx-3 my-2 h-px bg-sidebar-border" />

          <ScrollArea className="flex-1 px-1.5">
            {/* Projects section */}
            <p className="sticky top-0 z-10 bg-sidebar/95 backdrop-blur-sm px-2.5 pb-1 pt-3 text-[11px] font-semibold tracking-wide uppercase text-sidebar-foreground/40">
              Projects
            </p>
            <nav className="space-y-0.5">
              {projects
                .filter((p) => p.id !== GLOBAL_PROJECT_ID)
                .map((p) => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.slug}`}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium leading-tight transition-colors",
                      location.pathname.startsWith(`/projects/${p.slug}`)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
                    )}
                  >
                    <span
                      className="size-3 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                      style={{ backgroundColor: p.color || "#FFAF5F" }}
                    />
                    <FolderOpen className="size-4 shrink-0 opacity-70" />
                    <span className="truncate">{p.name}</span>
                  </Link>
                ))}
              {/* Global project */}
              <Link
                to="/projects/global"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium leading-tight transition-colors",
                  location.pathname.startsWith("/projects/global")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
                )}
              >
                <FolderOpen className="size-4 shrink-0 opacity-70" />
                <span className="truncate">Global</span>
              </Link>
            </nav>

            {/* Recent section */}
            <p className="sticky top-0 z-10 bg-sidebar/95 backdrop-blur-sm px-2.5 pb-1 pt-3 text-[11px] font-semibold tracking-wide uppercase text-sidebar-foreground/40">
              Recent
            </p>
            <nav className="space-y-0.5">
              {recentNotes.map((n) => (
                <Link
                  key={n.id}
                  to={`/projects/global/notes/${n.id}`}
                  className="block truncate rounded-lg px-2.5 py-1.5 text-[13px] leading-tight text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                >
                  {n.title}
                </Link>
              ))}
            </nav>
          </ScrollArea>

          <div className="mx-3 my-2 h-px bg-sidebar-border" />

          {/* Footer */}
          <div className="px-1.5 pb-3">
            <Link
              to="/settings"
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium leading-tight transition-colors",
                location.pathname.startsWith("/settings")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
              )}
            >
              <Settings className="size-4 opacity-70" />
              Settings
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}
