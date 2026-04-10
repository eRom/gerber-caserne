import { useParams, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { useNote, useUpdateNote, useDeleteNote } from '@/api/hooks/use-notes';
import { MarkdownView } from '@/components/markdown-view';
import { KindBadge } from '@/components/kind-badge';
import { StatusBadge } from '@/components/status-badge';
import { SourceBadge } from '@/components/source-badge';
import { TagChip } from '@/components/tag-chip';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, X, Save, Trash2, ArrowLeft } from 'lucide-react';
import type { Chunk } from '@agent-brain/shared';

export function NoteDetail() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useNote(id);
  const updateMutation = useUpdateNote();
  const deleteMutation = useDeleteNote();

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const note = data?.item;

  useEffect(() => {
    if (note) setEditContent(note.content);
  }, [note]);

  // Scroll to chunk anchor on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [note]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-96 w-full" />
      </div>
    );
  }

  if (!note) return null;

  const handleSave = async () => {
    await updateMutation.mutateAsync({ id: note.id, content: editContent });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this note?')) return;
    await deleteMutation.mutateAsync({ id: note.id });
    navigate(`/projects/${slug}`);
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{note.title}</h1>
      </div>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <KindBadge kind={note.kind} />
        <StatusBadge status={note.status} />
        <SourceBadge source={note.source} />
        {note.tags.map((t) => (
          <TagChip key={t} tag={t} />
        ))}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {editing ? (
          <>
            <Button size="sm" className="gap-1" onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="h-3.5 w-3.5" />
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="mt-6">
        {editing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            onKeyDown={(e) => {
              if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        ) : note.kind === 'document' && note.chunks ? (
          <DocumentView chunks={note.chunks} />
        ) : (
          <MarkdownView source={note.content} />
        )}
      </div>
    </div>
  );
}

function DocumentView({ chunks }: { chunks: Chunk[] }) {
  const sorted = [...chunks].sort((a, b) => a.position - b.position);
  return (
    <article>
      {sorted.map((chunk) => (
        <section key={chunk.id} id={`chunk-${chunk.id}`} data-heading={chunk.headingPath}>
          <MarkdownView source={chunk.content} />
        </section>
      ))}
    </article>
  );
}
