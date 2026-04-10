import { Badge } from '@/components/ui/badge';
import { AlertCircle, Info, ArrowRight } from 'lucide-react';

const TYPE_CONFIG = {
  issue: { label: 'Issue', icon: AlertCircle, variant: 'destructive' as const },
  context: { label: 'Context', icon: Info, variant: 'secondary' as const },
  task: { label: 'Task', icon: ArrowRight, variant: 'outline' as const },
} as const;

export function MessageTypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
