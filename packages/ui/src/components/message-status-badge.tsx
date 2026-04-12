const STATUS_CONFIG = {
  pending: { label: 'Pending', style: 'bg-amber-500/10 text-amber-400' },
  done: { label: 'Done', style: 'bg-emerald-500/10 text-emerald-400' },
} as const;

export function MessageStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${config.style}`}>
      {config.label}
    </span>
  );
}
