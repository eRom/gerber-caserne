import { Link } from 'react-router';
import type { SearchHit } from '@agent-brain/shared';
import { FileText, BookOpen, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap = {
  atom: FileText,
  document: BookOpen,
  chunk: Puzzle,
} as const;

export function SearchHitCard({
  hit,
  projectSlug,
}: {
  hit: SearchHit;
  projectSlug?: string;
}) {
  const isChunk = hit.ownerType === 'chunk';
  const kind = isChunk ? 'chunk' : hit.parent.kind;
  const Icon = iconMap[kind as keyof typeof iconMap] ?? FileText;
  const slug = projectSlug ?? 'global';

  const href = isChunk
    ? `/projects/${slug}/notes/${hit.parent.noteId}#chunk-${hit.ownerId}`
    : `/projects/${slug}/notes/${hit.ownerId}`;

  return (
    <Link
      to={href}
      className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted"
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', isChunk ? 'text-amber-400' : 'text-muted-foreground')} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{hit.parent.title}</p>
        {isChunk && hit.chunk && (
          <p className="truncate text-xs text-muted-foreground">{hit.chunk.headingPath}</p>
        )}
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{hit.snippet}</p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {(hit.score * 100).toFixed(0)}%
      </span>
    </Link>
  );
}
