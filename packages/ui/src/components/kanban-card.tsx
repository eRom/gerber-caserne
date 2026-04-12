import { cn } from '@/lib/utils';

interface KanbanCardProps {
  title: string;
  priority?: string;
  tags?: string[];
  severity?: string;
  assignee?: string | null;
  dueDate?: number | null;
  isDone?: boolean;
  onClick?: () => void;
}

function PriorityBadge({ label }: { label: string }) {
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400">
      {label}
    </span>
  );
}

const severityStyles: Record<string, string> = {
  bug: 'bg-pink-500/10 text-pink-400',
  regression: 'bg-amber-500/10 text-amber-400',
  warning: 'bg-amber-500/10 text-amber-400',
  enhancement: 'bg-emerald-500/10 text-emerald-400',
};

function SeverityBadge({ severity }: { severity: string }) {
  const style = severityStyles[severity] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', style)}>
      {severity}
    </span>
  );
}

function TagChip({ tag }: { tag: string }) {
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">
      {tag}
    </span>
  );
}

const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

function DueDateLabel({ date }: { date: number }) {
  const d = new Date(date);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const isOverdue = date < Date.now();

  return (
    <span className={cn('text-[10px]', isOverdue ? 'text-destructive' : 'text-amber-400')}>
      {day} {month}
    </span>
  );
}

export function KanbanCard({
  title,
  priority,
  tags,
  severity,
  assignee,
  dueDate,
  isDone,
  onClick,
}: KanbanCardProps) {
  const showPriority = priority === 'high' || priority === 'critical';
  const hasMeta =
    showPriority ||
    !!severity ||
    (tags && tags.length > 0) ||
    !!assignee ||
    !!dueDate;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-card border border-border rounded-lg px-3 py-2 transition-all hover:border-foreground/15 hover:shadow-sm',
        isDone && 'opacity-40',
      )}
    >
      <p className={cn('text-[13px] font-medium leading-tight', isDone && 'line-through')}>
        {title}
      </p>

      {hasMeta && (
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {priority === 'high' && <PriorityBadge label="high" />}
          {priority === 'critical' && <PriorityBadge label="critical" />}
          {severity && <SeverityBadge severity={severity} />}
          {tags?.map((t) => <TagChip key={t} tag={t} />)}
          {assignee && <span className="text-[10px] text-muted-foreground">{assignee}</span>}
          {dueDate && <DueDateLabel date={dueDate} />}
        </div>
      )}
    </button>
  );
}
