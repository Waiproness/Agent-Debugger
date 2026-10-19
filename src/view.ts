import type { Run, Span } from './model.ts';

export function seconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} s`;
}
export function duration(start: string, end: string | null): string {
  return end === null ? 'ยังไม่จบ' : seconds(Date.parse(end) - Date.parse(start));
}
export function recordedEnd(run: Run): number {
  if (run.ended_at !== null) return Date.parse(run.ended_at);
  return run.spans.reduce((end, span) => Math.max(end, Date.parse(span.ended_at ?? span.started_at)), Date.parse(run.started_at));
}
export function spanDepths(spans: readonly Span[]): Map<string, number> {
  const children = new Map<string | null, string[]>();
  for (const span of spans) {
    const siblings = children.get(span.parent_id);
    if (siblings) siblings.push(span.id);
    else children.set(span.parent_id, [span.id]);
  }
  const depths = new Map<string, number>();
  const pending = (children.get(null) ?? []).map(id => ({ id, level: 0 }));
  // Walk the validated forest iteratively: each span is visited once, including deep chains.
  for (let index = 0; index < pending.length; index++) {
    const { id, level } = pending[index];
    depths.set(id, level);
    for (const child of children.get(id) ?? []) pending.push({ id: child, level: level + 1 });
  }
  return depths;
}
export function displayValue(value: unknown): string {
  return value === null ? 'ไม่มีข้อมูล (null)' : JSON.stringify(value, null, 2);
}
