import { AlertCircle, Info, ArrowRight } from 'lucide-react';

const TYPE_CONFIG = {
  issue: { label: 'Issue', icon: AlertCircle, style: 'bg-pink-500/10 text-pink-400' },
  context: { label: 'Context', icon: Info, style: 'bg-blue-500/10 text-blue-400' },
  task: { label: 'Task', icon: ArrowRight, style: 'bg-violet-500/10 text-violet-400' },
} as const;

export function MessageTypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.style}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
