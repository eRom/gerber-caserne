import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PRIORITY_STYLES = {
  high: 'bg-red-500/15 text-red-400 border-red-500/30',
  normal: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  low: 'bg-zinc-700/15 text-zinc-500 border-zinc-700/30',
} as const;

export function MessagePriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLES[priority as keyof typeof PRIORITY_STYLES];
  if (!style) return null;
  if (priority === 'normal') return null;
  return (
    <Badge variant="outline" className={cn('text-xs', style)}>
      {priority}
    </Badge>
  );
}
