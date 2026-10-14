import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { spanDepths } from '../src/view.ts';

// Measures only the lookup/depth computation, excluding fixtures, validation and rendering.
console.log(`Node ${process.version} / ${process.platform} ${process.arch}; median of 21 calls after 5 warmups`);
console.log('shape,spans,median_ms,min_ms,max_ms');
for (const shape of ['roots', 'chain']) {
  for (const count of [1_000, 5_000, 10_000]) {
    const spans = Array.from({ length: count }, (_, index) => ({ id: String(index), parent_id: shape === 'roots' || index === 0 ? null : String(index - 1) }));
    if (shape === 'chain') spans.reverse();
    for (let index = 0; index < 5; index++) spanDepths(spans);
    const times = [];
    for (let index = 0; index < 21; index++) {
      const start = performance.now();
      const depths = spanDepths(spans);
      times.push(performance.now() - start);
      assert.equal(depths.size, count);
      assert.equal(depths.get(String(count - 1)), shape === 'roots' ? 0 : count - 1);
    }
    times.sort((a, b) => a - b);
    console.log([shape, count, times[10].toFixed(3), times[0].toFixed(3), times.at(-1).toFixed(3)].join(','));
  }
}
