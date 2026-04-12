import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  title: string;
  color: string;
  count: number;
  children: React.ReactNode;
  onAdd?: () => void;
  addingMode?: boolean;
  onAddSubmit?: (title: string) => void;
  onAddCancel?: () => void;
}

function QuickAddInput({
  onSubmit,
  onCancel,
}: {
  onSubmit?: (title: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const trimmed = value.trim();
      if (trimmed) {
        onSubmit?.(trimmed);
        setValue('');
      }
    } else if (e.key === 'Escape') {
      onCancel?.();
    }
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      placeholder="New item..."
      className="mt-1.5 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none"
    />
  );
}

function AddButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1 py-1.5 mt-1.5 border border-dashed border-border/60 rounded-md text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:border-border transition-colors w-full"
    >
      <Plus className="size-3" /> Add
    </button>
  );
}

export function KanbanColumn({
  title,
  color,
  count,
  children,
  onAdd,
  addingMode,
  onAddSubmit,
  onAddCancel,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[180px] flex-1 max-w-[280px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 pb-2 shrink-0">
        <div className={cn('size-2 rounded-full', color)} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span className="text-[10px] text-muted-foreground/40 ml-auto">{count}</span>
      </div>

      {/* Cards area - scrollable */}
      <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-1">{children}</div>

      {/* Quick-add area */}
      {addingMode ? (
        <QuickAddInput onSubmit={onAddSubmit} onCancel={onAddCancel} />
      ) : (
        onAdd && <AddButton onClick={onAdd} />
      )}
    </div>
  );
}
