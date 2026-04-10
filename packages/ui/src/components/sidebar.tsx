import { Link, useLocation } from 'react-router';
import { Brain, Search, Settings, FolderOpen, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { usePendingCount } from '@/api/hooks/use-messages';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useProjects } from '@/api/hooks/use-projects';
import { useNotes } from '@/api/hooks/use-notes';
import { cn } from '@/lib/utils';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { data: projectsData } = useProjects();
  const { data: recentData } = useNotes({ limit: 5, sort: 'updated_desc' });
  const pendingCount = usePendingCount();

  const projects = projectsData?.items ?? [];
  const recentNotes = recentData?.items ?? [];

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] transition-all duration-200',
        collapsed ? 'w-14' : 'w-[260px]',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4">
        {!collapsed && (
          <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-5 w-5 text-primary" />
            agent-brain
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!collapsed && (
        <>
          {/* Search trigger */}
          <div className="px-3 pb-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            >
              <Search className="h-4 w-4" />
              Search...
              <kbd className="ml-auto text-xs text-muted-foreground">⌘K</kbd>
            </Button>
          </div>

          <Link
            to="/messages"
            className={cn(
              'mx-1.5 flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
              location.pathname.startsWith('/messages')
                ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-foreground)]'
                : 'text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)]/50',
            )}
          >
            <Inbox className="h-4 w-4 shrink-0 opacity-70" />
            Messages
            {(pendingCount.data ?? 0) > 0 && (
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400">
                {pendingCount.data}
              </span>
            )}
          </Link>

          <Separator />

          <ScrollArea className="flex-1 px-3 py-2">
            {/* Projects */}
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Projects</p>
            <nav className="space-y-0.5">
              {projects
                .filter((p) => p.id !== GLOBAL_PROJECT_ID)
                .map((p) => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.slug}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                      location.pathname.startsWith(`/projects/${p.slug}`) && 'bg-muted',
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: p.color || '#FFAF5F' }}
                    />
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    {p.name}
                  </Link>
                ))}
              {/* Global project */}
              <Link
                to="/projects/global"
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                  location.pathname.startsWith('/projects/global') && 'bg-muted',
                )}
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                Global
              </Link>
            </nav>

            <Separator className="my-3" />

            {/* Recent activity */}
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Recent</p>
            <nav className="space-y-0.5">
              {recentNotes.map((n) => (
                <Link
                  key={n.id}
                  to={`/projects/global/notes/${n.id}`}
                  className="block truncate rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {n.title}
                </Link>
              ))}
            </nav>
          </ScrollArea>

          <Separator />

          {/* Footer */}
          <div className="px-3 py-2">
            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}
