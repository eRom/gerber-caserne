import type { Message } from '@agent-brain/shared';
import { MessageTypeBadge } from './message-type-badge';
import { MessagePriorityBadge } from './message-priority-badge';
import { MessageStatusBadge } from './message-status-badge';
import { cn } from '@/lib/utils';

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface MessageCardProps {
  message: Message;
  selected?: boolean;
  onClick?: () => void;
}

export function MessageCard({ message, selected, onClick }: MessageCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border border-border bg-card p-3 transition-all duration-200 hover:shadow-md',
        selected && 'border-primary shadow-md',
        message.status === 'dismissed' && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <MessageTypeBadge type={message.type} />
        <MessagePriorityBadge priority={message.priority} />
        <MessageStatusBadge status={message.status} />
        <span className="ml-auto text-xs text-muted-foreground">{timeAgo(message.createdAt)}</span>
      </div>
      <p className="text-sm font-medium truncate">{message.title}</p>
      {message.metadata?.sourceProject && (
        <p className="text-xs text-muted-foreground mt-1">
          from <span className="text-foreground">{message.metadata.sourceProject}</span>
        </p>
      )}
    </button>
  );
}
