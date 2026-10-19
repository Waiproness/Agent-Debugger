import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { DATABASE_NAME, STORAGE_VERSION, restoreRuns, saveRuns, deleteSavedRun } from '../src/storage.ts';
import { parseImport } from '../src/import.ts';

const documents = await Promise.all(['success', 'tool-error', 'parallel-nested'].map(async name =>
  JSON.parse(await readFile(new URL(`../public/examples/${name}.json`, import.meta.url), 'utf8'))));
const entries = documents.map((doc, index) => ({ run: doc.runs[0], filename: `source-${index}.json` }));
async function rawSnapshot(factory, value, write = false) {
  const db = await new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['workspace', 'runs'], write ? 'readwrite' : 'readonly');
      const store = tx.objectStore('workspace');
      const records = tx.objectStore('runs');
      let result;
      if (write) {
        records.clear();
        for (const entry of value.entries) records.put(entry);
        const { entries, ...meta } = value;
        store.put({ ...meta, ids: entries.map(entry => entry.run.id) }, 'runs');
        result = value;
      } else {
        const meta = store.get('runs'), all = records.getAll();
        let ready = 0;
        const loaded = () => { if (++ready === 2) { const { ids, ...data } = meta.result; const byId = new Map(all.result.map(entry => [entry.run.id, entry])); result = { ...data, entries: ids.map(id => byId.get(id)) }; } };
        meta.onsuccess = loaded; all.onsuccess = loaded;
      }
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

test('fresh storage restores empty; save/reopen preserves complete runs, source and insertion order', async () => {
  const factory = new IDBFactory();
  assert.deepEqual(await restoreRuns(factory), []);
  await saveRuns([entries[1], entries[0]], factory);
  await saveRuns([entries[2]], factory);
  assert.deepEqual(await restoreRuns(factory), [entries[1], entries[0], entries[2]]);
  assert.equal((await rawSnapshot(factory)).storage_version, STORAGE_VERSION);
  assert.equal((await rawSnapshot(factory)).entries[0].run.schema_version, undefined);
});
test('IDs restored from storage reject the whole incoming file and never overwrite stored runs', async () => {
  const factory = new IDBFactory();
  await saveRuns([entries[0]], factory);
  const restored = await restoreRuns(factory);
  assert.throws(() => parseImport(JSON.stringify({ schema_version: 1, runs: [entries[1].run, entries[0].run] }), restored.map(entry => entry.run)), /มีอยู่ในรายการแล้ว/);
  await assert.rejects(saveRuns([entries[1], entries[0]], factory), /มีอยู่ใน storage/);
  assert.deepEqual(await restoreRuns(factory), [entries[0]]);
});
test('a later invalid run aborts the entire batch; no partial save', async () => {
  const factory = new IDBFactory();
  await saveRuns([entries[0]], factory);
  const broken = structuredClone(entries[2]); broken.run.spans[0].parent_id = 'missing';
  await assert.rejects(saveRuns([entries[1], broken], factory), /parent/);
  assert.deepEqual(await restoreRuns(factory), [entries[0]]);
});
test('transaction success means commit, not put request success; abort/quota leaves memory and storage intact; retry works', async () => {
  const factory = new IDBFactory();
  await saveRuns([entries[0]], factory);
  const memory = structuredClone(entries.slice(1));
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
    await assert.rejects(saveRuns(memory, factory), /ยกเลิก/);
    assert.deepEqual(await restoreRuns(factory), [entries[0]]);
    IDBObjectStore.prototype.put = function () { throw new DOMException('disk full', 'QuotaExceededError'); };
    await assert.rejects(saveRuns(memory, factory), { name: 'QuotaExceededError' });
    assert.deepEqual(memory, entries.slice(1));
    assert.deepEqual(await restoreRuns(factory), [entries[0]]);
  } finally { IDBObjectStore.prototype.put = original; }
  await saveRuns(memory, factory);
  assert.deepEqual(await restoreRuns(factory), entries);
});
test('IndexedDB unavailable/open failure rejects without changing input; retry on available storage works', async () => {
  const original = globalThis.indexedDB;
  try {
    delete globalThis.indexedDB;
    await assert.rejects(restoreRuns(), /IndexedDB/);
    await assert.rejects(saveRuns(entries), /IndexedDB/);
  } finally { if (original !== undefined) globalThis.indexedDB = original; }
  await assert.rejects(saveRuns(entries, { open() { throw new DOMException('denied', 'SecurityError'); } }), { name: 'SecurityError' });
  const factory = new IDBFactory();
  await saveRuns(entries, factory);
  assert.deepEqual(await restoreRuns(factory), entries);
});
for (const [name, mutate] of [
  ['unsupported version', snapshot => { snapshot.storage_version = STORAGE_VERSION + 1; }],
  ['corrupt log', snapshot => { snapshot.entries[0].run.spans[0].parent_id = 'missing'; }],
  ['corrupt provenance', snapshot => { snapshot.entries[0].filename = null; }],
  ['duplicate stored IDs', snapshot => { snapshot.entries.push(structuredClone(snapshot.entries[0])); }],
  ['unknown metadata', snapshot => { snapshot.filters = {}; }],
]) {
  test(`${name}: restore, save and delete fail without clearing or overwriting original storage`, async () => {
    const factory = new IDBFactory();
    await saveRuns([entries[0]], factory);
    const snapshot = await rawSnapshot(factory); mutate(snapshot);
    await rawSnapshot(factory, snapshot, true);
    await assert.rejects(restoreRuns(factory));
    await assert.rejects(saveRuns([entries[1]], factory));
    await assert.rejects(deleteSavedRun(entries[0].run.id, factory));
    assert.deepEqual(await rawSnapshot(factory), snapshot);
  });
}
test('delete commits before returning; failed deletion keeps original storage', async () => {
  const factory = new IDBFactory();
  await saveRuns(entries, factory);
  const original = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function () { throw new Error('write denied'); };
    await assert.rejects(deleteSavedRun(entries[1].run.id, factory), /write denied/);
    assert.deepEqual(await restoreRuns(factory), entries);
  } finally { IDBObjectStore.prototype.put = original; }
  await deleteSavedRun(entries[1].run.id, factory);
  assert.deepEqual(await restoreRuns(factory), [entries[0], entries[2]]);
});
test('overlapping transactions read current data: saves and delete cannot resurrect an earlier snapshot', async () => {
  const factory = new IDBFactory();
  await saveRuns([entries[0]], factory);
  await Promise.all([saveRuns([entries[1]], factory), deleteSavedRun(entries[0].run.id, factory), saveRuns([entries[2]], factory)]);
  assert.deepEqual(await restoreRuns(factory), entries.slice(1));
});
test('concurrent duplicate saves allow one whole batch only', async () => {
  const factory = new IDBFactory();
  const results = await Promise.allSettled([saveRuns(entries, factory), saveRuns(entries, factory)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.deepEqual(await restoreRuns(factory), entries);
});
test('database version/layout not supported is preserved', async () => {
  for (const version of [1, 2]) {
    const factory = new IDBFactory();
    const db = await new Promise(resolve => {
      const request = factory.open(DATABASE_NAME, version);
      request.onupgradeneeded = () => request.result.createObjectStore('unknown');
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    await assert.rejects(restoreRuns(factory));
    await assert.rejects(saveRuns(entries, factory));
  }
});
