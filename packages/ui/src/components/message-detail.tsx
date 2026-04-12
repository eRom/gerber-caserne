import type { Message } from '@agent-brain/shared';
import { MessageTypeBadge } from './message-type-badge';
import { MessageStatusBadge } from './message-status-badge';
import { MarkdownView } from './markdown-view';
import { Button } from '@/components/ui/button';
import { useUpdateMessage } from '@/api/hooks/use-messages';
import { Check } from 'lucide-react';

interface MessageDetailProps {
  message: Message;
}

export function MessageDetail({ message }: MessageDetailProps) {
  const updateMutation = useUpdateMessage();

  const markDone = () => updateMutation.mutate({ id: message.id, status: 'done' });

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold mb-2">{message.title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <MessageTypeBadge type={message.type} />
          <MessageStatusBadge status={message.status} />
        </div>
      </div>

      {/* Metadata card */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
        {message.metadata?.sourceProject && (
          <p className="text-xs text-muted-foreground">Source: <span className="text-foreground">{message.metadata.sourceProject}</span></p>
        )}
        <p className="text-xs text-muted-foreground">Created: <span className="text-foreground">{new Date(message.createdAt).toLocaleString()}</span></p>
        <p className="text-xs text-muted-foreground">Updated: <span className="text-foreground">{new Date(message.updatedAt).toLocaleString()}</span></p>
      </div>

      {/* Content */}
      <div className="border-t border-border pt-4">
        <MarkdownView source={message.content} />
      </div>

      {/* Actions */}
      {message.status === 'pending' && (
        <div className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={markDone} disabled={updateMutation.isPending}>
            <Check className="h-4 w-4 mr-1" /> Done
          </Button>
        </div>
      )}
    </div>
  );
}
