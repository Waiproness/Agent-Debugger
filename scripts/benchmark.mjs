import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { parseImport } from '../src/import.ts';
import { buildSpanSearch, filterSpanSearch, EMPTY_FILTERS } from '../src/search.ts';
import { spanDepths } from '../src/view.ts';
import { fixture } from './fixture.mjs';
export { fixture } from './fixture.mjs';

if (process.argv[1]?.endsWith('benchmark.mjs')) {
  const rows = [];
  for (const count of [1000, 10000]) for (const shape of ['roots', 'chain']) {
    const doc = fixture(count, shape), source = JSON.stringify(doc);
    const measure = fn => { const samples = []; for (let i = 0; i < 9; i++) { const t = performance.now(); fn(); if (i > 1) samples.push(performance.now() - t); } return +samples.sort((a,b) => a-b)[3].toFixed(2); };
    const index = buildSpanSearch(doc.runs[0].spans);
    rows.push({ count, shape, bytes: Buffer.byteLength(source), parseValidateMs: measure(() => parseImport(source, [])), indexMs: measure(() => buildSpanSearch(doc.runs[0].spans)), searchMs: measure(() => filterSpanSearch(index, { ...EMPTY_FILTERS, query: 'รายการ 999' })), depthMs: measure(() => spanDepths(doc.runs[0].spans)) });
    if (process.argv.includes('--fixtures')) await writeFile(`docs/perf-${shape}-${count}.json`, source);
  }
  const result = { environment: `${process.version} ${process.platform} ${process.arch}`, method: 'Node helper medians, 7 samples after 2 warmups; excludes browser rendering/paint/storage', rows };
  console.log(JSON.stringify(result, null, 2));
  const output = process.argv.find(x => x.startsWith('--output='));
  if (output) await writeFile(output.slice(9), JSON.stringify(result, null, 2) + '\n');
}
