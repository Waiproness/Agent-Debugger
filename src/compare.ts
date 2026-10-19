import type { Run, Span } from './model.ts';
import { spanDepths } from './view.ts';

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

export interface SpanMatch { a: Span; b: Span; reason: 'structure' | 'name-depth' }
export function matchSpans(a: Run, b: Run) {
  const tokens = new Map<string, number>();
  const describe = (run: Run) => {
    const children = new Map<string | null, Span[]>();
    for (const span of run.spans) { const list = children.get(span.parent_id) ?? []; list.push(span); children.set(span.parent_id, list); }
    for (const list of children.values()) list.sort((x, y) => Date.parse(x.started_at) - Date.parse(y.started_at));
    const queue = [{ parent: null as string | null, token: 0 }], result = new Map<string, number>();
    for (let index = 0; index < queue.length; index++) {
      const { parent, token } = queue[index], occurrences = new Map<string, number>();
      for (const span of children.get(parent) ?? []) {
        const name = JSON.stringify([span.type, span.name]), count = occurrences.get(name) ?? 0;
        occurrences.set(name, count + 1);
        const key = JSON.stringify([token, name, count]);
        if (!tokens.has(key)) tokens.set(key, tokens.size + 1);
        const own = tokens.get(key)!; result.set(span.id, own); queue.push({ parent: span.id, token: own });
      }
    }
    return result;
  };
  const keysA = describe(a), keysB = describe(b), byKey = new Map(b.spans.map(span => [keysB.get(span.id), span]));
  const pairs: SpanMatch[] = [], usedA = new Set<string>(), usedB = new Set<string>();
  for (const span of a.spans) { const other = byKey.get(keysA.get(span.id)); if (other) { pairs.push({ a: span, b: other, reason: 'structure' }); usedA.add(span.id); usedB.add(other.id); } }
  const depthsA = spanDepths(a.spans), depthsB = spanDepths(b.spans);
  const fallback = (span: Span, depths: Map<string, number>) => JSON.stringify([span.type, span.name, depths.get(span.id)]);
  const buckets = new Map<string, Span[]>();
  for (const span of b.spans) if (!usedB.has(span.id)) { const key = fallback(span, depthsB), list = buckets.get(key) ?? []; list.push(span); buckets.set(key, list); }
  const offsets = new Map<string, number>();
  for (const span of a.spans) if (!usedA.has(span.id)) {
    const key = fallback(span, depthsA), offset = offsets.get(key) ?? 0, other = buckets.get(key)?.[offset];
    if (other) { offsets.set(key, offset + 1); pairs.push({ a: span, b: other, reason: 'name-depth' }); usedA.add(span.id); usedB.add(other.id); }
  }
  return { pairs, unmatchedA: a.spans.filter(span => !usedA.has(span.id)), unmatchedB: b.spans.filter(span => !usedB.has(span.id)) };
}

export interface JsonChange { path: string; a: unknown; b: unknown; hasA: boolean; hasB: boolean }
export function diffJson(a: unknown, b: unknown, limit = 200) {
  const changes: JsonChange[] = [], pending: JsonChange[] = [{ path: '$', a, b, hasA: true, hasB: true }];
  while (pending.length) {
    const item = pending.pop()!, { a: left, b: right, path, hasA, hasB } = item;
    if (hasA === hasB && left === right) continue;
    if (hasA && hasB && left !== null && right !== null && typeof left === 'object' && typeof right === 'object' && Array.isArray(left) === Array.isArray(right)) {
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
      for (let i = keys.length - 1; i >= 0; i--) { const key = keys[i]; pending.push({ path: `${path}[${JSON.stringify(key)}]`, a: (left as Record<string, unknown>)[key], b: (right as Record<string, unknown>)[key], hasA: Object.hasOwn(left, key), hasB: Object.hasOwn(right, key) }); }
    } else {
      if (changes.length === limit) return { changes, truncated: true };
      changes.push(item);
    }
  }
  return { changes, truncated: false };
}
