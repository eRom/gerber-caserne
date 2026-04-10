const STATUS_STYLES = {
  pending: 'bg-amber-500/10 text-amber-400',
  ack: 'bg-blue-500/10 text-blue-400',
  done: 'bg-emerald-500/10 text-emerald-400',
  dismissed: 'bg-gray-500/10 text-gray-400',
} as const;

export function MessageStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as keyof typeof STATUS_STYLES];
  if (!style) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${style}`}>
      {status}
    </span>
  );
}
