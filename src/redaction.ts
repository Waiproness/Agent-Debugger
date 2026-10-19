import type { Run } from './model.ts';
import { validateLog } from './validate.ts';

const FIELDS = ['authorization', 'proxyauthorization', 'apikey', 'accesstoken', 'refreshtoken', 'password', 'passwd', 'clientsecret', 'secretkey', 'privatekey'];
const normalize = (key: string) => key.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
const PATTERNS = /\bBearer\s+[^\s"'<>]+|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g;

/** Work on a copy; structural IDs, enums and timestamps must remain importable. */
export function redactRuns(runs: Run[], extraFields: string[] = []) {
  const result = structuredClone(runs), fields = new Set([...FIELDS, ...extraFields.map(normalize).filter(Boolean)]), paths: string[] = [];
  let count = 0;
  const record = (path: string) => { count++; if (paths.length < 100) paths.push(path); };
  const roots: { owner: Record<string, unknown>; key: string; path: string; protect?: boolean }[] = [];
  for (const [ri, run] of result.entries()) {
    const base = `runs[${ri}]`;
    for (const key of ['name', 'agent_name']) roots.push({ owner: run as unknown as Record<string, unknown>, key, path: `${base}.${key}` });
    for (const [si, span] of run.spans.entries()) for (const key of ['name', 'input', 'output', 'error']) roots.push({ owner: span as unknown as Record<string, unknown>, key, path: `${base}.spans[${si}].${key}`, protect: key === 'error' });
  }
  while (roots.length) {
    const { owner, key, path, protect } = roots.pop()!, value = owner[key];
    if (!protect && value !== null && fields.has(normalize(key))) { owner[key] = '[REDACTED]'; record(path); }
    else if (typeof value === 'string') {
      const masked = value.replace(PATTERNS, '[REDACTED]');
      if (masked !== value) { owner[key] = masked; record(path); }
    } else if (value !== null && typeof value === 'object') {
      for (const child of Object.keys(value)) roots.push({ owner: value as Record<string, unknown>, key: child, path: `${path}[${JSON.stringify(child)}]` });
    }
  }
  validateLog({ schema_version: 1, runs: result });
  return { runs: result, count, paths };
}
