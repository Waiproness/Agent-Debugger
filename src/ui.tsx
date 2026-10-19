import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Run, Span } from './model.ts';
import { displayValue, duration } from './view.ts';
import { runInsights } from './insights.ts';
import { downloadExport, prepareExport } from './export.ts';
import { redactRuns } from './redaction.ts';

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => { const dialog = ref.current!, previous = document.activeElement; dialog.showModal(); return () => { dialog.close(); if (previous instanceof HTMLElement) previous.focus(); }; }, []);
  return <dialog ref={ref} className="modal" aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }}><header className="modal-heading"><h2 id={id}>{title}</h2><button onClick={onClose} aria-label="ปิดหน้าต่าง">ปิด</button></header>{children}</dialog>;
}
export function DataBlock({ label, value }: { label: string; value: unknown }) {
  const text = useMemo(() => displayValue(value), [value]);
  const [full, setFull] = useState(false), [message, setMessage] = useState('');
  return <details className="data-block" open><summary>{label}<span>JSON</span></summary><div className="data-toolbar"><button onClick={async () => { try { await navigator.clipboard.writeText(value === null ? 'null' : text); setMessage('คัดลอกแล้ว'); } catch { setMessage('คัดลอกไม่ได้ เลือกข้อความแล้วคัดลอกด้วยคีย์บอร์ด'); } }}>คัดลอก</button><span role="status">{message}</span></div><pre className={value === null ? 'absent' : ''}>{full ? text : text.slice(0, 24000)}</pre>{text.length > 24000 && <button onClick={() => setFull(!full)}>{full ? 'ย่อข้อความ' : `แสดงทั้งหมด (${text.length.toLocaleString()} ตัวอักษร)`}</button>}</details>;
}
type Theme = 'system' | 'light' | 'dark';
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(() => { try { const value = localStorage.getItem('agent-debugger-theme'); return value === 'light' || value === 'dark' ? value : 'system'; } catch { return 'system'; } });
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme; };
    apply(); media.addEventListener('change', apply);
    try { localStorage.setItem('agent-debugger-theme', theme); } catch { /* Theme still works without persistent preferences. */ }
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return <label className="theme-picker">ธีม<select aria-label="ธีม" value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">ตามระบบ</option><option value="light">สว่าง</option><option value="dark">มืด</option></select></label>;
}
function InsightList({ spans, onSelect }: { spans: Span[]; onSelect: (id: string) => void }) {
  const [page, setPage] = useState(0), pages = Math.max(1, Math.ceil(spans.length / 5));
  return <><ul>{spans.slice(page * 5, (page + 1) * 5).map(span => <li key={span.id}><button onClick={() => onSelect(span.id)}><span>{span.name}</span><small>{span.id} · {duration(span.started_at, span.ended_at)}</small></button></li>)}{!spans.length && <li className="subtle">ไม่พบรายการ</li>}</ul>{pages > 1 && <div className="insight-pages"><button aria-label="รายการก่อนหน้า" disabled={page === 0} onClick={() => setPage(page - 1)}>←</button><span>{page + 1} / {pages}</span><button aria-label="รายการถัดไป" disabled={page === pages - 1} onClick={() => setPage(page + 1)}>→</button></div>}</>;
}
export function Insights({ run, onSelect }: { run: Run; onSelect: (id: string) => void }) {
  const facts = useMemo(() => runInsights(run), [run]);
  const [toolPage, setToolPage] = useState(0);
  const toolPages = Math.max(1, Math.ceil(facts.repeatedTools.length / 20));
  const currentToolPage = Math.min(toolPage, toolPages - 1);
  const list = (spans: Span[]) => <InsightList key={run.id} spans={spans} onSelect={onSelect} />;
  return <details className="panel insights"><summary><span>สิ่งที่ควรตรวจ <small>คำนวณจาก log</small></span><span className="count-label">{facts.errors.length} error · {facts.unfinished.length} ยังไม่จบ</span></summary><div className="insight-grid"><section><h4>ข้อเท็จจริง · error ({facts.errors.length})</h4>{list(facts.errors)}</section><section><h4>ข้อเท็จจริง · ยังไม่จบ ({facts.unfinished.length})</h4>{list(facts.unfinished)}</section><section><h4>ขั้นตอนที่ใช้เวลานานที่สุด</h4>{list(facts.slowest)}</section><section><h4>Tool ที่ใช้เวลานานที่สุด</h4>{list(facts.slowestTools)}</section><section className="repeated-tools"><h4>ข้อสังเกต · Tool ชื่อเดิมซ้ำ</h4><p className="subtle">นับชื่อที่ตรงกันตั้งแต่ 2 ครั้ง ไม่ได้แปลว่าเป็น bug</p>{facts.repeatedTools.slice(currentToolPage * 20, (currentToolPage + 1) * 20).map(group => <details key={group.name}><summary>{group.name} · {group.spans.length} ครั้ง</summary>{list(group.spans)}</details>)}{!facts.repeatedTools.length && <p className="subtle">ไม่พบชื่อซ้ำ</p>}{toolPages > 1 && <div className="insight-pages"><button disabled={currentToolPage === 0} onClick={() => setToolPage(currentToolPage - 1)}>กลุ่มก่อนหน้า</button><span>{currentToolPage + 1} / {toolPages}</span><button disabled={currentToolPage === toolPages - 1} onClick={() => setToolPage(currentToolPage + 1)}>กลุ่มถัดไป</button></div>}</section></div><p className="insight-note">จัดอันดับเฉพาะขั้นตอนที่มีเวลาจบ ใช้เวลาจบ − เวลาเริ่มของแต่ละขั้นตอน ไม่บวกเวลาซ้อนกัน · running เป็นสถานะที่บันทึกไว้ ไม่ยืนยันว่าค้าง</p></details>;
}
export function ExportDialog({ runs, onClose, onDone }: { runs: Run[]; onClose: () => void; onDone: (message: string) => void }) {
  const [redact, setRedact] = useState(true), [extra, setExtra] = useState(''), [preview, setPreview] = useState(''), [error, setError] = useState('');
  const prepared = useMemo(() => {
    try { const masked = redact ? redactRuns(runs, extra.split(',').map(key => key.trim()).filter(Boolean)) : { runs, count: 0, paths: [] }; return { ...prepareExport(masked.runs), ...masked, error: '' }; }
    catch (error) { return { error: error instanceof Error ? error.message : 'เตรียมไฟล์ไม่สำเร็จ' }; }
  }, [runs, redact, extra]);
  useEffect(() => { let stale = false; setPreview(''); if ('blob' in prepared) prepared.blob.text().then(text => { if (!stale) setPreview(text.slice(0, 24000)); }); return () => { stale = true; }; }, [prepared]);
  return <Modal title="ตรวจข้อมูลก่อนส่งออก" onClose={onClose}><div className="modal-body"><p>ส่งออก {runs.length} รันเต็ม รวมขั้นตอนที่ถูกกรอง · schema_version: 1</p><label className="check-label"><input type="checkbox" checked={redact} onChange={event => setRedact(event.target.checked)} />ปกปิดข้อมูลตามกฎ</label><label>ชื่อ field เพิ่มเติม (คั่นด้วย comma)<input placeholder="เช่น email, customer_id" value={extra} disabled={!redact} onChange={event => setExtra(event.target.value)} /></label><p className="subtle">ตรวจชื่อ authorization, api_key, access_token, password และรูปแบบ Bearer/API key/JWT/private key ที่ชัดเจน ไม่รับประกันว่าจะพบความลับทุกชนิด ตรวจ preview ก่อนดาวน์โหลด · ID เวลา และสถานะไม่ถูกเปลี่ยน</p>{'blob' in prepared && <><p className="export-stats">ปกปิด {prepared.count} ตำแหน่ง · {prepared.blob.size.toLocaleString()} bytes</p>{prepared.exceedsImportLimit && <p className="notice">ไฟล์เกิน 10 MiB จึงนำเข้าตรง ๆ ไม่ได้ แบ่งไฟล์โดยรักษารันให้ครบ</p>}<details><summary>ตำแหน่งที่ปกปิด (สูงสุด 100 รายการ)</summary><ul className="path-list">{prepared.paths.map((path, index) => <li key={index}><code>{path}</code></li>)}</ul></details><label>Preview JSON (สูงสุด 24,000 ตัวอักษร)<textarea readOnly value={preview} rows={10} spellCheck={false} /></label></>}{(prepared.error || error) && <p role="alert" className="error-text">{prepared.error || error}</p>}<p className="subtle">Workspace และ IndexedDB ใช้ข้อมูลต้นฉบับ · นำกลับเข้าได้เมื่อไม่มี run ID ซ้ำใน workspace ปลายทาง</p></div><footer className="modal-actions"><button onClick={onClose}>ยกเลิก</button><button className="primary" disabled={!('blob' in prepared) || !preview} onClick={() => { if (!('blob' in prepared)) return; try { downloadExport(prepared.blob, runs.length === 1 ? 'run' : 'workspace'); onDone(`เริ่มดาวน์โหลด ${runs.length} รัน · ปกปิด ${prepared.count} ตำแหน่ง`); onClose(); } catch (error) { setError(error instanceof Error ? error.message : 'ดาวน์โหลดไม่สำเร็จ'); } }}>ดาวน์โหลด JSON</button></footer></Modal>;
}

