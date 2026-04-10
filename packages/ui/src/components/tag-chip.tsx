import { Badge } from '@/components/ui/badge';
import { useSearchParams } from 'react-router';

export function TagChip({ tag }: { tag: string }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const handleClick = () => {
    const params = new URLSearchParams(searchParams);
    params.set('q', tag);
    params.set('mode', 'fulltext');
    setSearchParams(params);
  };

  return (
    <Badge
      variant="secondary"
      className="cursor-pointer text-xs hover:bg-muted"
      onClick={handleClick}
    >
      {tag}
    </Badge>
  );
}
