import { SPAN_TYPES, STATUSES } from './model.ts';
import type { JsonValue, LogDocument, Run, Span } from './model.ts';

export class ValidationError extends Error {
  readonly path: string;
  readonly reason: string;
  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`);
    this.name = 'ValidationError';
    this.path = path;
    this.reason = reason;
  }
}
function fail(path: string, message: string): never {
  throw new ValidationError(path, message);
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected object');
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, required: string[], path: string, optional: string[] = []) {
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'missing field; use null for absent data');
  for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) fail(`${path}.${key}`, 'unknown field');
}
function text(value: unknown, path: string) {
  if (typeof value !== 'string' || !value.trim()) fail(path, 'expected non-empty string');
}
function json(value: unknown, path: string): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { value.forEach((item, index) => json(item, `${path}[${index}]`)); return; }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) json(item, `${path}.${key}`);
    return;
  }
  fail(path, 'expected JSON value');
}

// Strict v1 timestamp subset: calendar date, seconds, optional milliseconds, explicit timezone.
export function timestamp(value: unknown, path: string): number {
  if (typeof value !== 'string') fail(path, 'expected ISO 8601 string with timezone');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) fail(path, 'expected YYYY-MM-DDTHH:mm:ss[.SSS]Z or ±HH:mm');
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || Number(offsetHour ?? 0) > 14 || Number(offsetMinute ?? 0) > 59
    || (Number(offsetHour) === 14 && Number(offsetMinute) !== 0)) fail(path, 'invalid calendar date, time, or timezone');
  const result = Date.parse(value);
  if (!Number.isFinite(result)) fail(path, 'invalid timestamp');
  return result;
}
function interval(value: Record<string, unknown>, path: string) {
  if (!STATUSES.includes(value.status as typeof STATUSES[number])) fail(`${path}.status`, 'unknown status');
  const start = timestamp(value.started_at, `${path}.started_at`);
  if (value.status === 'running') {
    if (value.ended_at !== null) fail(`${path}.ended_at`, 'running must have null end');
  } else {
    const end = timestamp(value.ended_at, `${path}.ended_at`);
    if (end < start) fail(`${path}.ended_at`, 'end precedes start');
  }
}
function contain(child: Span, parent: Span | Run, path: string) {
  const start = Date.parse(child.started_at);
  if (start < Date.parse(parent.started_at)) fail(path, 'step starts before its container');
  if (parent.ended_at !== null) {
    const end = Date.parse(parent.ended_at);
    if (child.ended_at === null || start > end || Date.parse(child.ended_at) > end) fail(path, 'step exceeds finished container');
  }
}

/** Shape checks plus ID/graph/time invariants that JSON Schema cannot express. */
export function validateLog(value: unknown): LogDocument {
  const document = object(value, 'log');
  fields(document, ['schema_version', 'runs'], 'log');
  if (document.schema_version !== 1) fail('log.schema_version', 'only version 1 is supported');
  if (!Array.isArray(document.runs)) fail('log.runs', 'expected array');
  const runIds = new Set<string>();
  document.runs.forEach((item: unknown, runIndex: number) => {
    const path = `runs[${runIndex}]`;
    const raw = object(item, path);
    fields(raw, ['id', 'name', 'agent_name', 'status', 'started_at', 'ended_at', 'spans'], path);
    for (const key of ['id', 'name', 'agent_name']) text(raw[key], `${path}.${key}`);
    interval(raw, path);
    if (runIds.has(raw.id as string)) fail(`${path}.id`, 'duplicate run ID');
    runIds.add(raw.id as string);
    if (!Array.isArray(raw.spans)) fail(`${path}.spans`, 'expected array');
    const spans = new Map<string, Span>();
    const spanPaths = new Map<string, string>();
    raw.spans.forEach((spanItem: unknown, index: number) => {
      const spanPath = `${path}.spans[${index}]`;
      const spanRaw = object(spanItem, spanPath);
      fields(spanRaw, ['id', 'parent_id', 'type', 'name', 'status', 'started_at', 'ended_at', 'input', 'output', 'error'], spanPath);
      text(spanRaw.id, `${spanPath}.id`); text(spanRaw.name, `${spanPath}.name`);
      if (spanRaw.parent_id !== null) text(spanRaw.parent_id, `${spanPath}.parent_id`);
      if (!SPAN_TYPES.includes(spanRaw.type as typeof SPAN_TYPES[number])) fail(`${spanPath}.type`, 'unknown type');
      interval(spanRaw, spanPath);
      json(spanRaw.input, `${spanPath}.input`); json(spanRaw.output, `${spanPath}.output`);
      if (spanRaw.error !== null) {
        const error = object(spanRaw.error, `${spanPath}.error`);
        fields(error, ['message'], `${spanPath}.error`, ['code', 'details']);
        text(error.message, `${spanPath}.error.message`);
        if (Object.hasOwn(error, 'code')) text(error.code, `${spanPath}.error.code`);
        if (Object.hasOwn(error, 'details')) json(error.details, `${spanPath}.error.details`);
      }
      if ((spanRaw.status === 'error') !== (spanRaw.error !== null)) fail(`${spanPath}.error`, 'error status requires an error; other statuses require null');
      if (spans.has(spanRaw.id as string)) fail(`${spanPath}.id`, 'duplicate step ID within run');
      spans.set(spanRaw.id as string, spanRaw as unknown as Span);
      spanPaths.set(spanRaw.id as string, spanPath);
    });
    const run = raw as unknown as Run;
    for (const span of spans.values()) {
      const spanPath = spanPaths.get(span.id)!;
      if (span.parent_id !== null && !spans.has(span.parent_id)) fail(`${spanPath}.parent_id`, 'parent does not exist in this run');
      contain(span, run, spanPath);
    }
    const checked = new Set<string>();
    for (const span of spans.values()) {
      const visiting = new Set<string>();
      let current: Span | undefined = span;
      while (current && !checked.has(current.id)) {
        if (visiting.has(current.id)) fail(`${spanPaths.get(current.id)!}.parent_id`, 'parent cycle detected');
        visiting.add(current.id);
        current = current.parent_id === null ? undefined : spans.get(current.parent_id);
      }
      visiting.forEach(id => checked.add(id));
    }
    for (const span of spans.values()) {
      if (span.parent_id !== null) contain(span, spans.get(span.parent_id)!, spanPaths.get(span.id)!);
    }
  });
  return value as LogDocument;
}
