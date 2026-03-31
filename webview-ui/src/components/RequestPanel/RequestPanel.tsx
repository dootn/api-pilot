import { UrlBar } from './UrlBar';
import { RequestTabs } from './RequestTabs';

export function RequestPanel() {
  return (
    <div className="flex-col flex-1" style={{ minHeight: 0 }}>
      <UrlBar />
      <RequestTabs />
    </div>
  );
}
