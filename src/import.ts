import type { Run } from './model.ts';
import { ValidationError, validateLog } from './validate.ts';
import { adaptLog } from './adapters.ts';

export interface ImportPreview { runs: Run[]; format: string; warnings: string[]; spanCount: number }

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
type JsonFile = Pick<File, 'name' | 'size' | 'text'>;

const VALIDATION_HELP: Record<string, string> = {
  'expected object': 'ต้องเป็น object ใน JSON',
  'missing field; use null for absent data': 'ขาดฟิลด์ที่จำเป็น ให้ใส่ฟิลด์นี้; ข้อมูลที่ไม่มีใช้ null เฉพาะฟิลด์ที่ schema อนุญาต',
  'unknown field': 'ไม่รองรับฟิลด์นี้ใน schema v1 ให้นำออกหรือแปลงไฟล์ให้ตรงรูปแบบ',
  'expected non-empty string': 'ต้องเป็นข้อความที่ไม่ว่าง',
  'expected JSON value': 'ต้องเป็นค่า JSON ที่ถูกต้อง',
  'expected ISO 8601 string with timezone': 'ต้องเป็นเวลา ISO 8601 พร้อม timezone เช่น 2026-10-13T09:00:00+07:00',
  'expected YYYY-MM-DDTHH:mm:ss[.SSS]Z or ±HH:mm': 'ต้องใช้ YYYY-MM-DDTHH:mm:ss[.SSS]Z หรือ ±HH:mm พร้อม timezone',
  'invalid calendar date, time, or timezone': 'วันที่ เวลา หรือ timezone ไม่ถูกต้อง ตรวจวันจริง ชั่วโมง 00–23 และ offset ไม่เกิน ±14:00',
  'invalid timestamp': 'เวลาไม่ถูกต้อง ให้ใช้ ISO 8601 พร้อม timezone',
  'unknown status': 'status ต้องเป็น running, success, error หรือ cancelled',
  'running must have null end': 'งานที่ยังทำอยู่ต้องใช้ ended_at: null (ห้ามละฟิลด์)',
  'end precedes start': 'เวลาจบต้องไม่อยู่ก่อนเวลาเริ่ม',
  'step starts before its container': 'ขั้นตอนเริ่มก่อนรันหรือ parent ให้ตรวจ started_at ทั้งสองรายการ',
  'step exceeds finished container': 'ขั้นตอนต้องจบภายในเวลาจบของรันและ parent ที่จบแล้ว; ลูกที่ยัง running ต้องมี container ที่ยังไม่จบ',
  'only version 1 is supported': 'รองรับ schema_version: 1 เท่านั้น ต้องแปลงรูปแบบก่อนนำเข้า ไม่ใช่เปลี่ยนหมายเลขอย่างเดียว',
  'expected array': 'ต้องเป็น array ใน JSON',
  'duplicate run ID': 'run ID ซ้ำภายในไฟล์ ให้ใช้ ID ที่ไม่ซ้ำกัน',
  'unknown type': 'type ต้องเป็น agent, task, prompt, model หรือ tool',
  'error status requires an error; other statuses require null': 'status error ต้องมี error object ที่มี message; สถานะอื่นต้องใช้ error: null',
  'duplicate step ID within run': 'step ID ซ้ำภายในรัน ให้ใช้ ID ที่ไม่ซ้ำกันในรันเดียวกัน',
  'parent does not exist in this run': 'parent_id อ้างถึงขั้นตอนที่ไม่มีอยู่ ให้ใช้ ID ในรันเดียวกัน หรือ null สำหรับระดับบนสุด',
  'parent cycle detected': 'ความสัมพันธ์ parent_id วนกลับมาหาตัวเอง ให้แก้ parent จนเป็นโครงสร้างที่ไม่มีวงวน',
};

export function parseImport(source: string, existingRuns: readonly Run[]): Run[] {
  return previewImport(source, existingRuns.map(run => run.id)).runs;
}
export function previewImport(source: string, existingIds: readonly string[]): ImportPreview {
  let value: unknown;
  try { value = JSON.parse(source.replace(/^\uFEFF/, '')); }
  catch (error) {
    throw new Error(`JSON syntax ไม่ถูกต้อง ตรวจวงเล็บ เครื่องหมายคำพูดและ comma: ${error instanceof Error ? error.message : 'อ่าน JSON ไม่ได้'}`);
  }
  const adapted = adaptLog(value);
  let incoming: Run[];
  try { incoming = validateLog(adapted.value).runs; }
  catch (error) {
    if (error instanceof ValidationError) throw new Error(`${error.path}: ${VALIDATION_HELP[error.reason] ?? error.reason}`);
    throw new Error('ตรวจข้อมูลไม่ได้ โครงสร้างอาจซ้อนลึกเกินกว่าที่เบราว์เซอร์รองรับ ให้ลดความซ้อนของ payload แล้วลองใหม่');
  }
  const ids = new Set(existingIds);
  incoming.forEach((run, index) => {
    if (ids.has(run.id)) throw new Error(`runs[${index}].id: ID ${JSON.stringify(run.id)} มีอยู่ในรายการแล้ว ให้เปลี่ยน ID ของรันใหม่นี้; ไม่ได้นำเข้าและไม่ได้เขียนทับข้อมูลเดิม`);
  });
  return { runs: incoming, format: adapted.format, warnings: adapted.warnings, spanCount: incoming.reduce((count, run) => count + run.spans.length, 0) };
}

/** Only reads locally; caller commits the result after the entire file passes. */
export async function readImport(file: JsonFile, existingRuns: readonly Run[]): Promise<Run[]> {
  if (!/\.json$/i.test(file.name)) throw new Error('เลือกไฟล์นามสกุล .json เท่านั้น');
  if (file.size > MAX_FILE_BYTES) throw new Error('ไฟล์เกิน 10 MiB (10,485,760 bytes) ให้แบ่งเป็นไฟล์เล็กลงก่อนนำเข้า');
  let source: string;
  try { source = await file.text(); }
  catch { throw new Error('อ่านไฟล์ไม่ได้ ให้ตรวจว่าไฟล์ยังอยู่และเข้าถึงได้ แล้วเลือกไฟล์อีกครั้ง'); }
  return parseImport(source, existingRuns);
}
