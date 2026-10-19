import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { DATABASE_NAME, restoreRuns, saveRuns, deleteSavedRun } from '../src/storage.ts';

const run = JSON.parse(await readFile(new URL('../public/examples/success.json', import.meta.url), 'utf8')).runs[0];
const entries = [{ run, filename: 'original.json' }];
async function seed(factory, snapshot) {
  const db = await new Promise((resolve, reject) => { const r = factory.open(DATABASE_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore('workspace'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  await new Promise((resolve, reject) => { const tx = db.transaction('workspace', 'readwrite'); if (snapshot !== undefined) tx.objectStore('workspace').put(snapshot, 'runs'); tx.oncomplete = resolve; tx.onabort = reject; }); db.close();
}
async function inspect(factory) {
  const db = await new Promise((resolve,reject) => { const r=factory.open(DATABASE_NAME); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
  const result = { version: db.version, stores: [...db.objectStoreNames] };
  result.snapshot = await new Promise(resolve => { const tx=db.transaction('workspace'), r=tx.objectStore('workspace').get('runs'); tx.oncomplete=()=>resolve(r.result); }); db.close(); return result;
}
test('v1 migration atomically preserves complete runs, provenance and order across save/reload/delete', async () => {
  const factory = new IDBFactory(); const next = structuredClone(entries[0]); next.run.id='later';
  await seed(factory, { storage_version: 1, entries });
  assert.deepEqual(await restoreRuns(factory), entries);
  assert.equal((await inspect(factory)).version, 2);
  await saveRuns([next], factory); assert.deepEqual(await restoreRuns(factory), [...entries,next]);
  await deleteSavedRun(run.id, factory); assert.deepEqual(await restoreRuns(factory), [next]);
});
for (const [name, value] of [['future', {storage_version:8,entries}], ['missing entries',{storage_version:1,x:[]}], ['bad log',{storage_version:1,entries:[{...entries[0],run:{...run,spans:[{...run.spans[0],parent_id:'missing'}]}}]}], ['duplicate',{storage_version:1,entries:[...entries,...entries]}], ['unknown metadata',{storage_version:1,entries,extra:true}]]) test(`failed migration (${name}) preserves v1 version, store and exact snapshot`, async () => {
  const factory = new IDBFactory(); await seed(factory,value);
  await assert.rejects(restoreRuns(factory)); await assert.rejects(saveRuns(entries,factory)); await assert.rejects(deleteSavedRun(run.id,factory));
  assert.deepEqual(await inspect(factory), {version:1,stores:['workspace'],snapshot:value});
});
test('quota/abort halfway through migration rolls back DDL and source; later retry succeeds', async () => {
  const factory = new IDBFactory(), snapshot={storage_version:1,entries}; await seed(factory,snapshot);
  const original = IDBObjectStore.prototype.put;
  try { IDBObjectStore.prototype.put=function(...args){ const r=original.apply(this,args); if(this.name==='runs') r.addEventListener('success',()=>this.transaction.abort()); return r; }; await assert.rejects(restoreRuns(factory)); }
  finally { IDBObjectStore.prototype.put=original; }
  assert.deepEqual(await inspect(factory), {version:1,stores:['workspace'],snapshot});
  assert.deepEqual(await restoreRuns(factory), entries);
});
test('per-run write does not rewrite unrelated run payloads', async () => {
  const factory=new IDBFactory(); await saveRuns(entries,factory); const next=structuredClone(entries[0]);next.run.id='new';
  const original=IDBObjectStore.prototype.put, touched=[];
  try{ IDBObjectStore.prototype.put=function(value,...args){ if(this.name==='runs') touched.push(value.run.id); return original.call(this,value,...args); }; await saveRuns([next],factory); await deleteSavedRun(run.id,factory); }
  finally { IDBObjectStore.prototype.put=original; }
  assert.deepEqual(touched,['new']); assert.deepEqual(await restoreRuns(factory),[next]);
});
test('empty legacy database migrates without inventing runs',async()=>{const factory=new IDBFactory();await seed(factory,undefined);assert.deepEqual(await restoreRuns(factory),[]);});
