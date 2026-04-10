import type { Message } from '@agent-brain/shared';
import { MessageTypeBadge } from './message-type-badge';
import { MessagePriorityBadge } from './message-priority-badge';
import { MessageStatusBadge } from './message-status-badge';
import { MarkdownView } from './markdown-view';
import { Button } from '@/components/ui/button';
import { useUpdateMessage } from '@/api/hooks/use-messages';
import { Check, Eye, X } from 'lucide-react';

interface MessageDetailProps {
  message: Message;
}

export function MessageDetail({ message }: MessageDetailProps) {
  const updateMutation = useUpdateMessage();

  const setStatus = (status: 'ack' | 'done' | 'dismissed') => {
    updateMutation.mutate({ id: message.id, status });
  };

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold mb-2">{message.title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <MessageTypeBadge type={message.type} />
          <MessagePriorityBadge priority={message.priority} />
          <MessageStatusBadge status={message.status} />
        </div>
      </div>

      {/* Metadata card */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
        {message.metadata?.sourceProject && (
          <p className="text-xs text-muted-foreground">Source: <span className="text-foreground">{message.metadata.sourceProject}</span></p>
        )}
        {message.metadata?.severity && (
          <p className="text-xs text-muted-foreground">Severity: <span className="text-foreground">{message.metadata.severity}</span></p>
        )}
        {message.metadata?.assignee && (
          <p className="text-xs text-muted-foreground">Assignee: <span className="text-foreground">{message.metadata.assignee}</span></p>
        )}
        <p className="text-xs text-muted-foreground">Created: <span className="text-foreground">{new Date(message.createdAt).toLocaleString()}</span></p>
        <p className="text-xs text-muted-foreground">Updated: <span className="text-foreground">{new Date(message.updatedAt).toLocaleString()}</span></p>
      </div>

      {/* Content */}
      <div className="border-t border-border pt-4">
        <MarkdownView source={message.content} />
      </div>

      {/* Actions */}
      {(message.status === 'pending' || message.status === 'ack') && (
        <div className="flex gap-2 border-t border-border pt-4">
          {message.status === 'pending' && (
            <Button variant="outline" size="sm" onClick={() => setStatus('ack')} disabled={updateMutation.isPending}>
              <Eye className="h-4 w-4 mr-1" /> Ack
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setStatus('done')} disabled={updateMutation.isPending}>
            <Check className="h-4 w-4 mr-1" /> Done
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setStatus('dismissed')} disabled={updateMutation.isPending}>
            <X className="h-4 w-4 mr-1" /> Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
