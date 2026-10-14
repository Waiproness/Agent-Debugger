import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateLog, timestamp } from '../src/validate.ts';
import { STATUSES, SPAN_TYPES } from '../src/model.ts';
import { displayValue, duration, recordedEnd, spanDepths } from '../src/view.ts';

const example = async name => JSON.parse(await readFile(new URL(`../public/examples/${name}.json`, import.meta.url), 'utf8'));
const success = await example('success');
const failure = await example('tool-error');
const parallel = await example('parallel-nested');

test('all three shipped documents and their merged dataset validate', () => {
  for (const document of [success, failure, parallel]) assert.equal(validateLog(document), document);
  assert.equal(validateLog({ schema_version: 1, runs: [success, failure, parallel].flatMap(doc => doc.runs) }).runs.length, 3);
});
test('empty datasets and runs without spans are valid empty states', () => {
  assert.deepEqual(validateLog({ schema_version: 1, runs: [] }).runs, []);
  const document = structuredClone(success); document.runs[0].spans = [];
  assert.equal(validateLog(document).runs[0].spans.length, 0);
});
test('nested parallel work is valid with parents listed after children', () => {
  const document = structuredClone(parallel); document.runs[0].spans.reverse();
  assert.equal(validateLog(document).runs[0].status, 'running');
  const run = parallel.runs[0];
  assert.equal(spanDepths(run.spans).get('read-benchmark'), 3);
  assert.equal(recordedEnd(run) - Date.parse(run.started_at), 6000);
});
test('run duration is wall clock rather than sum of overlapping spans', () => {
  const run = success.runs[0];
  const sum = run.spans.reduce((total, span) => total + Date.parse(span.ended_at) - Date.parse(span.started_at), 0);
  assert.ok(sum > 12000);
  assert.equal(duration(run.started_at, run.ended_at), '12 s');
  assert.equal(duration(parallel.runs[0].started_at, null), 'ยังไม่จบ');
});
test('missing data, zero, empty string and false remain distinct', () => {
  assert.equal(displayValue(null), 'ไม่มีข้อมูล (null)');
  assert.equal(displayValue(0), '0');
  assert.equal(displayValue(''), '""');
  assert.equal(displayValue(false), 'false');
  const document = structuredClone(success);
  Object.assign(document.runs[0].spans[0], { input: 0, output: '' });
  assert.equal(validateLog(document).runs[0].spans[0].output, '');
});
test('zero length spans and timestamps in different offsets are allowed', () => {
  const document = structuredClone(success);
  const span = document.runs[0].spans[1]; span.ended_at = span.started_at;
  assert.equal(validateLog(document).runs[0].spans[1].ended_at, span.started_at);
  assert.equal(timestamp('2026-10-13T09:00:00+07:00', 'time'), timestamp('2026-10-13T02:00:00Z', 'time'));
  assert.ok(Number.isFinite(timestamp('2024-02-29T12:30:00.125-05:00', 'time')));
});

const invalidCases = [
  ['unsupported schema', doc => { doc.schema_version = 2; }, /only version 1/],
  ['duplicate run IDs', doc => { doc.runs.push(structuredClone(doc.runs[0])); }, /duplicate run ID/],
  ['duplicate span IDs', doc => { doc.runs[0].spans.push(structuredClone(doc.runs[0].spans[0])); }, /duplicate step ID/],
  ['missing parent', doc => { doc.runs[0].spans[1].parent_id = 'missing'; }, /parent does not exist/],
  ['self parent', doc => { doc.runs[0].spans[0].parent_id = 'root'; }, /cycle/],
  ['two-node cycle', doc => { doc.runs[0].spans[0].parent_id = 'prompt'; }, /cycle/],
  ['unknown type', doc => { doc.runs[0].spans[1].type = 'http'; }, /unknown type/],
  ['unknown status', doc => { doc.runs[0].status = 'done'; }, /unknown status/],
  ['missing input', doc => { delete doc.runs[0].spans[0].input; }, /missing field/],
  ['unexpected SDK field', doc => { doc.runs[0].sdk_data = {}; }, /unknown field/],
  ['terminal run without end', doc => { doc.runs[0].ended_at = null; }, /ISO 8601/],
  ['running step with an end', doc => { doc.runs[0].spans[1].status = 'running'; }, /running must have null end/],
  ['unfinished step in finished run', doc => { Object.assign(doc.runs[0].spans[1], { status: 'running', ended_at: null }); }, /finished container/],
  ['step before run', doc => { doc.runs[0].spans[1].started_at = '2026-10-13T08:59:59+07:00'; }, /before its container/],
  ['step beyond run', doc => { doc.runs[0].spans[4].ended_at = '2026-10-13T09:00:13+07:00'; }, /finished container/],
  ['step before parent', doc => { doc.runs[0].spans[1].parent_id = 'read'; }, /before its container/],
  ['step beyond parent', doc => { doc.runs[0].spans[4].parent_id = 'compose'; }, /finished container/],
  ['end before start', doc => { doc.runs[0].spans[1].ended_at = '2026-10-13T08:59:59+07:00'; }, /end precedes start/],
  ['error without message object', doc => { doc.runs[0].spans[1].status = 'error'; }, /error status requires/],
  ['error attached to success', doc => { doc.runs[0].spans[1].error = { message: 'Oops' }; }, /other statuses require null/],
  ['empty error message', doc => { Object.assign(doc.runs[0].spans[1], { status: 'error', error: { message: '' } }); }, /non-empty string/],
  ['non-JSON payload', doc => { doc.runs[0].spans[1].input = undefined; }, /JSON value/],
  ['infinite payload', doc => { doc.runs[0].spans[1].input = Infinity; }, /JSON value/],
];
for (const [name, mutate, expected] of invalidCases) {
  test(`rejects ${name}`, () => { const document = structuredClone(success); mutate(document); assert.throws(() => validateLog(document), expected); });
}
for (const value of ['2026-10-13T09:00:00', '2026-02-30T09:00:00Z', '2025-02-29T09:00:00Z', '2026-13-01T09:00:00Z', '2026-10-13T24:00:00Z', '2026-10-13T09:60:00Z', '2026-10-13T09:00:60Z', '2026-10-13T09:00:00+14:01', '2026-10-13T09:00:00+15:00', 'not a date']) {
  test(`rejects invalid timestamp ${value}`, () => assert.throws(() => timestamp(value, 'time')));
}
test('cancelled is a terminal status with no span error', () => {
  const document = structuredClone(success); document.runs[0].status = 'cancelled'; document.runs[0].spans[4].status = 'cancelled';
  assert.equal(validateLog(document).runs[0].status, 'cancelled');
});
test('formal schema and TypeScript agree on version, enums and required fields', async () => {
  const schema = JSON.parse(await readFile(new URL('../schema/agent-log-v1.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.properties.schema_version.const, 1);
  assert.deepEqual(schema.$defs.status.enum, [...STATUSES]);
  assert.deepEqual(schema.$defs.span.properties.type.enum, [...SPAN_TYPES]);
  assert.deepEqual(Object.keys(success.runs[0]).sort(), [...schema.$defs.run.required].sort());
  assert.deepEqual(Object.keys(success.runs[0].spans[0]).sort(), [...schema.$defs.span.required].sort());
});
