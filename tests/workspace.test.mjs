import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionAfterDelete, newExamples } from '../src/workspace.ts';
const runs = ['a', 'b', 'c'].map(id => ({ id, spans: [{ id: `span-${id}` }] }));
const pair = { runA: 'a', runB: 'b', spanA: 'span-a', spanB: 'span-b' };
test('delete selected single run selects the next in order; last wraps to first; final deletion is empty', () => {
  assert.equal(selectionAfterDelete(runs, 'b', 'b', 'span-b', pair).runId, 'c');
  assert.equal(selectionAfterDelete(runs, 'b', 'b', 'span-b', pair).spanId, 'span-c');
  assert.equal(selectionAfterDelete(runs, 'c', 'c', 'span-c', pair).runId, 'a');
  assert.deepEqual(selectionAfterDelete([runs[0]], 'a', 'a', 'span-a', pair), { runId: null, spanId: null, comparison: { runA: null, runB: 'b', spanA: null, spanB: 'span-b' } });
});
test('delete only clears the affected comparison side and its step; unrelated single selection stays', () => {
  const before = structuredClone(pair);
  assert.deepEqual(selectionAfterDelete(runs, 'a', 'c', 'span-c', pair), { runId: 'c', spanId: 'span-c', comparison: { ...pair, runA: null, spanA: null } });
  assert.deepEqual(selectionAfterDelete(runs, 'b', 'a', 'span-a', pair).comparison, { ...pair, runB: null, spanB: null });
  assert.deepEqual(selectionAfterDelete(runs, 'c', 'a', 'span-a', pair).comparison, pair);
  assert.deepEqual(pair, before);
});
test('repeated sample loading skips existing/restored IDs and reports skipped count without mutation', () => {
  const existing = [runs[1]];
  const result = newExamples(runs, existing);
  assert.deepEqual(result, { added: [runs[0], runs[2]], skipped: 1 });
  assert.deepEqual(newExamples(runs, [...existing, ...result.added]), { added: [], skipped: 3 });
  assert.deepEqual(existing, [runs[1]]);
});
