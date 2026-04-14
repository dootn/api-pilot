import { memo } from 'react';
import type { TestResult } from '../../stores/requestStore';
import { useI18n } from '../../i18n';
import { EmptyState } from '../shared/EmptyState';

export const TestResultsTab = memo(function TestResultsTab({ results }: { results: TestResult[] }) {
  const t = useI18n();

  if (results.length === 0) {
    return (
      <EmptyState icon="📋" title={t('respNoTests')} subtitle={t('respNoTestsHint')} padding="60px 40px" />
    );
  }

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {results.map((result, i) => (
        <div
          key={i}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px',
            borderRadius: 4,
            background: result.passed
              ? 'rgba(78,201,176,0.08)'
              : 'rgba(241,76,76,0.08)',
            borderLeft: `3px solid ${
              result.passed ? 'var(--success-fg, #4ec9b0)' : 'var(--error-fg, #f14c4c)'
            }`,
          }}
        >
          <span style={{ fontSize: 12, flexShrink: 0 }}>{result.passed ? '✓' : '✗'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12 }}>{result.name}</div>
            {result.error && (
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2, wordBreak: 'break-word' }}>
                {result.error}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});
