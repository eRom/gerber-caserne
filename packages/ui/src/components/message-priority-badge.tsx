const PRIORITY_STYLES = {
  high: 'bg-pink-500/10 text-pink-400',
  low: 'bg-gray-500/10 text-gray-400',
} as const;

export function MessagePriorityBadge({ priority }: { priority: string }) {
  if (priority === 'normal') return null;
  const style = PRIORITY_STYLES[priority as keyof typeof PRIORITY_STYLES];
  if (!style) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${style}`}>
      {priority}
    </span>
  );
}
