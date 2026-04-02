import { useState, useMemo, useEffect, useCallback } from 'react';
import type { BodyType, ViewMode } from './types';
import { parseBody } from './Parser';
import { JsonViewer } from './JsonViewer';
import { HtmlViewer } from './HtmlViewer';
import { TextViewer } from './TextViewer';
import { XmlViewer } from './XmlViewer';
import { MarkdownViewer } from './MarkdownViewer';
import { ImageViewer } from './ImageViewer';
import { Toolbar } from './Toolbar';

const MODES_BY_TYPE: Partial<Record<BodyType, ViewMode[]>> = {
  json:     ['pretty', 'raw'],
  html:     ['pretty', 'raw', 'preview'],
  xml:      ['pretty', 'raw'],
  markdown: ['pretty', 'raw'],
};

function getAvailableModes(type: BodyType): ViewMode[] {
  return MODES_BY_TYPE[type] ?? [];
}

export interface BodyViewerProps {
  body: string;
  contentType?: string;
  bodyBase64?: string;
  bodySize?: number;
}

export function BodyViewer({ body, contentType, bodyBase64, bodySize }: BodyViewerProps) {
  const parsed = useMemo(
    () => parseBody(body, contentType, bodyBase64),
    [body, contentType, bodyBase64],
  );

  const availableModes = useMemo(() => getAvailableModes(parsed.type), [parsed.type]);

  // Reset to first mode whenever the detected type changes.
  const [mode, setMode] = useState<ViewMode>(() => availableModes[0] ?? 'raw');
  useEffect(() => {
    setMode(availableModes[0] ?? 'raw');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.type]);

  const [searchTerm, setSearchTerm] = useState('');
  const handleSearchChange = useCallback((term: string) => setSearchTerm(term), []);

  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  // Reset navigation when search term or body type changes
  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [searchTerm, parsed.type]);

  // Clear search when switching away from pretty mode
  useEffect(() => {
    setSearchTerm('');
  }, [mode]);

  const handlePrev = useCallback(() => {
    setCurrentMatchIdx((i) => (i - 1 + matchCount) % matchCount);
  }, [matchCount]);

  const handleNext = useCallback(() => {
    setCurrentMatchIdx((i) => (i + 1) % matchCount);
  }, [matchCount]);

  function renderContent() {
    switch (parsed.type) {
      case 'json':
        if (mode === 'raw') {
          // Raw mode: show original unformatted content, no search
          return <TextViewer raw={parsed.raw} />;
        }
        return <JsonViewer data={parsed.data} raw={parsed.raw} searchTerm={searchTerm} currentMatchIdx={currentMatchIdx} onMatchCount={setMatchCount} />;

      case 'html':
        return <HtmlViewer raw={parsed.raw} mode={mode} searchTerm={searchTerm} currentMatchIdx={currentMatchIdx} onMatchCount={setMatchCount} />;

      case 'xml':
        return <XmlViewer raw={parsed.raw} mode={mode} searchTerm={searchTerm} currentMatchIdx={currentMatchIdx} onMatchCount={setMatchCount} />;

      case 'markdown':
        return <MarkdownViewer raw={parsed.raw} mode={mode} searchTerm={searchTerm} currentMatchIdx={currentMatchIdx} onMatchCount={setMatchCount} />;

      case 'image':
      case 'video':
      case 'audio':
      case 'pdf':
        return (
          <ImageViewer
            type={parsed.type}
            data={parsed.data}
            contentType={contentType}
            bodySize={bodySize}
          />
        );

      case 'binary':
        return (
          <ImageViewer
            type="binary"
            data={parsed.data}
            contentType={contentType}
            bodySize={bodySize}
          />
        );

      case 'text':
      default:
        return <TextViewer raw={parsed.raw} searchTerm={searchTerm} currentMatchIdx={currentMatchIdx} onMatchCount={setMatchCount} />;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar
        type={parsed.type}
        mode={mode}
        setMode={setMode}
        raw={parsed.raw}
        availableModes={availableModes}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        matchCount={matchCount}
        currentMatchIdx={currentMatchIdx}
        onPrev={handlePrev}
        onNext={handleNext}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
}

