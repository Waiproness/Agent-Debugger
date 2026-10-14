import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chooseComparisonRun, compareSpanFields, EMPTY_COMPARISON, elapsedMs, jsonEqual, spanField, summaryDifference, swapComparison } from '../src/compare.ts';

const example = async name => JSON.parse(await readFile(new URL(`../public/examples/${name}.json`, import.meta.url), 'utf8')).runs[0];
const success = await example('success');
const error = await example('tool-error');
const running = await example('parallel-nested');

test('summary numbers are B minus A and duration is wall clock, not summed spans', () => {
  const before = structuredClone([success, error]);
  assert.deepEqual(summaryDifference(success, error), { durationMs: -4000, spanCount: -1, errorCount: 2 });
  assert.deepEqual(summaryDifference(error, success), { durationMs: 4000, spanCount: 1, errorCount: -2 });
  assert.equal(elapsedMs(success), 12000);
  assert.deepEqual([success, error], before);
});
test('running durations stay missing; empty runs still compare numeric counts', () => {
  assert.equal(summaryDifference(success, running).durationMs, null);
  assert.equal(summaryDifference(running, success).durationMs, null);
  assert.equal(summaryDifference(running, running).durationMs, null);
  const empty = { ...success, id: 'empty', spans: [] };
  assert.deepEqual(summaryDifference(success, empty), { durationMs: 0, spanCount: -5, errorCount: 0 });
});
test('zero durations and equivalent timezone offsets keep their real value', () => {
  assert.equal(elapsedMs({ started_at: '2026-10-13T09:00:00+07:00', ended_at: '2026-10-13T02:00:00Z' }), 0);
});
test('run choices reject the other side ID and changing only one side clears only its span', () => {
  const initial = { runA: 'a', runB: 'b', spanA: 'step-a', spanB: 'step-b' };
  assert.equal(chooseComparisonRun(initial, 'A', 'b'), initial);
  assert.equal(chooseComparisonRun(initial, 'B', 'a'), initial);
  assert.equal(chooseComparisonRun(initial, 'A', 'a'), initial);
  assert.deepEqual(chooseComparisonRun(initial, 'A', 'c'), { ...initial, runA: 'c', spanA: null });
  assert.deepEqual(chooseComparisonRun(initial, 'B', null), { ...initial, runB: null, spanB: null });
  assert.deepEqual(initial, { runA: 'a', runB: 'b', spanA: 'step-a', spanB: 'step-b' });
});
test('choosing runs never matches steps automatically even with identical IDs', () => {
  const a = chooseComparisonRun(EMPTY_COMPARISON, 'A', success.id);
  const pair = chooseComparisonRun(a, 'B', error.id);
  assert.equal(success.spans[0].id, error.spans[0].id);
  assert.equal(pair.spanA, null); assert.equal(pair.spanB, null);
});
test('swapping moves steps with their run and is reversible without mutation', () => {
  const initial = { runA: 'a', runB: 'b', spanA: 'x', spanB: 'y' };
  assert.deepEqual(swapComparison(initial), { runA: 'b', runB: 'a', spanA: 'y', spanB: 'x' });
  assert.deepEqual(swapComparison(swapComparison(initial)), initial);
  assert.deepEqual(swapComparison(EMPTY_COMPARISON), EMPTY_COMPARISON);
});
test('JSON object key order is irrelevant at every level', () => {
  assert.ok(jsonEqual({ a: 1, b: { x: false, y: [0, null, ''] } }, { b: { y: [0, null, ''], x: false }, a: 1 }));
  assert.ok(jsonEqual(JSON.parse('{"__proto__":{"a":1},"x":0}'), JSON.parse('{"x":0,"__proto__":{"a":1}}')));
  assert.equal(jsonEqual({ a: 1 }, { b: 1 }), false);
  assert.equal(jsonEqual({ a: 1 }, { a: 1, b: null }), false);
});
test('array ordering, length and nesting matter', () => {
  assert.equal(jsonEqual([1, 2], [2, 1]), false);
  assert.equal(jsonEqual([1], [1, null]), false);
  assert.equal(jsonEqual({ items: [{ result: [0, false] }] }, { items: [{ result: [false, 0] }] }), false);
  assert.ok(jsonEqual([{ x: 1, y: 2 }], [{ y: 2, x: 1 }]));
});
test('null, zero, false, empty string, array and object remain distinct', () => {
  const values = [null, 0, false, '', [], {}];
  for (let a = 0; a < values.length; a++) {
    for (let b = 0; b < values.length; b++) assert.equal(jsonEqual(values[a], values[b]), a === b);
  }
});
test('strings compare exactly without case or whitespace changes', () => {
  assert.equal(jsonEqual('Tool', 'tool'), false);
  assert.equal(jsonEqual('ข้อความ', ' ข้อความ '), false);
  assert.ok(jsonEqual('<script>alert(1)</script>', '<script>alert(1)</script>'));
});
test('deep JSON equality walks iteratively and leaves original data unchanged', () => {
  let a = { value: 0 }; let b = { value: 0 };
  for (let index = 0; index < 20000; index++) { a = { nested: a }; b = { nested: b }; }
  assert.ok(jsonEqual(a, b));
  const values = [{ b: [0, false], a: null }, { a: null, b: [0, false] }];
  const before = structuredClone(values);
  assert.ok(jsonEqual(...values));
  assert.deepEqual(values, before);
});
test('field comparison requires explicit choices and compares duration rather than timestamps', () => {
  const a = success.spans[0];
  assert.ok(Object.values(compareSpanFields(a, undefined)).every(value => value === 'unselected'));
  const b = { ...a, id: 'different-id', started_at: '2026-10-13T10:00:00+07:00', ended_at: '2026-10-13T10:00:12+07:00', input: { version: '0.9.0' } };
  const result = compareSpanFields(a, b);
  assert.equal(result.duration, 'same');
  assert.equal(result.input, 'different');
  assert.equal(result.error, 'same');
  assert.equal(spanField(a, 'duration'), 12000);
  assert.equal(spanField(running.spans[0], 'duration'), null);
  assert.equal(spanField(a, 'input'), a.input);
});

