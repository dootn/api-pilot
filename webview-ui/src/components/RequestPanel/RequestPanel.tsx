import { UrlBar } from './UrlBar';
import { RequestTabs } from './RequestTabs';

export function RequestPanel() {
  return (
    <div className="flex-col flex-1">
      <UrlBar />
      <RequestTabs />
    </div>
  );
}
