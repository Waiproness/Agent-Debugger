import type { Run } from './model.ts';
import { MAX_FILE_BYTES } from './import.ts';
import { validateLog } from './validate.ts';

export function prepareExport(runs: Run[]) {
  const document = validateLog({ schema_version: 1, runs });
  const blob = new Blob([JSON.stringify(document)], { type: 'application/json;charset=utf-8' });
  return { blob, exceedsImportLimit: blob.size > MAX_FILE_BYTES };
}

export function downloadExport(blob: Blob, scope: 'run' | 'workspace') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = `agent-debugger-${scope}-${Date.now()}.json`;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    // Let the browser consume the download before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
