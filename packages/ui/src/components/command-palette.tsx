import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { useSearch } from '@/api/hooks/use-search';
import { useProjects } from '@/api/hooks/use-projects';
import { FileText, BookOpen, Puzzle, Plus, BarChart3, FolderOpen } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const iconMap = { atom: FileText, document: BookOpen, chunk: Puzzle } as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const navigate = useNavigate();
  const { data: projectsData } = useProjects();
  const { data: searchData, isFetching } = useSearch(debouncedQuery, { mode, limit: 8, enabled: open });

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // ⌘K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery('');
      navigate(path);
    },
    [navigate],
  );

  const projects = projectsData?.items ?? [];
  const hits = searchData?.hits ?? [];

  const resolveSlug = (projectId: string) => {
    const p = projects.find((p) => p.id === projectId);
    return p?.slug ?? 'global';
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search notes..."
        value={query}
        onValueChange={setQuery}
      />

      {/* Mode tabs */}
      <div className="border-b border-border px-3 py-1.5">
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="h-7">
            <TabsTrigger value="hybrid" className="text-xs">Hybrid</TabsTrigger>
            <TabsTrigger value="semantic" className="text-xs">Semantic</TabsTrigger>
            <TabsTrigger value="fulltext" className="text-xs">Fulltext</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <CommandList>
        <CommandEmpty>{isFetching ? 'Searching...' : 'No results'}</CommandEmpty>

        {/* Search results */}
        {hits.length > 0 && (
          <CommandGroup heading="Results">
            {hits.map((hit) => {
              const isChunk = hit.ownerType === 'chunk';
              const kind = isChunk ? 'chunk' : hit.parent.kind;
              const Icon = iconMap[kind as keyof typeof iconMap] ?? FileText;
              const slug = resolveSlug(hit.parent.projectId);
              const href = isChunk
                ? `/projects/${slug}/notes/${hit.parent.noteId}#chunk-${hit.ownerId}`
                : `/projects/${slug}/notes/${hit.ownerId}`;

              return (
                <CommandItem key={hit.ownerId} onSelect={() => go(href)}>
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{hit.parent.title}</p>
                    {isChunk && hit.chunk && (
                      <p className="truncate text-xs text-muted-foreground">
                        {hit.chunk.headingPath}
                      </p>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Actions */}
        {!query && (
          <>
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => go('/projects/global/notes/new')}>
                <Plus className="mr-2 h-4 w-4" />
                New Note
              </CommandItem>
              <CommandItem onSelect={() => go('/settings')}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Stats
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <CommandItem key={p.id} onSelect={() => go(`/projects/${p.slug}`)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
