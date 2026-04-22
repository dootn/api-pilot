import { useMemo } from 'react';
import { useI18n } from '../../i18n';
import { computeLineDiff, prettyJson } from '../../utils/diffUtils';
import type { DiffLine } from '../../utils/diffUtils';

interface Props {
  leftBody: string;
  rightBody: string;
}

function lineBackground(type: DiffLine['type']): string | undefined {
  if (type === 'added') return 'rgba(40,180,80,0.18)';
  if (type === 'removed') return 'rgba(220,60,60,0.18)';
  return undefined;
}

function lineColor(type: DiffLine['type']): string | undefined {
  if (type === 'added') return 'rgba(40,180,80,0.9)';
  if (type === 'removed') return 'rgba(220,60,60,0.9)';
  return undefined;
}

export function CompareBodyDiff({ leftBody, rightBody }: Props) {
  const t = useI18n();

  const diff = useMemo(() => {
    return computeLineDiff(prettyJson(leftBody), prettyJson(rightBody));
  }, [leftBody, rightBody]);

  const addedCount = diff.filter((d) => d.type === 'added').length;
  const removedCount = diff.filter((d) => d.type === 'removed').length;
  const isIdentical = addedCount === 0 && removedCount === 0;

  if (isIdentical) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', opacity: 0.6, fontSize: 13 }}>
        {t('compareNoDiff')}
      </div>
    );
  }

  // Build paired rows: for each diff line, decide which column it goes into
  // We do a split view: left shows removed/equal, right shows added/equal
  interface SideLine {
    value: string;
    type: DiffLine['type'] | 'empty';
    lineNo?: number;
  }
  const leftLines: SideLine[] = [];
  const rightLines: SideLine[] = [];

  let leftNo = 1;
  let rightNo = 1;

  for (const line of diff) {
    if (line.type === 'equal') {
      leftLines.push({ value: line.value, type: 'equal', lineNo: leftNo++ });
      rightLines.push({ value: line.value, type: 'equal', lineNo: rightNo++ });
    } else if (line.type === 'removed') {
      leftLines.push({ value: line.value, type: 'removed', lineNo: leftNo++ });
      rightLines.push({ value: '', type: 'empty' });
    } else {
      leftLines.push({ value: '', type: 'empty' });
      rightLines.push({ value: line.value, type: 'added', lineNo: rightNo++ });
    }
  }

  const GUTTER: React.CSSProperties = {
    width: 36,
    textAlign: 'right',
    paddingRight: 8,
    color: 'rgba(128,128,128,0.6)',
    fontSize: 11,
    userSelect: 'none',
    flexShrink: 0,
  };

  const SIDE: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: 12,
    lineHeight: '20px',
  };

  const LINE: React.CSSProperties = {
    display: 'flex',
    minWidth: 'max-content',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, padding: '4px 0' }}>
        <span style={{ color: 'rgba(40,180,80,0.9)', fontWeight: 600 }}>+{addedCount} {t('compareDiffAdded')}</span>
        <span style={{ color: 'rgba(220,60,60,0.9)', fontWeight: 600 }}>−{removedCount} {t('compareDiffRemoved')}</span>
      </div>

      {/* Side-by-side diff */}
      <div style={{ display: 'flex', flex: 1, gap: 4, minHeight: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: 4 }}>
        {/* Left side */}
        <div style={SIDE}>
          {leftLines.map((l, idx) => (
            <div
              key={idx}
              style={{ ...LINE, background: l.type === 'empty' ? 'var(--vscode-diffEditor-removedLineBackground, rgba(220,60,60,0.05))' : lineBackground(l.type as DiffLine['type']) }}
            >
              <span style={GUTTER}>{l.lineNo ?? ''}</span>
              <span style={{ flex: 1, paddingLeft: 8, whiteSpace: 'pre', color: lineColor(l.type as DiffLine['type']) }}>
                {l.type === 'empty' ? '' : (l.type === 'removed' ? '− ' : '  ') + l.value}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: 'var(--border-color)', flexShrink: 0 }} />

        {/* Right side */}
        <div style={SIDE}>
          {rightLines.map((l, idx) => (
            <div
              key={idx}
              style={{ ...LINE, background: l.type === 'empty' ? 'var(--vscode-diffEditor-insertedLineBackground, rgba(40,180,80,0.05))' : lineBackground(l.type as DiffLine['type']) }}
            >
              <span style={GUTTER}>{l.lineNo ?? ''}</span>
              <span style={{ flex: 1, paddingLeft: 8, whiteSpace: 'pre', color: lineColor(l.type as DiffLine['type']) }}>
                {l.type === 'empty' ? '' : (l.type === 'added' ? '+ ' : '  ') + l.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
