import { useCallback } from 'react';
import { TabBar } from './components/Layout/TabBar';
import { RequestPanel } from './components/RequestPanel/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel/ResponsePanel';
import { useVscodeMessage } from './hooks/useVscodeMessage';
import { useTabStore, type RequestTab } from './stores/tabStore';
import type { ApiResponse } from './stores/requestStore';
import { vscode } from './vscode';

function App() {
  const updateTab = useTabStore((s) => s.updateTab);
  const addTabWithData = useTabStore((s) => s.addTabWithData);

  const handleMessage = useCallback(
    (message: { type: string; requestId?: string; payload?: unknown }) => {
      switch (message.type) {
        case 'loadRequest': {
          const request = message.payload as Partial<RequestTab>;
          addTabWithData(request || {});
          return;
        }
      }

      const tabId = message.requestId;
      if (!tabId) return;

      switch (message.type) {
        case 'requestResult':
          updateTab(tabId, {
            response: message.payload as ApiResponse,
            responseError: null,
            loading: false,
          });
          break;
        case 'requestError':
          updateTab(tabId, {
            responseError: (message.payload as { message: string })?.message || 'Unknown error',
            response: null,
            loading: false,
          });
          break;
        case 'requestProgress':
          break;
      }
    },
    [updateTab, addTabWithData]
  );

  useVscodeMessage(handleMessage);

  return (
    <div className="split-view">
      <TabBar />
      <RequestPanel />
      <ResponsePanel />
    </div>
  );
}

export default App;