test('missing step choices take precedence over unavailable duration', () => {
  const pending = running.spans[0];
  for (const [a, b] of [[undefined, undefined], [pending, undefined], [undefined, pending]]) {
    assert.ok(Object.values(compareSpanFields(a, b)).every(value => value === 'unselected'));
  }
});
test('two unfinished steps have unavailable duration, not same', () => {
  assert.equal(compareSpanFields(running.spans[0], running.spans[2]).duration, 'unavailable');
});
for (const side of ['A', 'B']) {
  test(`unfinished step on side ${side} makes duration unavailable`, () => {
    const pair = side === 'A' ? [running.spans[0], success.spans[0]] : [success.spans[0], running.spans[0]];
    assert.equal(compareSpanFields(...pair).duration, 'unavailable');
  });
}
test('finished steps with unequal durations remain different', () => {
  assert.equal(compareSpanFields(success.spans[0], success.spans[1]).duration, 'different');
});
test('two finished zero-duration steps remain same', () => {
  const a = { ...success.spans[0], ended_at: success.spans[0].started_at };
  const b = { ...success.spans[1], ended_at: success.spans[1].started_at };
  assert.equal(compareSpanFields(a, b).duration, 'same');
});
test('null payload fields still compare same while unfinished duration is unavailable', () => {
  const a = { ...running.spans[0], input: null, output: null, error: null };
  const b = { ...a, id: 'other' };
  const before = structuredClone([a, b]);
  const result = compareSpanFields(a, b);
  assert.equal(result.duration, 'unavailable');
  for (const field of ['input', 'output', 'error']) assert.equal(result[field], 'same');
  assert.ok(jsonEqual(null, null));
  assert.deepEqual([a, b], before);
});
