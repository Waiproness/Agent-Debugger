import type { Run, Span } from './model.ts';

export interface ComparisonSelection {
  runA: string | null;
  runB: string | null;
  spanA: string | null;
  spanB: string | null;
}
export const EMPTY_COMPARISON: ComparisonSelection = { runA: null, runB: null, spanA: null, spanB: null };

export function chooseComparisonRun(current: ComparisonSelection, side: 'A' | 'B', id: string | null): ComparisonSelection {
  if (side === 'A') {
    if (id === current.runA || (id !== null && id === current.runB)) return current;
    return { ...current, runA: id, spanA: null };
  }
  if (id === current.runB || (id !== null && id === current.runA)) return current;
  return { ...current, runB: id, spanB: null };
}
export function swapComparison(current: ComparisonSelection): ComparisonSelection {
  return { runA: current.runB, runB: current.runA, spanA: current.spanB, spanB: current.spanA };
}
export function elapsedMs(item: Pick<Run, 'started_at' | 'ended_at'>): number | null {
  return item.ended_at === null ? null : Date.parse(item.ended_at) - Date.parse(item.started_at);
}
export function summaryDifference(a: Run, b: Run) {
  const timeA = elapsedMs(a);
  const timeB = elapsedMs(b);
  return {
    durationMs: timeA === null || timeB === null ? null : timeB - timeA,
    spanCount: b.spans.length - a.spans.length,
    errorCount: b.spans.filter(span => span.status === 'error').length - a.spans.filter(span => span.status === 'error').length,
  };
}

/** Structural equality for validated JSON values; object key order is irrelevant. */
export function jsonEqual(left: unknown, right: unknown): boolean {
  const pending: [unknown, unknown][] = [[left, right]];
  while (pending.length > 0) {
    const [a, b] = pending.pop()!;
    if (a === b) continue;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (let index = 0; index < a.length; index++) pending.push([a[index], b[index]]);
    } else {
      if (Array.isArray(b)) return false;
      const keys = Object.keys(a);
      if (keys.length !== Object.keys(b).length) return false;
      for (const key of keys) {
        if (!Object.hasOwn(b, key)) return false;
        pending.push([(a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]]);
      }
    }
  }
  return true;
}

export const COMPARISON_FIELDS = ['type', 'name', 'status', 'duration', 'input', 'output', 'error'] as const;
export type ComparisonField = typeof COMPARISON_FIELDS[number];
export type FieldDifference = 'same' | 'different' | 'unselected' | 'unavailable';
export function spanField(span: Span, field: ComparisonField) {
  return field === 'duration' ? elapsedMs(span) : span[field];
}
export function compareSpanFields(a: Span | undefined, b: Span | undefined): Record<ComparisonField, FieldDifference> {
  return Object.fromEntries(COMPARISON_FIELDS.map(field => [field, !a || !b ? 'unselected'
    : field === 'duration' && (a.ended_at === null || b.ended_at === null) ? 'unavailable'
    : jsonEqual(spanField(a, field), spanField(b, field)) ? 'same' : 'different'])) as Record<ComparisonField, FieldDifference>;
}
