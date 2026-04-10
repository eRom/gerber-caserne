import { useStats } from '@/api/hooks/use-stats';
import { backupBrain } from '@/api/tools/maintenance';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Database, Save, CheckCircle2 } from 'lucide-react';

export function Settings() {
  const { data: stats, isLoading } = useStats();
  const [backupResult, setBackupResult] = useState<string | null>(null);
  const [backing, setBacking] = useState(false);

  const handleBackup = async () => {
    setBacking(true);
    try {
      const result = await backupBrain({ label: 'manual' });
      setBackupResult(`Backup saved: ${result.path} (${formatBytes(result.sizeBytes)})`);
    } catch (err: any) {
      setBackupResult(`Error: ${err.message}`);
    }
    setBacking(false);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Backup */}
      <Card className="mt-6 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium">Database Backup</h3>
              <p className="text-sm text-muted-foreground">
                {stats ? formatBytes(stats.dbSizeBytes) : '...'} total
              </p>
            </div>
          </div>
          <Button onClick={handleBackup} disabled={backing} className="gap-1.5">
            <Save className="h-4 w-4" />
            {backing ? 'Backing up...' : 'Backup Now'}
          </Button>
        </div>
        {backupResult && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            {backupResult}
          </p>
        )}
      </Card>

      {/* Detailed stats */}
      {stats && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Statistics</h2>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm text-muted-foreground">Notes</h3>
              <p className="text-2xl font-bold">{stats.notes.total}</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {Object.entries(stats.notes.byKind).map(([k, v]) => (
                  <p key={k}>{k}: {v}</p>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm text-muted-foreground">Chunks</h3>
              <p className="text-2xl font-bold">{stats.chunks.total}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                ~{stats.chunks.avgPerDoc.toFixed(1)} per doc
              </p>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm text-muted-foreground">Embeddings</h3>
              <p className="text-2xl font-bold">{stats.embeddings.total}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                model: {stats.embeddings.model}
              </p>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm text-muted-foreground">By Status</h3>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {Object.entries(stats.notes.byStatus).map(([k, v]) => (
                  <p key={k}>{k}: {v}</p>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
