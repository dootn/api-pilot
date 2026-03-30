import { useEffect } from 'react';
import { vscode } from '../vscode';

type MessageCallback = (message: { type: string; requestId?: string; payload?: unknown }) => void;

export function useVscodeMessage(callback: MessageCallback): void {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message && typeof message.type === 'string') {
        callback(message);
      }
    };
    const cleanup = vscode.onMessage(handler);
    return cleanup;
  }, [callback]);
}
