import { MAX_FILE_BYTES, previewImport } from './import.ts';
import type { ImportPreview } from './import.ts';

export async function inspectFile(file: File, ids: string[], signal: AbortSignal): Promise<ImportPreview> {
  if (!/\.json$/i.test(file.name)) throw new Error('เลือกไฟล์นามสกุล .json เท่านั้น');
  if (file.size > MAX_FILE_BYTES) throw new Error('ไฟล์เกิน 10 MiB ให้แบ่งไฟล์โดยรักษารันและ parent ให้ครบ');
  if (signal.aborted) throw new DOMException('ยกเลิกนำเข้า', 'AbortError');
  // Baseline: 10k spans exceeds 50 ms; keep small-file startup inexpensive.
  if (file.size < 512 * 1024 || typeof Worker === 'undefined') {
    const source = await file.text();
    if (signal.aborted) throw new DOMException('ยกเลิกนำเข้า', 'AbortError');
    return previewImport(source, ids);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
    const clean = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { clean(); reject(new DOMException('ยกเลิกนำเข้า', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => { clean(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.result); };
    worker.onerror = () => { clean(); reject(new Error('Worker ตรวจไฟล์ไม่สำเร็จ ลองเลือกไฟล์ใหม่หรือแบ่งไฟล์ให้เล็กลง')); };
    worker.postMessage({ file, ids });
  });
}
