import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareExport, downloadExport } from '../src/export.ts';
import { MAX_FILE_BYTES, parseImport } from '../src/import.ts';
import { validateLog } from '../src/validate.ts';
import { buildSpanSearch, filterSpanSearch, EMPTY_FILTERS } from '../src/search.ts';
const document = JSON.parse(await readFile(new URL('../public/examples/success.json', import.meta.url), 'utf8'));

test('export validates and round-trips complete runs and literal payload without metadata, even with active filters', async () => {
  const run = structuredClone(document.runs[0]);
  run.spans[0].input = [null, 0, false, '', [], {}, { html: '<script>literal</script>', text: ' ไทย ' }];
  run.spans[0].output = false;
  const before = structuredClone(run);
  const index = buildSpanSearch(run.spans);
  assert.equal(filterSpanSearch(index, { ...EMPTY_FILTERS, query: 'does-not-exist' }).length, 0);
  const { blob, exceedsImportLimit } = prepareExport([run]);
  const result = validateLog(JSON.parse(await blob.text()));
  assert.deepEqual(result, { schema_version: 1, runs: [before] });
  assert.deepEqual(run, before);
  assert.equal(result.runs[0].spans.length, document.runs[0].spans.length);
  assert.equal(exceedsImportLimit, false);
  assert.deepEqual(parseImport(await blob.text(), []), [before]);
  assert.throws(() => parseImport(JSON.stringify(result), [run]), /มีอยู่ในรายการแล้ว/);
});
test('export all includes samples and imported runs without sources or storage version', async () => {
  const other = structuredClone(document.runs[0]); other.id = 'other';
  assert.deepEqual(JSON.parse(await prepareExport([document.runs[0], other]).blob.text()), { schema_version: 1, runs: [document.runs[0], other] });
});
test('export refuses invalid data/duplicate IDs before downloading', () => {
  const invalid = structuredClone(document.runs[0]); invalid.spans[0].input = undefined;
  assert.throws(() => prepareExport([invalid]), /JSON/);
  assert.throws(() => prepareExport([document.runs[0], document.runs[0]]), /duplicate run/);
});
test('export warns using actual UTF-8 Blob bytes when exceeding 10 MiB', () => {
  const run = structuredClone(document.runs[0]); run.spans[0].output = 'ก'.repeat(Math.ceil(MAX_FILE_BYTES / 3));
  const result = prepareExport([run]);
  assert.ok(result.blob.size > MAX_FILE_BYTES);
  assert.equal(result.exceedsImportLimit, true);
});
test('export size warning uses strictly greater than 10 MiB, including the envelope', () => {
  const run = structuredClone(document.runs[0]); run.spans[0].output = '';
  const overhead = prepareExport([run]).blob.size;
  run.spans[0].output = 'x'.repeat(MAX_FILE_BYTES - overhead);
  assert.equal(prepareExport([run]).blob.size, MAX_FILE_BYTES);
  assert.equal(prepareExport([run]).exceedsImportLimit, false);
  run.spans[0].output += 'x';
  assert.equal(prepareExport([run]).exceedsImportLimit, true);
});
test('download uses a fixed safe filename, removes anchor and eventually revokes object URL (also on click failure)', t => {
  const actions = [];
  const anchor = { click() { actions.push('click'); }, remove() { actions.push('remove'); } };
  t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(URL, 'revokeObjectURL', url => actions.push(url));
  t.mock.method(globalThis, 'setTimeout', callback => { callback(); });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => anchor, body: { append() { actions.push('append'); } } };
  try {
    downloadExport(new Blob(['{}']), 'run');
    assert.match(anchor.download, /^agent-debugger-run-\d+\.json$/);
    assert.equal(anchor.href, 'blob:test');
    assert.deepEqual(actions, ['append', 'click', 'remove', 'blob:test']);
    actions.length = 0;
    anchor.click = () => { throw new Error('blocked'); };
    assert.throws(() => downloadExport(new Blob(), 'workspace'), /blocked/);
    assert.deepEqual(actions, ['append', 'remove', 'blob:test']);
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});
