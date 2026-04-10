import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  ack: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  done: 'bg-green-500/15 text-green-400 border-green-500/30',
  dismissed: 'bg-zinc-700/15 text-zinc-500 border-zinc-700/30',
} as const;

export function MessageStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as keyof typeof STATUS_STYLES];
  if (!style) return null;
  return (
    <Badge variant="outline" className={cn('text-xs', style)}>
      {status}
    </Badge>
  );
}
