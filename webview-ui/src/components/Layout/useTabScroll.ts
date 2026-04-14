import { useState, useRef, useEffect, useCallback } from 'react';

export function useTabScroll(tabs: unknown[], activeTabId: string | null) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Attach scroll listener + ResizeObserver
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    updateScrollState();
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  // Re-check when tabs change
  useEffect(() => { updateScrollState(); }, [tabs, updateScrollState]);

  // Scroll active tab into view
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !activeTabId) return;
    const activeEl = container.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  // Horizontal wheel → horizontal scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const scrollLeft = () => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' });
  };

  const scrollRight = () => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
  };

  return { canScrollLeft, canScrollRight, scrollRef, scrollLeft, scrollRight };
}
