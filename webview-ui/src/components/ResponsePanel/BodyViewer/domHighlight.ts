function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove all <mark class="search-hl"> nodes previously added by applyHighlights,
 * splicing their text content back into the DOM.
 */
export function clearHighlights(container: HTMLElement, cls = 'search-hl'): void {
  const marks = Array.from(container.querySelectorAll(`mark.${cls}`));
  for (const mark of marks) {
    const text = document.createTextNode(mark.textContent ?? '');
    mark.parentNode?.replaceChild(text, mark);
    text.parentNode?.normalize();
  }
}

/**
 * Walk all text nodes inside `container`, wrap each match with
 * <mark class="search-hl">, and return the total match count.
 */
export function applyHighlights(
  container: HTMLElement,
  term: string,
  cls = 'search-hl',
): number {
  if (!term.trim()) return 0;

  const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip text inside already-highlighted mark nodes
      if ((node.parentElement as HTMLElement)?.tagName === 'MARK') {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let n: Node | null = walker.nextNode();
  while (n) {
    textNodes.push(n as Text);
    n = walker.nextNode();
  }

  let matchCount = 0;

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? '';
    if (!regex.test(text)) {
      regex.lastIndex = 0;
      continue;
    }
    regex.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) {
        fragment.appendChild(document.createTextNode(text.slice(last, m.index)));
      }
      const mark = document.createElement('mark');
      mark.className = cls;
      mark.style.cssText =
        'background:#f9d300;color:#1a1a1a;border-radius:2px;';
      mark.textContent = m[0];
      fragment.appendChild(mark);
      matchCount++;
      last = m.index + m[0].length;
    }

    if (last < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(last)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return matchCount;
}

/**
 * Apply "current match" styling to the mark at `index` and scroll it into view.
 * All other marks revert to the default highlight colour.
 */
export function navigateToMatch(
  container: HTMLElement,
  index: number,
  cls = 'search-hl',
): void {
  const marks = Array.from(container.querySelectorAll<HTMLElement>(`mark.${cls}`));
  marks.forEach((m, i) => {
    m.style.background =
      i === index
        ? '#e07700'
        : '#f9d300';
    m.style.color = '#1a1a1a';
  });
  marks[index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

