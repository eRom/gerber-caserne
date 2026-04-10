export function ProjectBadge({ name, color }: { name: string; color?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {color && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {name}
    </span>
  );
}
