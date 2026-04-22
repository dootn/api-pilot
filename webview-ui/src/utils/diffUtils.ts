export interface DiffLine {
  type: 'equal' | 'added' | 'removed';
  value: string;
}

/** Pretty-print JSON if valid, otherwise return original text. */
export function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/**
 * Line-level LCS diff between two strings.
 * Falls back to a simple removed/added block for very large inputs to avoid O(N*M) cost.
 */
export function computeLineDiff(a: string, b: string): DiffLine[] {
  const aLines = a === '' ? [] : a.split('\n');
  const bLines = b === '' ? [] : b.split('\n');

  const m = aLines.length;
  const n = bLines.length;

  if (m * n > 200_000) {
    return [
      ...aLines.map((v) => ({ type: 'removed' as const, value: v })),
      ...bLines.map((v) => ({ type: 'added' as const, value: v })),
    ];
  }

  // Build DP table
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aLines[i - 1] === bLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = dp[i - 1][j] >= dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1];
      }
    }
  }

  // Backtrack to build result
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      result.unshift({ type: 'equal', value: aLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', value: bLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', value: aLines[i - 1] });
      i--;
    }
  }

  return result;
}
