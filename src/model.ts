export const STATUSES = ['running', 'success', 'error', 'cancelled'] as const;
export const SPAN_TYPES = ['agent', 'task', 'prompt', 'model', 'tool'] as const;
export type Status = typeof STATUSES[number];
export type SpanType = typeof SPAN_TYPES[number];
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface SpanError {
  message: string;
  code?: string;
  details?: JsonValue;
}
export interface Span {
  id: string;
  parent_id: string | null;
  type: SpanType;
  name: string;
  status: Status;
  started_at: string;
  ended_at: string | null;
  input: JsonValue;
  output: JsonValue;
  error: SpanError | null;
}
export interface Run {
  id: string;
  name: string;
  agent_name: string;
  status: Status;
  started_at: string;
  ended_at: string | null;
  spans: Span[];
}
export interface LogDocument { schema_version: 1; runs: Run[] }
