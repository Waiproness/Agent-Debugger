import type { Span, SpanType, Status } from './model.ts';

export interface SpanFilters { query: string; status: Status | 'all'; type: SpanType | 'all' }
export const EMPTY_FILTERS: SpanFilters = { query: '', status: 'all', type: 'all' };
export interface SearchEntry { span: Span; text: string }

export function buildSpanSearch(spans: readonly Span[]): SearchEntry[] {
  return spans.map(span => {
    const text = [span.id, span.name, span.type];
    const pending: unknown[] = [span.input, span.output, span.error];
    // Index real keys/scalars once; null carries no text and payloads stay untouched.
    while (pending.length > 0) {
      const value = pending.pop();
      if (value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) pending.push(item);
      } else if (typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) pending.push(key, item);
      } else {
        text.push(String(value));
      }
    }
    return { span, text: text.join('\n').toLowerCase() };
  });
}

export function filterSpanSearch(index: readonly SearchEntry[], filters: SpanFilters): Span[] {
  const query = filters.query.trim().toLowerCase();
  return index.filter(({ span, text }) => (filters.status === 'all' || span.status === filters.status)
    && (filters.type === 'all' || span.type === filters.type) && text.includes(query)).map(entry => entry.span);
}
