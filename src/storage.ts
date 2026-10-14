import type { Run } from './model.ts';
import { validateLog } from './validate.ts';

export const DATABASE_NAME = 'agent-debugger';
export const STORAGE_VERSION = 1;
const STORE = 'workspace';
const KEY = 'runs';
export interface StoredRun { run: Run; filename: string }
// shortcut: each write rewrites the ordered snapshot; use per-run records if large workspaces become slow.
interface Snapshot { storage_version: number; entries: StoredRun[] }

function validateSnapshot(value: unknown): Snapshot {
  if (value === undefined) return { storage_version: STORAGE_VERSION, entries: [] };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('ข้อมูล storage เสีย: ต้องเป็น object');
  const raw = value as Record<string, unknown>;
  if (raw.storage_version !== STORAGE_VERSION) throw new Error('ไม่รองรับ storage_version นี้; ไม่ได้ลบหรือเขียนทับข้อมูลเดิม');
  if (Object.keys(raw).length !== 2 || !Array.isArray(raw.entries)) throw new Error('ข้อมูล storage เสีย: entries ไม่ถูกต้อง');
  for (const entry of raw.entries) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)
      || Object.keys(entry).length !== 2 || !Object.hasOwn(entry, 'run')
      || typeof entry.filename !== 'string' || !entry.filename.trim()) throw new Error('ข้อมูล storage เสีย: ที่มาไม่ถูกต้อง');
  }
  validateLog({ schema_version: 1, runs: raw.entries.map(entry => entry.run) });
  return raw as unknown as Snapshot;
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = event => {
      // Only initialize a new database; never repair an unknown existing layout.
      if (event.oldVersion === 0) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error ?? new Error('เปิด IndexedDB ไม่ได้'));
    request.onblocked = () => { blocked = true; reject(new Error('IndexedDB ถูกแท็บอื่นขวางอยู่ ปิดแท็บนั้นแล้วลองใหม่')); };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      if (!db.objectStoreNames.contains(STORE)) { db.close(); reject(new Error('โครงสร้าง storage ไม่รองรับ; ไม่ได้แก้ข้อมูลเดิม')); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

/** Read and validate inside the same transaction as the write, including other tabs' data. */
async function transaction(update?: (entries: StoredRun[]) => StoredRun[], factory: IDBFactory = globalThis.indexedDB): Promise<StoredRun[]> {
  if (!factory) throw new Error('เบราว์เซอร์นี้ใช้ IndexedDB ไม่ได้');
  const db = await openDatabase(factory);
  try {
    return await new Promise<StoredRun[]>((resolve, reject) => {
      const tx = db.transaction(STORE, update ? 'readwrite' : 'readonly');
      let result: StoredRun[] = [];
      let failure: unknown;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('IndexedDB transaction ถูกยกเลิก'));
      tx.onerror = () => { failure ??= tx.error; };
      const store = tx.objectStore(STORE);
      const request = store.get(KEY);
      request.onsuccess = () => {
        try {
          const snapshot = validateSnapshot(request.result);
          result = update ? update(snapshot.entries) : snapshot.entries;
          if (update) {
            const next = validateSnapshot({ storage_version: STORAGE_VERSION, entries: result });
            store.put(next, KEY);
          }
        } catch (error) { failure = error; tx.abort(); }
      };
    });
  } finally { db.close(); }
}

export function restoreRuns(factory?: IDBFactory): Promise<StoredRun[]> {
  return transaction(undefined, factory);
}
export function saveRuns(incoming: StoredRun[], factory?: IDBFactory): Promise<StoredRun[]> {
  return transaction(existing => {
    const ids = new Set(existing.map(entry => entry.run.id));
    for (const entry of incoming) if (ids.has(entry.run.id)) throw new Error(`run ID ${JSON.stringify(entry.run.id)} มีอยู่ใน storage แล้ว; ไม่ได้เขียนทับ`);
    return [...existing, ...incoming];
  }, factory);
}
export function deleteSavedRun(id: string, factory?: IDBFactory): Promise<StoredRun[]> {
  return transaction(existing => existing.filter(entry => entry.run.id !== id), factory);
}
