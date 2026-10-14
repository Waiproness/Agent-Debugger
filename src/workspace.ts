import type { Run } from './model.ts';
import { chooseComparisonRun } from './compare.ts';
import type { ComparisonSelection } from './compare.ts';

export function selectionAfterDelete(runs: Run[], removedId: string, runId: string | null, spanId: string | null, comparison: ComparisonSelection) {
  const remaining = runs.filter(run => run.id !== removedId);
  const next = remaining[runs.findIndex(run => run.id === removedId)] ?? remaining[0];
  let nextComparison = comparison;
  if (comparison.runA === removedId) nextComparison = chooseComparisonRun(nextComparison, 'A', null);
  if (comparison.runB === removedId) nextComparison = chooseComparisonRun(nextComparison, 'B', null);
  return {
    runId: runId === removedId ? next?.id ?? null : runId,
    spanId: runId === removedId ? next?.spans[0]?.id ?? null : spanId,
    comparison: nextComparison,
  };
}

export function newExamples(examples: Run[], existing: Run[]) {
  const ids = new Set(existing.map(run => run.id));
  const added = examples.filter(run => !ids.has(run.id));
  return { added, skipped: examples.length - added.length };
}
