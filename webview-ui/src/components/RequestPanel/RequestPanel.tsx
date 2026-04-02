import { UrlBar } from './UrlBar';
import { RequestTabs } from './RequestTabs';
import { RequestTitle } from './RequestTitle';

export function RequestPanel() {
  return (
    <div className="flex-col flex-1" style={{ minHeight: 0 }}>
      <RequestTitle />
      <UrlBar />
      <RequestTabs />
    </div>
  );
}
