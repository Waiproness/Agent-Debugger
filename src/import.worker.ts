import { previewImport } from './import.ts';

self.onmessage = async (event: MessageEvent<{ file: File; ids: string[] }>) => {
  try { self.postMessage({ result: previewImport(await event.data.file.text(), event.data.ids) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'อ่านและตรวจไฟล์ไม่สำเร็จ' }); }
};
