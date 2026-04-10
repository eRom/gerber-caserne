import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const config: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/25',
  draft: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  archived: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  deprecated: 'bg-red-500/15 text-red-400 border-red-500/25',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('text-xs', config[status])}>
      {status}
    </Badge>
  );
}
