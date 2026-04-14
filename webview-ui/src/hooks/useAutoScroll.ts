import { useState, useRef, useEffect } from 'react';

/**
 * Hook to auto-scroll a container to the bottom when a dependency changes.
 * Returns { autoScroll, setAutoScroll, endRef } — attach endRef to a sentinel
 * div at the bottom of the scrollable list.
 */
export function useAutoScroll(dep: unknown) {
  const [autoScroll, setAutoScroll] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dep, autoScroll]);

  return { autoScroll, setAutoScroll, endRef } as const;
}
