export function fixture(count, shape = 'roots', id = `perf-${shape}-${count}`) {
  const start = '2026-10-19T00:00:00.000Z', end = '2026-10-19T00:00:01.000Z';
  return { schema_version: 1, runs: [{ id, name: `ทดสอบ ${count} spans · ${shape}`, agent_name: 'Local fixture', status: 'success', started_at: start, ended_at: end,
    spans: Array.from({ length: count }, (_, i) => ({ id: `s${i}`, parent_id: shape === 'chain' && i ? `s${i - 1}` : null, type: 'tool', name: `tool-${i % 20}`, status: 'success', started_at: start, ended_at: end, input: { query: `รายการ ${i}` }, output: { ok: true }, error: null })) }] };
}
