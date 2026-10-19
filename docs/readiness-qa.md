# Readiness QA — 2026-10-19

Environment: Windows x64, Node v24.16.0; connected Brave/Chromium browser. No dependencies added. All data used for browser QA was generated locally or came from shipped examples. No deployment, commit or push.

## Checks run

- Original baseline: 120/120 Node tests.
- Final: **161/161 Node tests** passed, including existing tests, adapter, insights, matching/diff, redaction, worker cancellation/stale results, atomic migration/rollback, per-run writes, full workflow and 1,000/10,000-span deep-parent fixtures.
- `npm run typecheck` passed; `npm run build` passed (typecheck also runs inside build).
- `git diff --check` passed after removing an extra blank line at EOF.
- Production build opened successfully at `http://127.0.0.1:5174/`; shipped examples, Timeline/details and export preview worked.

## Browser workflow

`tests/browser.html` / `tests/browser-flow.mjs` ran against the disposable `http://localhost:5173` origin (separate from `127.0.0.1`). **13 checks passed**:

1. Preview reports 1,000 spans.
2. Cancel import preserves workspace.
3. Timeline DOM stays at 100 rows.
4. Payload search finds a span and opens its original data.
5. Comparison bounds options and accepts a structural suggestion.
6. Changed-only JSON diff shows paths.
7. Redacted preview omits the fixture secret.
8. Export produces valid re-importable v1 JSON.
9. Exported JSON passes the UI import preview and persists.
10. Export leaves original workspace payload intact.
11. Actual IndexedDB retains the exact original run.
12. Cancel delete preserves selection.
13. Confirm delete removes only the workflow's three fixture runs.

The harness dispatches a real browser File/DataTransfer change event and intercepts the download click to inspect the Blob. **These 13 checks simulate file selection/download. They do use the actual React UI and browser IndexedDB.** The generated fixture IDs are unique; the flow does not clear storage.

The two earlier baseline fixture runs were saved with the original v1 layout. Reloading after the storage change restored both runs through the real browser v2 migration (10,000 and 1,000 spans). An additional 10,000-deep fixture exercised the actual module Worker preview, confirmation/save, search for `รายการ 9999`, selection of s9999, clear filters, reveal selected and keyboard Home back to s0.

## Actual download

The production export clicked **ดาวน์โหลด JSON** with redaction enabled on the unmodified success example. The browser tool's download-event waiter timed out, but the file was created in Windows Downloads:

`agent-debugger-run-1792425103641.json` — **2,090 bytes, 1 run, 5 spans**.

Read those actual bytes from disk, passed them through `parseImport`, and asserted deep equality with every run/span/payload field in `public/examples/success.json`. Both validation and exact round trip passed. Re-import through the OS picker was not tested.

## Visual / interaction checks

- Desktop light and dark screenshots at 1440 px; small-screen dark and light at 375 × 812.
- Mobile document scrollWidth did not exceed viewport width (375 px). Panels stack; source IDs/timestamps/JSON wrap.
- Visible selected state, status text accompanying color, labels on filters/theme/pickers, focus ring on keyboard-selected rows.
- JSON expansion/copy controls visible; large-string display is capped initially.
- Native HTML dialogs contain preview/confirm/cancel controls; import and deletion cancellation were exercised by the workflow.
- Saved desktop screenshots: [light](readiness-light.jpg), [dark](readiness-dark.jpg). Mobile was visually checked in the browser tool; a saved mobile capture was discarded because its dimensions were inconsistent.

The browser session had intermittent debugger/screenshot timeouts; recovered by opening a fresh local tab. One full-page mobile capture failed and is not claimed as evidence. No browser paint or physical typing latency measurements are claimed.

## Performance

See raw [helper baseline](performance-before.json), [helper after](performance-after.json), and [Timeline HTML CPU comparison](performance-ui.json). Node medians use seven samples after two warmups.

| Workload | Before | After | Scope |
| --- | ---: | ---: | --- |
| 1,000-deep Timeline rows | 1,000 | 100 | Actual component HTML |
| 10,000-deep Timeline rows | 10,000 | 100 | Actual component HTML; browser count also checked |
| 1,000-deep Timeline HTML CPU median | 110.97 ms | 41.20 ms | React renderToString in Node |
| 10,000-deep Timeline HTML CPU median | 1,423.66 ms | 28.90 ms | React renderToString in Node |
| 10,000-deep parse/validate median | 71.64 ms | 65.06 ms | Node helper, excludes worker startup/transfer |
| 10,000-deep indexed search median | 0.38 ms | 0.38 ms | Node helper, no browser DOM |

HTML CPU timings compare original Git HEAD and working-copy Timeline source with the same installed dependencies. They include timeline depth/index work and HTML serialization, **not DOM/event/effect work, client rendering, layout or paint**. JIT/GC and machine load influence samples; no browser speedup ratio is inferred.

Before implementation, the dev-browser 10,000-deep import measured dispatch → first Timeline DOM at **1,917.5 ms (one sample)**, with 10,000 actual row buttons. The first attempt at a post-change DOM timer started on a bubbling click after React's commit and produced an invalid late observation (6,307.4 ms / one filtered row). That observation was discarded; the harness now starts in capture phase. No post-change browser DOM timing is claimed from that run, nor is DOM-ready called paint.

## Remaining limits

- OS file picker selection/cancel/same-file retry not verified: connected extension rejected file upload because file-URL access was disabled. No permissions were changed.
- Production download bytes verified; picker re-import remains unverified. Simulated import/export/re-import is covered separately.
- Screen reader, physical typing latency, browser paint, OS high-contrast/reduced-motion settings, browser engines other than the connected Chromium, private mode and crash/power-loss durability not verified.
- OTLP supports the documented strict subset only, including explicit OK/ERROR statuses and one complete root per trace. UNSET/default/missing data is rejected instead of guessed.
- Ten MiB import cap; no streaming. Saved workspace is still read/validated on each storage operation. Export/redaction/stringify remain on the main thread. Extremely deep/large payloads may exceed JSON/structuredClone limits.
- Redaction is rule-based and can miss secrets. Structural IDs/timestamps/statuses and field names are preserved. Inspect exported data before sharing it.
