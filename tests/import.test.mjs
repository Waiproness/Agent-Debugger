import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MAX_FILE_BYTES, parseImport, readImport } from '../src/import.ts';
import { ValidationError, validateLog } from '../src/validate.ts';

const examples = await Promise.all(['success', 'tool-error', 'parallel-nested'].map(async name => ({
  name, source: await readFile(new URL(`../public/examples/${name}.json`, import.meta.url), 'utf8'),
})));
const sample = JSON.parse(examples[0].source);
const file = (source, name = 'trace.json') => new File([source], name, { type: 'application/json' });

test('imports all original Day 1 files sequentially into one workspace', async () => {
  const runs = [];
  for (const example of examples) runs.push(...await readImport(file(example.source, `${example.name}.json`), runs));
  assert.equal(runs.length, 3);
  assert.deepEqual(runs.map(run => run.status), ['success', 'error', 'running']);
  assert.equal(runs[2].ended_at, null);
  assert.equal(runs[2].spans.find(span => span.id === 'read-benchmark').ended_at, null);
});
test('size limit is exactly 10 MiB, and oversized files are rejected before reading', async () => {
  let reads = 0;
  const text = async () => { reads++; return examples[0].source; };
  assert.equal((await readImport({ name: 'trace.json', size: MAX_FILE_BYTES, text }, [])).length, 1);
  assert.equal(reads, 1);
  await assert.rejects(readImport({ name: 'trace.json', size: MAX_FILE_BYTES + 1, text }, []), /เกิน 10 MiB/);
  assert.equal(reads, 1);
});
test('non-json extension is rejected before reading; uppercase JSON is accepted regardless of MIME', async () => {
  await assert.rejects(readImport({ name: 'trace.txt', size: 1, text: () => { throw new Error('must not read'); } }, []), /นามสกุล .json/);
  assert.equal((await readImport(new File([examples[0].source], 'TRACE.JSON', { type: '' }), [])).length, 1);
});
test('file read errors are actionable and do not change existing runs', async () => {
  const existing = structuredClone(sample.runs);
  const before = structuredClone(existing);
  await assert.rejects(readImport({ name: 'trace.json', size: 100, text: async () => { throw new Error('access denied'); } }, existing), /อ่านไฟล์ไม่ได้/);
  assert.deepEqual(existing, before);
});
test('UTF-8 BOM, empty arrays and runs without spans keep their valid v1 meaning', () => {
  assert.equal(parseImport(`\uFEFF${examples[0].source}`, []).length, 1);
  assert.deepEqual(parseImport('{"schema_version":1,"runs":[]}', sample.runs), []);
  const document = structuredClone(sample); document.runs[0].spans = [];
  assert.equal(parseImport(JSON.stringify(document), [])[0].spans.length, 0);
});
test('duplicate with any existing run rejects the whole incoming batch without mutation', async () => {
  const existing = JSON.parse(examples[1].source).runs;
  const before = structuredClone(existing);
  const document = { schema_version: 1, runs: [sample.runs[0], existing[0]] };
  await assert.rejects(readImport(file(JSON.stringify(document)), existing), /runs\[1\].id.*มีอยู่ในรายการแล้ว/);
  assert.deepEqual(existing, before);
});
test('data in strings remains literal text, including HTML and code-like content', () => {
  const document = structuredClone(sample);
  const value = '<img src=x onerror="throw new Error(1)"><script>alert(1)</script>';
  document.runs[0].name = value;
  document.runs[0].spans[0].input = value;
  document.runs[0].spans[0].output = 0;
  const imported = parseImport(JSON.stringify(document), []);
  assert.equal(imported[0].name, value);
  assert.equal(imported[0].spans[0].input, value);
  assert.equal(imported[0].spans[0].output, 0);
});
const invalidCases = [
  ['JSON syntax', () => '{"schema_version":1,}', /JSON syntax.*comma/],
  ['unsupported version', doc => { doc.schema_version = 2; }, /schema_version.*รองรับ schema_version: 1/],
  ['missing required field', doc => { delete doc.runs[0].agent_name; }, /runs\[0\].agent_name.*ขาดฟิลด์/],
  ['unknown type', doc => { doc.runs[0].spans[2].type = 'http'; }, /spans\[2\].type.*agent, task, prompt, model.*tool/],
  ['unknown status', doc => { doc.runs[0].spans[2].status = 'done'; }, /spans\[2\].status.*running, success, error.*cancelled/],
  ['duplicate run ID in file', doc => { doc.runs.push(structuredClone(doc.runs[0])); }, /runs\[1\].id.*ซ้ำภายในไฟล์/],
  ['duplicate span ID in run', doc => { doc.runs[0].spans[2].id = 'root'; }, /spans\[2\].id.*ซ้ำภายในรัน/],
  ['missing parent', doc => { doc.runs[0].spans[2].parent_id = 'missing'; }, /runs\[0\].spans\[2\].parent_id.*ไม่มีอยู่/],
  ['self-parent cycle', doc => { doc.runs[0].spans[2].parent_id = 'read'; }, /spans\[2\].parent_id.*วน/],
  ['two-node cycle', doc => { doc.runs[0].spans[0].parent_id = 'prompt'; }, /parent_id.*วน/],
  ['end before start', doc => { doc.runs[0].spans[2].ended_at = doc.runs[0].started_at; }, /spans\[2\].ended_at.*ก่อนเวลาเริ่ม/],
  ['impossible date', doc => { doc.runs[0].started_at = '2026-02-30T09:00:00Z'; }, /started_at.*วันที่/],
  ['missing timezone', doc => { doc.runs[0].started_at = '2026-10-13T09:00:00'; }, /started_at.*timezone/],
  ['missing running end field', doc => { const run = doc.runs[0]; run.status = 'running'; delete run.ended_at; }, /ended_at.*ขาดฟิลด์/],
];
for (const [name, mutate, expected] of invalidCases) {
  test(`failed import preserves existing data: ${name}`, async () => {
    const document = structuredClone(sample);
    const result = mutate(document);
    const source = typeof result === 'string' ? result : JSON.stringify(document);
    const existing = JSON.parse(examples[2].source).runs;
    const before = structuredClone(existing);
    await assert.rejects(readImport(file(source), existing), expected);
    assert.deepEqual(existing, before);
  });
}
test('invalid later run rejects whole file rather than returning earlier valid runs', () => {
  const document = structuredClone(sample); document.runs.push({ id: 'invalid' });
  assert.throws(() => parseImport(JSON.stringify(document), []), /runs\[1\].name/);
});
test('validator keeps machine-readable field paths while preserving Day 1 messages', () => {
  const document = structuredClone(sample); document.runs[0].spans[2].parent_id = 'missing';
  assert.throws(() => validateLog(document), error => error instanceof ValidationError
    && error.path === 'runs[0].spans[2].parent_id' && error.reason === 'parent does not exist in this run');
});
