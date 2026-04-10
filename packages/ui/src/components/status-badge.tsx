const config: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400',
  draft: 'bg-amber-500/10 text-amber-400',
  archived: 'bg-gray-500/10 text-gray-400',
  deprecated: 'bg-pink-500/10 text-pink-400',
};

export function StatusBadge({ status }: { status: string }) {
  const style = config[status] ?? 'bg-gray-500/10 text-gray-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${style}`}>
      {status}
    </span>
  );
}
