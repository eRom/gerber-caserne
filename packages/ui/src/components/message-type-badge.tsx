import { Info, Bell } from 'lucide-react';

const TYPE_CONFIG = {
  context: { label: 'Context', icon: Info, style: 'bg-blue-500/10 text-blue-400' },
  reminder: { label: 'Reminder', icon: Bell, style: 'bg-amber-500/10 text-amber-400' },
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
