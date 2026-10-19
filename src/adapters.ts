import { SPAN_TYPES } from './model.ts';
import type { JsonValue, Run, Span } from './model.ts';

export interface AdaptedLog { value: unknown; format: string; warnings: string[] }
type ObjectValue = Record<string, unknown>;
function object(value: unknown, path: string): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: ต้องเป็น object`);
  return value as ObjectValue;
}
function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path}: ต้องเป็น array`);
  return value;
}
function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path}: ต้องมีข้อความที่ไม่ว่าง`);
  return value;
}
function hex(value: unknown, length: number, path: string): string {
  if (typeof value !== 'string' || !new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value) || /^0+$/.test(value)) throw new Error(`${path}: ต้องเป็น hex ID ${length} หลักที่ไม่ใช่ศูนย์ทั้งหมด`);
  return value.toLowerCase();
}
function nano(value: unknown, path: string, warnings: Set<string>): { time: string; ns: bigint } {
  if (!(typeof value === 'string' && /^\d+$/.test(value)) && !(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)) throw new Error(`${path}: ต้องมี Unix nanoseconds แบบ decimal string หรือ safe integer`);
  const ns = BigInt(value as string | number), ms = ns / 1_000_000n;
  if (ns === 0n) throw new Error(`${path}: เวลาเป็นศูนย์ซึ่งอาจเป็นค่า default ที่ไม่ได้บันทึก ต้องมีเวลาที่ชัดเจนก่อนนำเข้า`);
  if (ms > 253402300799999n) throw new Error(`${path}: เวลาเกินขอบเขตปี 9999 ของ schema v1`);
  if (ns % 1_000_000n) warnings.add('เวลา nanoseconds ถูกลดความละเอียดลงเป็น milliseconds ตาม schema v1 (ปัดเศษลง)');
  return { time: new Date(Number(ms)).toISOString(), ns };
}
function anyValue(value: unknown, path: string, depth = 0): JsonValue {
  if (depth > 100) throw new Error(`${path}: AnyValue ซ้อนลึกเกิน 100 ชั้น`);
  const raw = object(value, path), keys = Object.keys(raw);
  if (keys.length !== 1) throw new Error(`${path}: AnyValue ต้องมีค่าชนิดเดียว`);
  const key = keys[0], item = raw[key];
  if (key === 'stringValue' && typeof item === 'string') return item;
  if (key === 'boolValue' && typeof item === 'boolean') return item;
  if (key === 'doubleValue' && typeof item === 'number' && Number.isFinite(item)) return item;
  if (key === 'intValue' && ((typeof item === 'string' && /^-?\d+$/.test(item)) || (typeof item === 'number' && Number.isSafeInteger(item)))) return item;
  if (key === 'arrayValue') return array(object(item, path).values ?? [], path).map(v => anyValue(v, path, depth + 1));
  if (key === 'kvlistValue') {
    const pairs = array(object(item, path).values ?? [], path).map(v => { const pair = object(v, path); return [text(pair.key, path), anyValue(pair.value, path, depth + 1)] as const; });
    if (new Set(pairs.map(([key]) => key)).size !== pairs.length) throw new Error(`${path}: key ใน kvlistValue ซ้ำ แปลงเป็น JSON object โดยไม่เสียข้อมูลไม่ได้`);
    return Object.fromEntries(pairs);
  }
  throw new Error(`${path}: ไม่รองรับ AnyValue ชนิด ${key}`);
}
function attributes(value: unknown, path: string): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const item of array(value ?? [], path)) { const pair = object(item, path); const key = text(pair.key, path); if (result.has(key)) throw new Error(`${path}: attribute ${key} ซ้ำ`); result.set(key, pair.value); }
  return result;
}

/** Deliberately strict subset: complete single-root traces, explicit OK/ERROR statuses. */
export function adaptLog(value: unknown): AdaptedLog {
  const top = object(value, 'log');
  if (Object.hasOwn(top, 'schema_version') || !Object.hasOwn(top, 'resourceSpans')) return { value, format: 'Agent Debugger v1', warnings: [] };
  const warnings = new Set<string>(['OTLP subset: ต้องมี root เดียวต่อ trace และ parent ครบทุกตัว; ไม่รองรับ status UNSET หรือ span ที่ไม่มีเวลาจบ', 'ใช้ชนิด task สำหรับ OTLP span ที่ไม่ระบุ agent_debugger.type; input/output เป็น null หากไม่มี attributes agent_debugger.input/output', 'metadata, attributes อื่น, events, links และ resource ไม่อยู่ใน schema v1 จึงไม่ถูกส่งออก; เก็บไฟล์ต้นฉบับไว้']);
  const groups = new Map<string, { spans: Span[]; services: Map<string, string> }>();
  for (const [ri, item] of array(top.resourceSpans, 'resourceSpans').entries()) {
    const resource = object(item, `resourceSpans[${ri}]`);
    const resourceAttrs = attributes(resource.resource ? object(resource.resource, 'resource').attributes : [], 'resource.attributes');
    const serviceValue = resourceAttrs.get('service.name');
    const service = serviceValue ? anyValue(serviceValue, 'service.name') : null;
    if (service !== null && typeof service !== 'string') throw new Error('service.name ต้องเป็น stringValue');
    for (const scopeItem of array(resource.scopeSpans, 'scopeSpans')) {
      const scope = object(scopeItem, 'scopeSpans');
      for (const [si, item] of array(scope.spans, 'spans').entries()) {
        const path = `resourceSpans[${ri}].spans[${si}]`, raw = object(item, path);
        const traceId = hex(raw.traceId, 32, `${path}.traceId`), id = hex(raw.spanId, 16, `${path}.spanId`);
        const parent = raw.parentSpanId === undefined || raw.parentSpanId === '' || raw.parentSpanId === '0000000000000000' ? null : hex(raw.parentSpanId, 16, `${path}.parentSpanId`);
        const start = nano(raw.startTimeUnixNano, `${path}.startTimeUnixNano`, warnings), end = nano(raw.endTimeUnixNano, `${path}.endTimeUnixNano`, warnings);
        if (end.ns < start.ns) throw new Error(`${path}: เวลาจบก่อนเวลาเริ่ม`);
        const status = raw.status ? object(raw.status, `${path}.status`) : {};
        if (status.code !== 1 && status.code !== 2) throw new Error(`${path}.status.code: schema v1 แทน OTLP UNSET ไม่ได้ ต้องมีสถานะ OK (1) หรือ ERROR (2) ที่บันทึกจริง; ไม่ได้เดาสถานะให้`);
        const attrs = attributes(raw.attributes, `${path}.attributes`);
        const type = attrs.has('agent_debugger.type') ? anyValue(attrs.get('agent_debugger.type'), `${path}.type`) : 'task';
        if (!SPAN_TYPES.includes(type as Span['type'])) throw new Error(`${path}: agent_debugger.type ไม่อยู่ใน schema v1`);
        const span: Span = { id, parent_id: parent, type: type as Span['type'], name: text(raw.name, `${path}.name`), status: status.code === 1 ? 'success' : 'error', started_at: start.time, ended_at: end.time,
          input: attrs.has('agent_debugger.input') ? anyValue(attrs.get('agent_debugger.input'), `${path}.input`) : null,
          output: attrs.has('agent_debugger.output') ? anyValue(attrs.get('agent_debugger.output'), `${path}.output`) : null,
          error: status.code === 2 ? { message: typeof status.message === 'string' && status.message.trim() ? status.message : 'OTLP STATUS_CODE_ERROR', code: 'STATUS_CODE_ERROR' } : null };
        if (span.error?.message === 'OTLP STATUS_CODE_ERROR') warnings.add('บาง error ไม่มี message ต้นทาง จึงแสดงชื่อรหัส STATUS_CODE_ERROR แทนคำอธิบาย');
        const group = groups.get(traceId) ?? { spans: [], services: new Map<string, string>() };
        group.spans.push(span); group.services.set(id, service || 'OTLP (ไม่ระบุ service.name)'); groups.set(traceId, group);
      }
    }
  }
  const runs: Run[] = [];
  for (const [id, group] of groups) {
    const roots = group.spans.filter(span => span.parent_id === null);
    if (roots.length !== 1) throw new Error(`trace ${id}: ต้องมี root เดียวที่บันทึกเวลารันและสถานะไว้จริง พบ ${roots.length}; ไม่ได้สร้าง root หรือแก้ parent ให้`);
    const root = roots[0];
    runs.push({ id, name: root.name, agent_name: group.services.get(root.id)!, status: root.status, started_at: root.started_at, ended_at: root.ended_at, spans: group.spans });
  }
  return { value: { schema_version: 1, runs }, format: 'OpenTelemetry OTLP JSON', warnings: [...warnings] };
}
