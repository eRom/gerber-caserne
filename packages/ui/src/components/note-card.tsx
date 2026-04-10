import { Link } from 'react-router';
import type { Note } from '@agent-brain/shared';
import { KindBadge } from './kind-badge';
import { StatusBadge } from './status-badge';
import { SourceBadge } from './source-badge';
import { TagChip } from './tag-chip';

export function NoteCard({ note, projectSlug }: { note: Note; projectSlug: string }) {
  const timeAgo = formatRelative(note.updatedAt);

  return (
    <Link
      to={`/projects/${projectSlug}/notes/${note.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium leading-tight">{note.title}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {note.content.slice(0, 200)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <KindBadge kind={note.kind} />
        <StatusBadge status={note.status} />
        <SourceBadge source={note.source} />
        {note.tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
      </div>
    </Link>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
