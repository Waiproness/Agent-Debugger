import test from 'node:test';
import assert from 'node:assert/strict';
import { spanDepths } from '../src/view.ts';

test('empty runs and multiple independent roots have depth zero', () => {
  assert.equal(spanDepths([]).size, 0);
  assert.deepEqual(spanDepths([{ id: 'a', parent_id: null }, { id: 'b', parent_id: null }]), new Map([['a', 0], ['b', 0]]));
});
test('parents may appear after children with multiple levels and shared parents', () => {
  const spans = [
    { id: 'leaf', parent_id: 'branch' },
    { id: 'sibling', parent_id: 'branch' },
    { id: 'branch', parent_id: 'root' },
    { id: 'other-leaf', parent_id: 'other-root' },
    { id: 'root', parent_id: null },
    { id: 'other-root', parent_id: null },
  ];
  const before = structuredClone(spans);
  const depths = spanDepths(spans);
  assert.deepEqual([...depths].sort(), [['branch', 1], ['leaf', 2], ['other-leaf', 1], ['other-root', 0], ['root', 0], ['sibling', 2]]);
  assert.deepEqual(spans, before);
});
test('a reversed 100,000-span chain computes every level without recursion', () => {
  const spans = Array.from({ length: 100_000 }, (_, index) => ({ id: String(index), parent_id: index === 0 ? null : String(index - 1) }));
  const depths = spanDepths(spans.reverse());
  assert.equal(depths.size, spans.length);
  for (let index = 0; index < spans.length; index++) assert.equal(depths.get(String(index)), index);
});
test('a new span array recomputes changed ancestry and keeps old results intact', () => {
  const original = [{ id: 'root', parent_id: null }, { id: 'child', parent_id: 'root' }];
  const originalDepths = spanDepths(original);
  const changed = original.map(span => ({ ...span, parent_id: null }));
  assert.equal(spanDepths(changed).get('child'), 0);
  assert.equal(originalDepths.get('child'), 1);
});
