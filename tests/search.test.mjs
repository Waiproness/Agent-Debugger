import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSpanSearch, EMPTY_FILTERS, filterSpanSearch } from '../src/search.ts';
import { recordedEnd, spanDepths } from '../src/view.ts';

const example = async name => JSON.parse(await readFile(new URL(`../public/examples/${name}.json`, import.meta.url), 'utf8')).runs[0];
const success = await example('success');
const error = await example('tool-error');
const parallel = await example('parallel-nested');
const find = (run, query, extra = {}) => filterSpanSearch(buildSpanSearch(run.spans), { ...EMPTY_FILTERS, query, ...extra });
const ids = spans => spans.map(span => span.id);

test('searches ID, name and type without case sensitivity and trims only query edges', () => {
  assert.deepEqual(ids(find(success, '  READ  ')), ['read']);
  assert.deepEqual(ids(find(success, 'CHANGELOG.md')), ['read']);
  assert.deepEqual(ids(find(success, 'MODEL')), ['compose']);
  assert.deepEqual(ids(find(success, 'COMPOSE SHORT')), ['compose']);
});
test('searches Thai and real input/output keys and scalar values', () => {
  assert.ok(ids(find(success, 'สรุปการเปลี่ยนแปลง')).includes('prompt'));
  assert.ok(ids(find(success, 'ปรับการค้นหา')).includes('root'));
  assert.deepEqual(ids(find(success, 'expected_points')), ['finish']);
  assert.deepEqual(ids(find(success, 'ADDED SEARCH HIGHLIGHTING')), ['read', 'compose']);
});
test('searches nested error messages, codes and details', () => {
  assert.deepEqual(ids(find(error, 'did not respond')), ['lookup']);
  assert.deepEqual(ids(find(error, 'retryable')), ['lookup']);
  assert.deepEqual(ids(find(error, 'ETIMEDOUT', { type: 'tool', status: 'error' })), ['lookup']);
});
test('empty and whitespace-only queries match all rows subject to status/type', () => {
  assert.deepEqual(find(success, ''), success.spans);
  assert.deepEqual(find(success, ' \t\n '), success.spans);
  assert.deepEqual(ids(find(error, ' ', { type: 'tool' })), ['lookup']);
});
test('0, false and empty string are preserved; null has no generated search text', () => {
  const span = { ...success.spans[0], id: 'scalar', name: 'payload', input: 0, output: false, error: null };
  const index = buildSpanSearch([span]);
  assert.equal(filterSpanSearch(index, { ...EMPTY_FILTERS, query: '0' }).length, 1);
  assert.equal(filterSpanSearch(index, { ...EMPTY_FILTERS, query: 'FALSE' }).length, 1);
  for (const query of ['ไม่มีข้อมูล', 'null', 'undefined']) assert.equal(filterSpanSearch(index, { ...EMPTY_FILTERS, query }).length, 0);
  const absent = { ...span, input: null, output: { empty: '', missing: null, array: [null] } };
  const absentIndex = buildSpanSearch([absent]);
  assert.equal(filterSpanSearch(absentIndex, { ...EMPTY_FILTERS, query: 'null' }).length, 0);
  assert.equal(filterSpanSearch(absentIndex, { ...EMPTY_FILTERS, query: '0' }).length, 0);
  assert.equal(filterSpanSearch(absentIndex, EMPTY_FILTERS)[0].output.empty, '');
  const literal = buildSpanSearch([{ ...span, input: 'ไม่มีข้อมูล null', output: null }]);
  assert.equal(filterSpanSearch(literal, { ...EMPTY_FILTERS, query: 'ไม่มีข้อมูล' }).length, 1);
  assert.equal(filterSpanSearch(literal, { ...EMPTY_FILTERS, query: 'null' }).length, 1);
});
test('regex-looking queries are literal substrings, not executable patterns', () => {
  const index = buildSpanSearch([{ ...success.spans[0], input: '[a.*] (demo) \\w+' }]);
  assert.equal(filterSpanSearch(index, { ...EMPTY_FILTERS, query: '[a.*]' }).length, 1);
  assert.equal(filterSpanSearch(index, { ...EMPTY_FILTERS, query: '^.*$' }).length, 0);
  assert.equal(filterSpanSearch(index, { ...EMPTY_FILTERS, query: '[' }).length, 1);
});
test('query, status and type combine with AND and support every v1 enum', () => {
  assert.deepEqual(ids(find(error, 'timeout', { status: 'error', type: 'tool' })), ['lookup']);
  assert.equal(find(error, 'timeout', { status: 'success', type: 'tool' }).length, 0);
  assert.equal(find(error, 'timeout', { status: 'error', type: 'prompt' }).length, 0);
  const cancelled = { ...success.spans[0], id: 'cancelled', status: 'cancelled' };
  assert.equal(filterSpanSearch(buildSpanSearch([cancelled]), { ...EMPTY_FILTERS, status: 'cancelled', type: 'agent' }).length, 1);
  assert.deepEqual(ids(find(parallel, '', { status: 'running', type: 'task' })), ['gather', 'benchmark']);
  for (const type of ['agent', 'task', 'prompt', 'model', 'tool']) assert.ok(find(success, '', { type }).length > 0);
});
test('no results and clearing filters keep the source objects and full run intact', () => {
  const before = structuredClone(success);
  const index = buildSpanSearch(success.spans);
  assert.deepEqual(filterSpanSearch(index, { query: 'does-not-exist', type: 'tool', status: 'error' }), []);
  const restored = filterSpanSearch(index, EMPTY_FILTERS);
  assert.deepEqual(restored, success.spans);
  assert.equal(restored[0], success.spans[0]);
  assert.deepEqual(success, before);
});
test('filtering out parents retains full-run depths and time bounds', () => {
  const before = structuredClone(parallel);
  const end = recordedEnd(parallel);
  const depths = spanDepths(parallel.spans);
  const visible = find(parallel, 'read_benchmark', { type: 'tool', status: 'running' });
  assert.deepEqual(ids(visible), ['read-benchmark']);
  assert.equal(depths.get(visible[0].id), 3);
  assert.equal(visible[0].parent_id, 'benchmark');
  assert.equal(recordedEnd(parallel), end);
  assert.deepEqual(parallel, before);
});
test('prepared search text is reused without revisiting payloads on subsequent filtering', () => {
  let reads = 0;
  const span = { ...success.spans[0], get input() { reads++; return { message: 'cached Thai ภาษาไทย' }; } };
  const index = buildSpanSearch([span]);
  assert.equal(reads, 1);
  for (const query of ['cached', 'ภาษาไทย', 'unknown', '']) filterSpanSearch(index, { ...EMPTY_FILTERS, query });
  assert.equal(reads, 1);
});
