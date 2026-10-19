import type { Run } from './model.ts';
import { validateLog } from './validate.ts';

export const DATABASE_NAME = 'agent-debugger';
export const DATABASE_VERSION = 2;
export const STORAGE_VERSION = 2;
export interface StoredRun { run: Run; filename: string }
interface Metadata { storage_version: 2; ids: string[] }

function validateEntries(entries: unknown): asserts entries is StoredRun[] {
  if (!Array.isArray(entries)) throw new Error('ข้อมูล storage เสีย: entries ไม่ถูกต้อง');
  for (const entry of entries) if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length !== 2 || !Object.hasOwn(entry, 'run') || typeof entry.filename !== 'string' || !entry.filename.trim()) throw new Error('ข้อมูล storage เสีย: ที่มาไม่ถูกต้อง');
  validateLog({ schema_version: 1, runs: entries.map(entry => entry.run) });
}
function metadata(value: unknown): Metadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ข้อมูล storage เสีย: metadata ไม่ถูกต้อง');
  const raw = value as Record<string, unknown>;
  if (raw.storage_version !== STORAGE_VERSION || Object.keys(raw).length !== 2 || !Array.isArray(raw.ids) || raw.ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(raw.ids).size !== raw.ids.length) throw new Error('ไม่รองรับ storage version หรือ metadata เสีย; ไม่ได้ลบหรือเขียนทับข้อมูลเดิม');
  return raw as unknown as Metadata;
}
function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    let failure: unknown, blocked = false;
    request.onupgradeneeded = event => {
      const db = request.result, tx = request.transaction!;
      try {
        if (event.oldVersion === 0) {
          db.createObjectStore('runs', { keyPath: 'run.id' });
          db.createObjectStore('workspace').put({ storage_version: 2, ids: [] }, 'runs');
        } else {
          if (event.oldVersion !== 1 || db.objectStoreNames.length !== 1 || !db.objectStoreNames.contains('workspace')) throw new Error('โครงสร้าง storage เดิมไม่รองรับ migration');
          const legacy = tx.objectStore('workspace'), read = legacy.get('runs');
          const store = db.createObjectStore('runs', { keyPath: 'run.id' });
          read.onsuccess = () => {
            try {
              const snapshot = read.result;
              if (snapshot !== undefined && (!snapshot || typeof snapshot !== 'object' || snapshot.storage_version !== 1 || Object.keys(snapshot).length !== 2)) throw new Error('snapshot เดิมไม่รองรับหรือเสีย; migration ไม่ได้แก้ข้อมูลเดิม');
              const entries = snapshot === undefined ? [] : snapshot.entries;
              validateEntries(entries);
              for (const entry of entries) store.put(entry);
              legacy.put({ storage_version: 2, ids: entries.map(entry => entry.run.id) }, 'runs');
            } catch (error) { failure = error; tx.abort(); }
          };
        }
      } catch (error) { failure = error; tx.abort(); }
    };
    request.onerror = () => reject(failure ?? request.error ?? new Error('เปิด IndexedDB ไม่ได้'));
    request.onblocked = () => { blocked = true; reject(new Error('IndexedDB ถูกแท็บอื่นขวางอยู่ ปิดแท็บนั้นแล้วลองใหม่')); };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      if (db.objectStoreNames.length !== 2 || !db.objectStoreNames.contains('workspace') || !db.objectStoreNames.contains('runs')) { db.close(); reject(new Error('โครงสร้าง storage ไม่รองรับ; ไม่ได้แก้ข้อมูลเดิม')); return; }
      const layout = db.transaction(['workspace', 'runs']);
      if (layout.objectStore('runs').keyPath !== 'run.id' || layout.objectStore('workspace').keyPath !== null) { db.close(); reject(new Error('keyPath ของ storage ไม่รองรับ; ไม่ได้แก้ข้อมูลเดิม')); return; }
      db.onversionchange = () => db.close(); resolve(db);
    };
  });
}
async function transaction(change: { save: StoredRun[] } | { delete: string } | undefined, factory: IDBFactory = globalThis.indexedDB): Promise<StoredRun[]> {
  if (!factory) throw new Error('เบราว์เซอร์นี้ใช้ IndexedDB ไม่ได้');
  if (change && 'save' in change) validateEntries(change.save);
  const db = await openDatabase(factory);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['workspace', 'runs'], change ? 'readwrite' : 'readonly');
      let result: StoredRun[] = [], failure: unknown;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('IndexedDB transaction ถูกยกเลิก'));
      tx.onerror = () => { failure ??= tx.error; };
      const metaStore = tx.objectStore('workspace'), store = tx.objectStore('runs');
      const readMeta = metaStore.get('runs'), readRuns = store.getAll();
      let ready = 0;
      const loaded = () => {
        if (++ready !== 2) return;
        try {
          const meta = metadata(readMeta.result), records = readRuns.result;
          validateEntries(records);
          const byId = new Map(records.map(entry => [entry.run.id, entry]));
          if (byId.size !== meta.ids.length || meta.ids.some(id => !byId.has(id))) throw new Error('storage records และลำดับ ID ไม่ตรงกัน; ไม่ได้แก้ข้อมูล');
          result = meta.ids.map(id => byId.get(id)!);
          if (!change) return;
          if ('save' in change) {
            for (const entry of change.save) if (byId.has(entry.run.id)) throw new Error(`run ID ${JSON.stringify(entry.run.id)} มีอยู่ใน storage แล้ว; ไม่ได้เขียนทับ`);
            for (const entry of change.save) store.put(entry);
            result.push(...change.save);
          } else { store.delete(change.delete); result = result.filter(entry => entry.run.id !== change.delete); }
          metaStore.put({ storage_version: 2, ids: result.map(entry => entry.run.id) }, 'runs');
        } catch (error) { failure = error; tx.abort(); }
      };
      readMeta.onsuccess = loaded; readRuns.onsuccess = loaded;
    });
  } finally { db.close(); }
}
export function restoreRuns(factory?: IDBFactory) { return transaction(undefined, factory); }
export function saveRuns(incoming: StoredRun[], factory?: IDBFactory) { return transaction({ save: incoming }, factory); }
export function deleteSavedRun(id: string, factory?: IDBFactory) { return transaction({ delete: id }, factory); }
