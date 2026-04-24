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
 * Check if the target element is an editable input (input, textarea, contentEditable).
 */
function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  const isInputElement = tagName === 'input' || tagName === 'textarea';
  const isContentEditable = target.isContentEditable;

  return isInputElement || isContentEditable;
}

/**
 * Check if the target element is inside a modal dialog.
 */
function isInsideModal(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  // Check if the target or any of its ancestors have modal-related classes
  let current: HTMLElement | null = target;
  while (current) {
    if (current.classList.contains('modal-overlay') || current.classList.contains('modal-panel')) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Hook to handle Ctrl+V paste import of cURL/fetch requests.
 * Listens for paste events and sends detected requests to the extension for parsing.
 * Skips import when pasting into input fields or modal dialogs.
 */
export function usePasteImport(): void {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      // Skip if pasting into an editable element (input, textarea, contentEditable)
      if (isEditableElement(event.target)) {
        return;
      }

      // Skip if pasting inside a modal dialog
      if (isInsideModal(event.target)) {
        return;
      }

      const pastedText = event.clipboardData?.getData('text');
      if (!pastedText) return;

      if (isRequestFormat(pastedText)) {
        // Prevent default paste behavior
        event.preventDefault();
        event.stopPropagation();

        // Send to extension for parsing and import
        vscode.postMessage({
          type: 'importRequest',
          payload: { input: pastedText, newTab: true },
        });
      }
    };

    // Add global paste listener (capture phase to intercept before inputs)
    document.addEventListener('paste', handlePaste, true);

    return () => {
      document.removeEventListener('paste', handlePaste, true);
    };
  }, []);
}
