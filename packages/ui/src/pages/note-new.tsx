import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useCreateNote } from '@/api/hooks/use-notes';
import { useProjects } from '@/api/hooks/use-projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MarkdownView } from '@/components/markdown-view';
import { GLOBAL_PROJECT_ID } from '@agent-brain/shared';

export function NoteNew() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const createMutation = useCreateNote();
  const { data: projectsData } = useProjects();

  const project = projectsData?.items.find((p) => p.slug === slug);
  const projectId = project?.id ?? GLOBAL_PROJECT_ID;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<'atom' | 'document'>('atom');
  const [tagsInput, setTagsInput] = useState('');
  const [tab, setTab] = useState('write');

  const handleSubmit = async () => {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const result = await createMutation.mutateAsync({
      kind,
      title,
      content,
      tags,
      source: 'human',
      projectId,
    });
    navigate(`/projects/${slug}/notes/${result.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">New Note</h1>

      <div className="mt-6 space-y-4">
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="flex items-center gap-4">
          <Tabs value={kind} onValueChange={(v) => setKind(v as 'atom' | 'document')}>
            <TabsList>
              <TabsTrigger value="atom">Atom</TabsTrigger>
              <TabsTrigger value="document">Document</TabsTrigger>
            </TabsList>
          </Tabs>

          <Input
            placeholder="Tags (comma-separated)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="flex-1"
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="write">
            <Textarea
              placeholder="Content (Markdown)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
            />
          </TabsContent>
          <TabsContent value="preview">
            <div className="min-h-[400px] rounded-md border border-border p-4">
              <MarkdownView source={content || '*Nothing to preview*'} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate(`/projects/${slug}`)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title || !content || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}
