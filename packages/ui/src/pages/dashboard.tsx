import { useStats } from '@/api/hooks/use-stats';
import { useNotes } from '@/api/hooks/use-notes';
import { Card } from '@/components/ui/card';
import { NoteCard } from '@/components/note-card';
import { TagChip } from '@/components/tag-chip';
import { EmptyState } from '@/components/empty-state';
import { Brain, FileText, Layers, Database } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: recent, isLoading: notesLoading } = useNotes({ limit: 5 });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Notes" value={stats?.notes.total} loading={statsLoading} />
        <StatCard icon={Layers} label="Chunks" value={stats?.chunks.total} loading={statsLoading} />
        <StatCard icon={Brain} label="Embeddings" value={stats?.embeddings.total} loading={statsLoading} />
        <StatCard icon={Database} label="DB Size" value={stats ? formatBytes(stats.dbSizeBytes) : undefined} loading={statsLoading} />
      </div>

      {/* Top tags */}
      {stats && stats.topTags.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-muted-foreground">Top Tags</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stats.topTags.slice(0, 15).map((t) => (
              <TagChip key={t.tag} tag={t.tag} />
            ))}
          </div>
        </div>
      )}

      {/* Recent notes */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        {notesLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : recent && recent.items.length > 0 ? (
          <div className="mt-4 space-y-3">
            {recent.items.map((n) => (
              <NoteCard key={n.id} note={n} projectSlug="global" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No notes yet"
            description="Create your first note or import from Apple Notes"
          />
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof FileText;
  label: string;
  value?: number | string | undefined;
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-2 text-xl font-bold">{value ?? 0}</p>
      )}
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
