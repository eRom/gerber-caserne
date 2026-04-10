import { Badge } from '@/components/ui/badge';
import { FileText, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const config = {
  atom: { label: 'Atom', icon: FileText, className: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  document: { label: 'Doc', icon: BookOpen, className: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
} as const;

export function KindBadge({ kind }: { kind: string }) {
  const c = config[kind as keyof typeof config] ?? config.atom;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}
