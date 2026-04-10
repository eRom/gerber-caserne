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
    <button
      onClick={handleClick}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors cursor-pointer"
    >
      {tag}
    </button>
  );
}
