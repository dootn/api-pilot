import { useState, useCallback, useRef } from 'react';

/**
 * Hook that wraps navigator.clipboard.writeText with a "copied" feedback state.
 * @param resetMs Time in ms before `copied` resets to false. Default 2000.
 */
export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const copy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), resetMs);
      });
    },
    [resetMs],
  );

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    setCopied(false);
  }, []);

  return { copied, copy, reset } as const;
}
