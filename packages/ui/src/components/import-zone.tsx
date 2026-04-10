import { useState, useCallback, useRef } from 'react';
import { useCreateNote } from '@/api/hooks/use-notes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportZoneProps {
  projectId: string;
}

export function ImportZone({ projectId }: ImportZoneProps) {
  const createMutation = useCreateNote();

  // Paste mode state
  const [pasteContent, setPasteContent] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'atom' | 'document'>('atom');
  const [tagsInput, setTagsInput] = useState('');
  const [importing, setImporting] = useState(false);

  // Drop mode state
  const [dragOver, setDragOver] = useState(false);
  const [fileResults, setFileResults] = useState<{ name: string; status: 'ok' | 'error'; error?: string }[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apple Notes heuristic: first line short + blank line → title = first line
  const handlePasteChange = (text: string) => {
    setPasteContent(text);
    const lines = text.split('\n');
    if (lines.length >= 2 && lines[0]!.length < 100 && lines[1]!.trim() === '') {
      setTitle(lines[0]!.trim());
    }
  };

  const handlePasteImport = async () => {
    if (!title || !pasteContent) return;
    setImporting(true);
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const content = pasteContent.startsWith(title)
      ? pasteContent.slice(title.length).replace(/^\n+/, '')
      : pasteContent;
    await createMutation.mutateAsync({
      kind,
      title,
      content,
      tags,
      source: 'import',
      projectId,
    });
    setPasteContent('');
    setTitle('');
    setTagsInput('');
    setImporting(false);
  };

  // File drop handler
  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length > 10) {
        alert('Max 10 files at once. Use the paste zone for large dumps.');
        return;
      }
      setProcessing(true);
      setFileResults([]);
      const results: typeof fileResults = [];

      for (const file of files) {
        try {
          const text = await file.text();
          const name = file.name.replace(/\.md$/, '');
          await createMutation.mutateAsync({
            kind: 'document',
            title: name,
            content: text,
            tags: [],
            source: 'import',
            projectId,
          });
          results.push({ name: file.name, status: 'ok' });
        } catch (err: any) {
          results.push({ name: file.name, status: 'error', error: err.message });
        }
        setFileResults([...results]);
      }
      setProcessing(false);
    },
    [createMutation, projectId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.md'));
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles],
  );

  return (
    <div className="space-y-6">
      {/* Paste zone */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Paste Content</h3>
        <Textarea
          placeholder="Paste text here (Apple Notes, markdown...)"
          value={pasteContent}
          onChange={(e) => handlePasteChange(e.target.value)}
          className="min-h-[200px] font-mono text-sm"
        />
        {pasteContent && (
          <div className="flex items-center gap-3">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1"
            />
            <Tabs value={kind} onValueChange={(v) => setKind(v as 'atom' | 'document')}>
              <TabsList className="h-9">
                <TabsTrigger value="atom">Atom</TabsTrigger>
                <TabsTrigger value="document">Doc</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              placeholder="Tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-40"
            />
            <Button onClick={handlePasteImport} disabled={importing || !title}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Index'}
            </Button>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
          dragOver ? 'border-accent bg-accent/5' : 'border-border',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Drop .md files here or click to browse (max 10)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) handleFiles(files);
          }}
        />
      </div>

      {/* File results */}
      {fileResults.length > 0 && (
        <div className="space-y-1">
          {fileResults.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {r.status === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span>{r.name}</span>
              {r.error && <span className="text-xs text-red-400">{r.error}</span>}
            </div>
          ))}
          {processing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
