import type { Run, Span } from './model.ts';
import { elapsedMs } from './compare.ts';

export function runInsights(run: Run) {
  const completed = run.spans.filter(span => elapsedMs(span) !== null);
  const slowest = (spans: Span[]) => [...spans].sort((a, b) => elapsedMs(b)! - elapsedMs(a)! || a.id.localeCompare(b.id)).slice(0, 5);
  const tools = new Map<string, Span[]>();
  for (const span of run.spans) if (span.type === 'tool') { const list = tools.get(span.name) ?? []; list.push(span); tools.set(span.name, list); }
  return { errors: run.spans.filter(span => span.status === 'error'), unfinished: run.spans.filter(span => span.status === 'running' || span.ended_at === null),
    slowest: slowest(completed), slowestTools: slowest(completed.filter(span => span.type === 'tool')),
    repeatedTools: [...tools].filter(([, spans]) => spans.length > 1).map(([name, spans]) => ({ name, spans })).sort((a, b) => b.spans.length - a.spans.length || a.name.localeCompare(b.name)) };
}
