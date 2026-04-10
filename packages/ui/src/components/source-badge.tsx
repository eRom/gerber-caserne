import { Badge } from '@/components/ui/badge';
import { Bot, User, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const config = {
  ai: { label: 'AI', icon: Bot, className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
  human: { label: 'Human', icon: User, className: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  import: { label: 'Import', icon: Download, className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25' },
} as const;

export function SourceBadge({ source }: { source: string }) {
  const c = config[source as keyof typeof config] ?? config.ai;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}
