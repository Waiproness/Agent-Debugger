import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { fixture } from './fixture.mjs';

// CPU/HTML benchmark, not browser DOM, interaction latency, layout or paint.
await mkdir('.day8-qa', { recursive: true });
const before = execFileSync('git', ['show', 'HEAD:src/App.tsx'], { encoding: 'utf8' });
const after = await readFile('src/App.tsx', 'utf8');
const files = ['.day8-qa/before.tsx', '.day8-qa/after.tsx'];
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const rows = [];
try {
  for (const [version, source] of [['before', before], ['after', after]]) {
    const path = `.day8-qa/${version}.tsx`;
    await writeFile(path, source.replaceAll("from './", "from '../src/") + '\nexport { Timeline };\n');
    const { Timeline } = await server.ssrLoadModule(`/${path}`);
    for (const count of [1000, 10000]) {
      const run = fixture(count, 'chain').runs[0], samples = [];
      let html;
      for (let index = 0; index < 9; index++) {
        const start = performance.now();
        html = renderToString(React.createElement(Timeline, { run, selectedId: 's0', onSelect() {} }));
        if (index > 1) samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      const domRows = (html.match(/class="span-row /g) ?? []).length;
      assert.equal(domRows, version === 'before' ? count : 100);
      rows.push({ version, spans: count, rows: domRows, medianMs: +samples[3].toFixed(2), minMs: +samples[0].toFixed(2), maxMs: +samples.at(-1).toFixed(2), htmlBytes: Buffer.byteLength(html) });
    }
  }
  const result = { environment: `${process.version} ${process.platform} ${process.arch}`, method: 'React renderToString of real Timeline, 7 samples after 2 warmups; compares Git HEAD source and working copy with same dependencies. Includes validation-free timeline depth/search index and HTML serialization. Excludes DOM, events/effects, storage, browser layout/paint; not client render timing.', rows };
  await writeFile('docs/performance-ui.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await server.close(); await Promise.all(files.map(path => unlink(path).catch(() => {}))); }
