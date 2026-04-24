import { useEffect } from 'react';
import { vscode } from '../vscode';

/**
 * Detect if the pasted text is a cURL command.
 */
function isCurl(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return trimmed.startsWith('curl');
}

/**
 * Detect if the pasted text is a fetch() call.
 */
function isFetch(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('fetch(') || lower.includes('fetch (');
}

/**
 * Detect if the pasted text is a supported request format (curl or fetch).
 */
function isRequestFormat(text: string): boolean {
  return isCurl(text) || isFetch(text);
}

/**
 * Hook to handle Ctrl+V paste import of cURL/fetch requests.
 * Listens for paste events and sends detected requests to the extension for parsing.
 */
export function usePasteImport(): void {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const pastedText = event.clipboardData?.getData('text');
      if (!pastedText) return;

      if (isRequestFormat(pastedText)) {
        // Prevent default paste behavior (e.g., pasting into input fields)
        event.preventDefault();
        event.stopPropagation();

        // Send to extension for parsing and import
        vscode.postMessage({
          type: 'importRequest',
          payload: { input: pastedText, newTab: true },
        });
      }
    };

    // Add global paste listener
    document.addEventListener('paste', handlePaste, true);

    return () => {
      document.removeEventListener('paste', handlePaste, true);
    };
  }, []);
}
