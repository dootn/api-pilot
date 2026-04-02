import { SearchHighlightPre } from './SearchHighlightPre';

interface Props {
  raw: string;
  searchTerm?: string;
  currentMatchIdx?: number;
  onMatchCount?: (count: number) => void;
}

export function TextViewer({ raw, searchTerm = '', currentMatchIdx = 0, onMatchCount }: Props) {
  return (
    <SearchHighlightPre
      text={raw}
      term={searchTerm}
      currentMatchIdx={currentMatchIdx}
      onMatchCount={onMatchCount}
    />
  );
}


