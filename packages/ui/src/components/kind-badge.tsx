import { FileText, BookOpen } from 'lucide-react';

const config = {
  atom: { label: 'Atom', icon: FileText, style: 'bg-blue-500/10 text-blue-400' },
  document: { label: 'Doc', icon: BookOpen, style: 'bg-violet-500/10 text-violet-400' },
} as const;

export function KindBadge({ kind }: { kind: string }) {
  const c = config[kind as keyof typeof config] ?? config.atom;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${c.style}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}
