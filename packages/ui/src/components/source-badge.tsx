import { Bot, User, Download } from 'lucide-react';

const config = {
  ai: { label: 'AI', icon: Bot, style: 'bg-cyan-500/10 text-cyan-400' },
  human: { label: 'Human', icon: User, style: 'bg-amber-500/10 text-amber-400' },
  import: { label: 'Import', icon: Download, style: 'bg-gray-500/10 text-gray-400' },
} as const;

export function SourceBadge({ source }: { source: string }) {
  const c = config[source as keyof typeof config] ?? config.ai;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${c.style}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}
