import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { JsonValue, Run, Span, Status } from './model.ts';
import { SPAN_TYPES, STATUSES } from './model.ts';
import { validateLog } from './validate.ts';
import { readImport } from './import.ts';
import { spanDepths, displayValue, duration, recordedEnd, seconds } from './view.ts';
import { buildSpanSearch, EMPTY_FILTERS, filterSpanSearch } from './search.ts';
import type { SpanFilters } from './search.ts';
import { chooseComparisonRun, COMPARISON_FIELDS, compareSpanFields, EMPTY_COMPARISON, spanField, summaryDifference, swapComparison } from './compare.ts';
import type { ComparisonField, ComparisonSelection, FieldDifference } from './compare.ts';
import { deleteSavedRun, restoreRuns, saveRuns } from './storage.ts';
import { downloadExport, prepareExport } from './export.ts';
import { newExamples, selectionAfterDelete } from './workspace.ts';

const EXAMPLES = ['success.json', 'tool-error.json', 'parallel-nested.json'];
const STATUS_LABELS: Record<Status, string> = {
  success: 'สำเร็จ', error: 'เกิดข้อผิดพลาด', running: 'กำลังทำงาน', cancelled: 'ยกเลิก',
};
type WorkspaceEntry = { run: Run; filename: string | null; batch: number | null; saved: 'sample' | 'saving' | 'saved' | 'failed'; error?: string };
type ImportState = { kind: 'idle' } | { kind: 'reading'; filename: string }
  | { kind: 'success'; filename: string; count: number } | { kind: 'error'; filename: string; message: string };

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status-${status}`}><span aria-hidden="true" className="status-dot" />{STATUS_LABELS[status]}</span>;
}
function DataBlock({ label, value }: { label: string; value: JsonValue | Span['error'] }) {
  return <section className="data-block"><h4>{label}</h4><pre className={value === null ? 'absent' : ''}>{displayValue(value)}</pre></section>;
}
function RunSummary({ run }: { run: Run }) {
  return <section className="run-summary" aria-label="สรุปรัน">
    <div><p className="eyebrow">SELECTED RUN</p><h2>{run.name}</h2><p className="subtle">{run.agent_name}</p></div>
    <dl className="metrics">
      <div><dt>เวลารวม</dt><dd>{duration(run.started_at, run.ended_at)}</dd></div>
      <div><dt>ขั้นตอน</dt><dd>{run.spans.length}</dd></div>
      <div><dt>ขั้นตอนที่ผิดพลาด</dt><dd className={run.spans.some(span => span.status === 'error') ? 'error-text' : ''}>{run.spans.filter(span => span.status === 'error').length}</dd></div>
    </dl>
  </section>;
}
function Timeline({ run, selectedId, onSelect }: { run: Run; selectedId: string | null; onSelect: (id: string) => void }) {
  const [filters, setFilters] = useState<SpanFilters>(EMPTY_FILTERS);
  const depths = useMemo(() => spanDepths(run.spans), [run.spans]);
  const searchIndex = useMemo(() => buildSpanSearch([...run.spans].sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))), [run.spans]);
  const visible = useMemo(() => filterSpanSearch(searchIndex, filters), [searchIndex, filters]);
  const hiddenSelection = selectedId !== null && !visible.some(span => span.id === selectedId);
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const start = Date.parse(run.started_at);
  const end = recordedEnd(run);
  const windowMs = Math.max(end - start, 1);
  return <section className="panel timeline-panel" aria-labelledby="timeline-heading">
    <header className="panel-heading"><div><h3 id="timeline-heading">ไทม์ไลน์</h3><p>เลือกขั้นตอนเพื่อดูข้อมูลใน log</p></div><span className="count-label">{run.spans.length} spans</span></header>
    <div className="timeline-filters">
      <label htmlFor="span-search">ค้นหาขั้นตอน</label>
      <div className="search-controls"><input id="span-search" type="search" value={filters.query} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} placeholder="ID, ชื่อ, type, input, output หรือ error" /><button onClick={() => setFilters(current => ({ ...current, query: '' }))}>ล้างคำค้น</button></div>
      <div className="filter-controls">
        <label htmlFor="span-status">สถานะ (status)<select id="span-status" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value as SpanFilters['status'] }))}><option value="all">ทั้งหมด</option>{STATUSES.map(status => <option key={status} value={status}>{status} · {STATUS_LABELS[status]}</option>)}</select></label>
        <label htmlFor="span-type">ประเภท (type)<select id="span-type" value={filters.type} onChange={event => setFilters(current => ({ ...current, type: event.target.value as SpanFilters['type'] }))}><option value="all">ทั้งหมด</option>{SPAN_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <button onClick={clearFilters}>ล้างตัวกรองทั้งหมด</button>
      </div>
      <p className="filter-count" role="status" aria-atomic="true">พบ {visible.length} จาก {run.spans.length} ขั้นตอน</p>
      {hiddenSelection && <div className="hidden-selection" role="status"><p>ขั้นตอนที่เลือกไม่อยู่ในผลกรอง · รายละเอียดยังคงเดิม</p><button onClick={clearFilters}>ล้างตัวกรองเพื่อกลับไปดู</button></div>}
    </div>
    <div className="timeline-content">
      <div className="timeline-axis" aria-hidden="true"><span>STEP / TYPE</span><div>{[0, 1, 2, 3].map(index => <span key={index}>{seconds((end - start) * index / 3)}</span>)}</div></div>
      {run.spans.length === 0 ? <p className="panel-empty">รันนี้ยังไม่มีขั้นตอน</p> : visible.length === 0 ? <div className="panel-empty no-results"><p>ไม่พบขั้นตอนที่ตรงกับคำค้นและตัวกรอง รันนี้มี {run.spans.length} ขั้นตอน</p><button onClick={clearFilters}>ล้างตัวกรองและแสดงทุกขั้นตอน</button></div> : <ol className="timeline-list">
        {visible.map(span => {
          const left = Math.min(100, (Date.parse(span.started_at) - start) / windowMs * 100);
          const width = Math.max(0, ((span.ended_at === null ? end : Date.parse(span.ended_at)) - Date.parse(span.started_at)) / windowMs * 100);
          return <li key={span.id}>
            <button className={`span-row ${selectedId === span.id ? 'selected' : ''}`} onClick={() => onSelect(span.id)} aria-pressed={selectedId === span.id} aria-label={`${span.name}, ${span.type}, ${STATUS_LABELS[span.status]}, ${duration(span.started_at, span.ended_at)}`}>
              <span className="span-label" style={{ paddingLeft: `${Math.min(depths.get(span.id)!, 5) * 12 + 10}px` }}>
                <span className={`type-icon type-${span.type}`} aria-hidden="true">{span.type === 'tool' ? '↗' : span.type === 'prompt' ? '›' : span.type === 'model' ? '∗' : '▤'}</span>
                <span><strong>{span.name}</strong><small>{span.type} · {STATUS_LABELS[span.status]}</small></span>
              </span>
              <span className="span-track" aria-hidden="true"><span className={`span-bar bar-${span.status} ${span.ended_at === null ? 'unfinished' : ''}`} style={{ left: `${left}%`, width: `${width}%` }} /><span className="bar-time">{duration(span.started_at, span.ended_at)}</span></span>
            </button>
          </li>;
        })}
      </ol>}
    </div>
    <footer className="timeline-footnote"><span className="subtle">เวลาทั้งหมดอ้างอิงจาก log · timezone ตามไฟล์</span>{run.ended_at === null && <p>เส้นประแสดงงานที่ยังไม่จบ ถึงเวลาล่าสุดที่บันทึก ({seconds(end - start)}) ไม่ใช่เวลาปัจจุบัน</p>}<p>งานซ้อนกันได้ — เวลารวมของรันไม่ใช่ผลบวกของทุกขั้นตอน</p></footer>
  </section>;
}
function StepDetails({ span }: { span: Span | undefined }) {
  return <aside className="panel details-panel" aria-labelledby="details-heading">
    <header className="panel-heading"><div><h3 id="details-heading">รายละเอียดขั้นตอน</h3><p>ข้อมูลต้นฉบับจาก log</p></div></header>
    {!span ? <p className="panel-empty">เลือกขั้นตอนในไทม์ไลน์</p> : <div className="details-content" key={span.id}>
      <div className="step-title"><span className="type-tag">{span.type}</span><StatusBadge status={span.status} /><h4>{span.name}</h4></div>
      <dl className="step-metadata"><div><dt>ID</dt><dd>{span.id}</dd></div><div><dt>Parent</dt><dd>{span.parent_id ?? 'ระดับบนสุด (null)'}</dd></div><div><dt>ระยะเวลา</dt><dd>{duration(span.started_at, span.ended_at)}</dd></div><div><dt>เริ่ม</dt><dd><time dateTime={span.started_at}>{span.started_at}</time></dd></div><div><dt>จบ</dt><dd>{span.ended_at ?? 'ยังไม่จบ (null)'}</dd></div></dl>
      <DataBlock label={span.type === 'prompt' ? 'Input / Prompt' : 'Input'} value={span.input} />
      <DataBlock label="Output" value={span.output} />
      <DataBlock label="Error" value={span.error} />
    </div>}
  </aside>;
}

const FIELD_LABELS: Record<ComparisonField, string> = { type: 'Type', name: 'Name', status: 'Status', duration: 'ระยะเวลา', input: 'Input', output: 'Output', error: 'Error' };
const DIFFERENCE_LABELS: Record<FieldDifference, string> = { same: 'เหมือนกัน', different: 'ต่างกัน', unselected: 'ยังไม่ได้เลือกครบสองขั้นตอน', unavailable: 'ยังเปรียบเทียบไม่ได้ — ขั้นตอนยังไม่จบ' };
function Comparison({ runs, selection, onChange, sourceFor, onExport, onDelete, busy }: { runs: Run[]; selection: ComparisonSelection; onChange: (selection: ComparisonSelection) => void; sourceFor: (id: string) => string; onExport: (runs: Run[]) => void; onDelete: (run: Run) => void; busy: boolean }) {
  const a = runs.find(run => run.id === selection.runA);
  const b = runs.find(run => run.id === selection.runB);
  const spanA = a?.spans.find(span => span.id === selection.spanA);
  const spanB = b?.spans.find(span => span.id === selection.spanB);
  const fields = useMemo(() => compareSpanFields(spanA, spanB), [spanA, spanB]);
  const orderedA = useMemo(() => a ? [...a.spans].sort((x, y) => Date.parse(x.started_at) - Date.parse(y.started_at)) : [], [a]);
  const orderedB = useMemo(() => b ? [...b.spans].sort((x, y) => Date.parse(x.started_at) - Date.parse(y.started_at)) : [], [b]);
  const difference = a && b ? summaryDifference(a, b) : null;
  const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;
  return <section className="comparison" aria-labelledby="comparison-heading">
    <header className="comparison-heading"><div><h2 id="comparison-heading">เปรียบเทียบสองรัน</h2><p>ต้องเลือกคนละรัน · คู่และขั้นตอนที่เลือกจะหายเมื่อรีเฟรช</p></div><button className="example-button" disabled={!a || !b} onClick={() => onChange(swapComparison(selection))}>สลับ A/B</button></header>
    {runs.length < 2 && <p className="comparison-notice" role="status">ต้องมีอย่างน้อยสองรัน เพิ่มรันด้วยปุ่มเลือกไฟล์ JSON ด้านบน หรือโหลดรันตัวอย่างเมื่อรายการว่าง</p>}
    <div className="comparison-columns">
      {(['A', 'B'] as const).map(side => {
        const run = side === 'A' ? a : b;
        const otherId = side === 'A' ? selection.runB : selection.runA;
        return <section className="panel comparison-run" key={side} aria-label={`สรุปรัน ${side}`}>
          <label htmlFor={`compare-run-${side}`}>รัน {side}</label><select id={`compare-run-${side}`} value={side === 'A' ? selection.runA ?? '' : selection.runB ?? ''} onChange={event => onChange(chooseComparisonRun(selection, side, event.target.value || null))}><option value="">เลือก รัน {side}</option>{runs.map(item => <option key={item.id} value={item.id} disabled={item.id === otherId}>{item.name} · {item.id}</option>)}</select>
          {run ? <><RunSummary run={run} /><div className="comparison-identity"><code>{run.id}</code><p>{sourceFor(run.id)}</p><StatusBadge status={run.status} /></div><div className="run-actions"><button className="example-button" onClick={() => onExport([run])}>ส่งออก JSON รัน {side}</button><button className="example-button" disabled={busy} onClick={() => onDelete(run)}>ลบรัน {side}: {run.name}</button></div></> : <p className="panel-empty">ยังไม่ได้เลือกรัน {side}</p>}
        </section>;
      })}
    </div>
    <section className="panel comparison-delta" aria-label="ผลต่างสรุป B ลบ A"><h3>ผลต่างตัวเลข B − A</h3>{difference ? <dl><div><dt>เวลารวม B − A</dt><dd>{difference.durationMs === null ? 'ไม่มีผลต่างเวลา — มีรันที่ยังไม่จบ' : `${difference.durationMs > 0 ? '+' : ''}${seconds(difference.durationMs)}`}</dd></div><div><dt>จำนวนขั้นตอน B − A</dt><dd>{signed(difference.spanCount)}</dd></div><div><dt>จำนวนขั้นตอน error B − A</dt><dd>{signed(difference.errorCount)}</dd></div></dl> : <p>เลือกรัน A และ B เพื่อดูผลต่างสรุป</p>}</section>
    <section className="panel comparison-steps" aria-labelledby="compare-steps-heading"><h3 id="compare-steps-heading">ผู้ใช้เลือกขั้นตอนที่จะเปรียบเทียบเอง</h3><p className="subtle">ไม่ได้จับคู่จาก ID ชื่อ หรือลำดับอัตโนมัติ เลือกแต่ละฝั่งได้อย่างอิสระ</p><div className="comparison-columns">
      {(['A', 'B'] as const).map(side => {
        const run = side === 'A' ? a : b;
        const ordered = side === 'A' ? orderedA : orderedB;
        return <div key={side}><label htmlFor={`compare-span-${side}`}>ขั้นตอน {side} · เรียงตามเวลาเริ่ม</label><select id={`compare-span-${side}`} disabled={!run || ordered.length === 0} value={side === 'A' ? selection.spanA ?? '' : selection.spanB ?? ''} onChange={event => onChange({ ...selection, ...(side === 'A' ? { spanA: event.target.value || null } : { spanB: event.target.value || null }) })}><option value="">เลือกขั้นตอน {side}</option>{ordered.map(span => <option key={span.id} value={span.id}>{span.name} · {span.id} · {span.type} · {span.status}</option>)}</select>{run && ordered.length === 0 && <p className="panel-empty">รัน {side} ไม่มีขั้นตอน</p>}</div>;
      })}
    </div></section>
    <div className="comparison-fields">{COMPARISON_FIELDS.map(field => <section className="panel comparison-field" key={field}><header><h3>{FIELD_LABELS[field]}</h3><span className={`difference difference-${fields[field]}`}>{DIFFERENCE_LABELS[fields[field]]}</span></header><div className="comparison-columns">{([spanA, spanB] as const).map((span, index) => <div key={index}><h4>ขั้นตอน {index === 0 ? 'A' : 'B'}</h4>{span ? field === 'duration' ? <p className="comparison-duration">{duration(span.started_at, span.ended_at)}</p> : <DataBlock label={FIELD_LABELS[field]} value={spanField(span, field)} /> : <p className="panel-empty">ยังไม่ได้เลือกขั้นตอน {index === 0 ? 'A' : 'B'}</p>}</div>)}</div></section>)}</div>
  </section>;
}

export default function App() {
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [busy, setBusy] = useState(false);
  const operation = useRef(true);
  const batchId = useRef(0);
  const [feedback, setFeedback] = useState('');
  const [operationError, setOperationError] = useState('');
  const [exportFeedback, setExportFeedback] = useState('');
  const [exportError, setExportError] = useState('');
  const [importState, setImportState] = useState<ImportState>({ kind: 'idle' });
  const fileInput = useRef<HTMLInputElement>(null);
  const importError = useRef<HTMLDivElement>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [spanId, setSpanId] = useState<string | null>(null);
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [comparison, setComparison] = useState<ComparisonSelection>(EMPTY_COMPARISON);
  const selection = useRef({ runId, spanId, comparison });
  selection.current = { runId, spanId, comparison };
  const errorMessage = (error: unknown) => error instanceof Error ? `${error.name}: ${error.message}` : 'ดำเนินการไม่สำเร็จ';
  useEffect(() => {
    let cancelled = false;
    restoreRuns().then(saved => {
      if (cancelled) return;
      setEntries(saved.map(entry => ({ ...entry, batch: null, saved: 'saved' })));
      setRunId(saved[0]?.run.id ?? null);
      setSpanId(saved[0]?.run.spans[0]?.id ?? null);
    }).catch(error => {
      if (!cancelled) setRestoreError(errorMessage(error));
    }).finally(() => {
      if (!cancelled) { setRestoring(false); operation.current = false; }
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (importState.kind === 'error') importError.current?.focus();
  }, [importState]);
  const runs = entries.map(entry => entry.run);
  const run = runs.find(item => item.id === runId);
  const span = run?.spans.find(item => item.id === spanId);
  const isReading = importState.kind === 'reading';
  const locked = restoring || busy;
  const sourceFor = (id: string) => {
    const entry = entries.find(item => item.run.id === id);
    return entry?.filename ? `จากไฟล์: ${entry.filename}` : 'ข้อมูลตัวอย่าง · จำลอง';
  };
  const saveLabel = (entry: WorkspaceEntry) => entry.saved === 'saved' ? 'บันทึกสำเร็จในเบราว์เซอร์'
    : entry.saved === 'saving' ? 'กำลังบันทึก… ยังไม่ยืนยันว่าจะคืนหลังรีเฟรชได้'
    : entry.saved === 'failed' ? 'บันทึกล้มเหลว · ยังไม่บันทึก จะหายเมื่อรีเฟรช'
    : 'ตัวอย่างในหน่วยความจำ · จะหายเมื่อรีเฟรช';
  function startOperation() {
    if (operation.current) return false;
    operation.current = true;
    setBusy(true);
    setOperationError('');
    return true;
  }
  function finishOperation() { operation.current = false; setBusy(false); }
  async function persist(batch: WorkspaceEntry[]) {
    const ids = new Set(batch.map(entry => entry.run.id));
    setEntries(current => current.map(entry => ids.has(entry.run.id) ? { ...entry, saved: 'saving', error: undefined } : entry));
    setFeedback(`กำลังบันทึก ${batch.length} รัน จาก ${batch[0].filename}`);
    try {
      await saveRuns(batch.map(entry => ({ run: entry.run, filename: entry.filename! })));
      setEntries(current => current.map(entry => ids.has(entry.run.id) ? { ...entry, saved: 'saved', error: undefined } : entry));
      setFeedback(`บันทึกสำเร็จ ${batch.length} รัน จาก ${batch[0].filename}`);
    } catch (error) {
      const message = errorMessage(error);
      setEntries(current => current.map(entry => ids.has(entry.run.id) ? { ...entry, saved: 'failed', error: message } : entry));
      setFeedback(`บันทึกล้มเหลว ${batch.length} รัน จาก ${batch[0].filename} · ยังตรวจและส่งออกได้ แต่จะหายเมื่อรีเฟรช`);
      setOperationError(message);
    }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !startOperation()) return;
    setImportState({ kind: 'reading', filename: file.name });
    try {
      const incoming = await readImport(file, runs);
      const id = ++batchId.current;
      const batch: WorkspaceEntry[] = incoming.map(run => ({ run, filename: file.name, batch: id, saved: 'saving' }));
      setEntries(current => [...current, ...batch]);
      if (incoming.length > 0 && mode === 'single') {
        setRunId(incoming[0].id);
        setSpanId(incoming[0].spans[0]?.id ?? null);
      }
      setImportState({ kind: 'success', filename: file.name, count: incoming.length });
      if (batch.length > 0) await persist(batch);
    } catch (error) {
      setImportState({ kind: 'error', filename: file.name, message: errorMessage(error) });
    } finally { finishOperation(); }
  }
  async function retrySave(entry: WorkspaceEntry) {
    if (!startOperation()) return;
    try { await persist(entries.filter(item => item.batch === entry.batch && item.saved === 'failed')); }
    finally { finishOperation(); }
  }
  async function loadExamples() {
    if (!startOperation()) return;
    setFeedback('กำลังโหลดและตรวจข้อมูลตัวอย่าง…');
    try {
      const documents = await Promise.all(EXAMPLES.map(async filename => {
        const response = await fetch(`${import.meta.env.BASE_URL}examples/${filename}`);
        if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
        return validateLog(await response.json());
      }));
      const examples = validateLog({ schema_version: 1, runs: documents.flatMap(item => item.runs) }).runs;
      const { added, skipped } = newExamples(examples, runs);
      setEntries(current => [...current, ...added.map(run => ({ run, filename: null, batch: null, saved: 'sample' as const }))]);
      if (added.length > 0 && mode === 'single') { setRunId(added[0].id); setSpanId(added[0].spans[0]?.id ?? null); }
      setFeedback(`โหลดตัวอย่าง ${added.length} รัน · ข้าม ID ที่มีอยู่แล้ว ${skipped} รัน · ไม่บันทึกตัวอย่างอัตโนมัติ`);
    } catch (error) { setOperationError(errorMessage(error)); setFeedback('โหลดตัวอย่างไม่สำเร็จ ลองโหลดใหม่ได้'); }
    finally { finishOperation(); }
  }
  async function deleteRun(item: Run) {
    if (operation.current || !window.confirm(`ลบรัน “${item.name}” (ID: ${item.id})?`)) return;
    if (!startOperation()) return;
    const entry = entries.find(entry => entry.run.id === item.id)!;
    setFeedback(`กำลังลบรัน: ${item.name}`);
    try {
      if (entry.saved === 'saved') await deleteSavedRun(item.id);
      setEntries(current => current.filter(entry => entry.run.id !== item.id));
      const current = selection.current;
      const next = selectionAfterDelete(runs, item.id, current.runId, current.spanId, current.comparison);
      setRunId(next.runId); setSpanId(next.spanId); setComparison(next.comparison);
      setFeedback(`ลบรันสำเร็จ: ${item.name}`);
    } catch (error) { setOperationError(errorMessage(error)); setFeedback(`ลบรันไม่สำเร็จ: ${item.name} · เก็บรายการเดิมไว้`); }
    finally { finishOperation(); }
  }
  function exportRuns(selected: Run[]) {
    setExportError('');
    try {
      const { blob, exceedsImportLimit } = prepareExport(selected);
      downloadExport(blob, selected.length === 1 ? 'run' : 'workspace');
      setExportFeedback(`เริ่มดาวน์โหลด ${selected.length} รัน (${blob.size.toLocaleString()} bytes) · ${exceedsImportLimit ? 'ไฟล์เกิน 10 MiB จึงนำเข้าตรง ๆ ไม่ได้ ให้แบ่งไฟล์โดยรักษาแต่ละรันให้ครบ' : 'ขนาดอยู่ในเพดานนำเข้า 10 MiB'} · นำกลับเข้า workspace เดิมจะถูกปฏิเสธหาก run ID ซ้ำ`);
    } catch (error) { setExportError(`ส่งออกไม่สำเร็จ: ${errorMessage(error)}`); }
  }
  return <>
    <header className="app-header"><div className="brand"><span className="brand-mark" aria-hidden="true">a<span>·</span></span><div><strong>Agent Debugger</strong><small>Browser trace workspace</small></div></div><div className="header-tags"><span className="local-badge"><span aria-hidden="true" />ON-DEVICE DATA</span><span className="version-tag">SCHEMA v1</span></div></header>
    <main>
      <section className="intro"><div><p className="eyebrow">TRACE WORKSPACE</p><h1>เห็นภาพการทำงานของ Agent</h1><p>ตรวจแต่ละขั้นตอนจากบันทึก โดยประมวลผลในเบราว์เซอร์บนคอมของคุณ</p></div><span className="sample-tag">นำเข้า · บันทึก · ส่งออก JSON v1</span></section>
      <section className="import-panel" aria-labelledby="import-heading" aria-busy={locked}>
        <div className="import-controls"><div><h2 id="import-heading">นำเข้าบันทึกการทำงาน</h2><p id="import-help">ไฟล์ .json ครั้งละหนึ่งไฟล์ · สูงสุด 10 MiB (10,485,760 bytes) · schema_version 1 เท่านั้น</p></div><div className="import-actions">
          <input ref={fileInput} type="file" accept=".json" hidden disabled={locked} onChange={importFile} />
          <button className="import-button" disabled={locked} aria-describedby="import-help persistence-note" onClick={() => fileInput.current?.click()}>{isReading ? 'กำลังอ่านไฟล์…' : 'เลือกไฟล์ JSON'}</button>
          <button className="example-button" disabled={locked} onClick={loadExamples}>โหลดรันตัวอย่าง</button>
        </div></div>
        <p id="persistence-note" className="persistence-note">รันที่บันทึกสำเร็จเก็บใน browser/profile/origin นี้เท่านั้น ไม่ซิงก์ข้ามเครื่อง · ตัวอย่างและรันที่ยังไม่บันทึกจะหายเมื่อรีเฟรช · การล้างข้อมูลเว็บไซต์อาจลบข้อมูลที่บันทึกไว้ แนะนำส่งออกสำรอง</p>
        <div role="status" aria-atomic="true" className="import-feedback">
          {importState.kind === 'reading' && <p>กำลังอ่านและตรวจทั้งไฟล์: {importState.filename}</p>}
          {importState.kind === 'success' && <p className="success-text">{importState.count > 0 ? `นำเข้าสำเร็จ ${importState.count} รัน จาก ${importState.filename} · ดูผลการบันทึกแยกด้านล่าง` : `ตรวจไฟล์ ${importState.filename} ผ่าน แต่ runs ว่าง จึงไม่มีรันเพิ่ม`}</p>}
          <p>{feedback}</p>
        </div>
        {importState.kind === 'error' && <div className="import-error" ref={importError} role="alert" tabIndex={-1} aria-labelledby="import-error-heading"><h3 id="import-error-heading">นำเข้า {importState.filename} ไม่สำเร็จ</h3><p>{importState.message}</p><p>ข้อมูลและรันที่เปิดอยู่ยังคงเดิม แก้ไฟล์แล้วเลือกใหม่ได้</p></div>}
        {operationError && <p className="import-error" role="alert">{operationError}</p>}
        {restoreError && <div className="import-error" role="alert"><h3>คืนข้อมูลที่บันทึกไม่สำเร็จ</h3><p>{restoreError}</p><p>ข้อมูลเดิมไม่ได้ถูกลบหรือเขียนทับอัตโนมัติ รันเดิมอาจยังไม่แสดงในรายการ · ตรวจรันในหน่วยความจำได้ แต่หาก storage ยังอ่านไม่ได้จะบันทึกไม่สำเร็จ</p></div>}
        {entries.some(entry => entry.saved === 'failed') && <ul className="unsaved-list" aria-label="รันที่ยังไม่บันทึก">{entries.filter(entry => entry.saved === 'failed').map(entry => <li key={entry.run.id}><p><strong>{entry.run.name}</strong> · {entry.run.id} · {sourceFor(entry.run.id)}</p><p>{saveLabel(entry)}</p><p>{entry.error}</p><button className="example-button" disabled={locked} onClick={() => retrySave(entry)}>ลองบันทึกใหม่: {entry.run.name} (ทั้งไฟล์ที่ยังอยู่)</button></li>)}</ul>}
        <div className="run-actions"><button className="example-button" disabled={!run || restoring} onClick={() => run && exportRuns([run])}>ส่งออก JSON รันเดี่ยวที่เลือก</button><button className="example-button" disabled={runs.length === 0 || restoring} onClick={() => exportRuns(runs)}>ส่งออก JSON ทุกรันใน workspace</button></div>
        <p className="persistence-note">ส่งออกข้อมูลรันเต็มรวม spans ที่ถูกกรอง · ไม่รวมที่มาหรือ metadata ของ storage · นำกลับเข้า workspace เดิมไม่ได้หาก run ID ซ้ำ · ไฟล์ส่งออกอาจเกินเพดานนำเข้า 10 MiB</p>
        <p className="import-feedback" role="status">{exportFeedback}</p>{exportError && <p className="import-error" role="alert">{exportError}</p>}
      </section>
      {restoring && <div className="state-panel" role="status"><h2>กำลังคืนรันที่บันทึก…</h2><p>ตรวจ storage version และข้อมูลผ่าน validator ก่อนแสดง</p></div>}
      {!restoring && runs.length === 0 && <div className="state-panel" role="status"><h2>ยังไม่มีรัน</h2><p>เลือกไฟล์ JSON ด้านบนเพื่อเริ่ม หรือโหลดรันตัวอย่างเพื่อทดลองหน้าจอ</p></div>}
      <nav className="mode-switch" aria-label="โหมดตรวจบันทึก"><button aria-pressed={mode === 'single'} onClick={() => setMode('single')}>ตรวจรันเดี่ยว</button><button aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>เปรียบเทียบสองรัน</button></nav>
      {mode === 'compare' && <Comparison runs={runs} selection={comparison} onChange={setComparison} sourceFor={id => `${sourceFor(id)} · ${saveLabel(entries.find(entry => entry.run.id === id)!)}`} onExport={exportRuns} onDelete={deleteRun} busy={locked} />}
      <div hidden={mode !== 'single'}>{runs.length > 0 && <div className="workspace">
        <aside className="panel runs-panel" aria-labelledby="runs-heading"><header className="panel-heading"><div><h3 id="runs-heading">รายการรัน</h3><p>ตรวจข้อมูลผ่านแล้ว · {entries.filter(entry => entry.filename !== null).length} รันจากไฟล์</p></div><span className="count-label">{runs.length}</span></header><ul className="runs-list">{entries.map((entry, index) => {
          const item = entry.run;
          return <li key={item.id}><button className={`run-card ${item.id === runId ? 'selected' : ''}`} aria-pressed={item.id === runId} onClick={() => { setRunId(item.id); setSpanId(item.spans[0]?.id ?? null); }}><span className="run-card-top"><span className="run-number">RUN {String(index + 1).padStart(2, '0')}</span><StatusBadge status={item.status} /></span><span className={`source-label ${entry.filename ? 'source-file' : 'source-sample'}`}>{sourceFor(item.id)}</span><strong>{item.name}</strong><span className="run-agent">{item.agent_name}</span><span className="save-state">{saveLabel(entry)}</span><span className="run-card-bottom"><span>{item.spans.length} ขั้นตอน</span><span>{duration(item.started_at, item.ended_at)}</span></span></button><button className="delete-run example-button" disabled={locked} aria-label={`ลบรัน ${item.name}`} onClick={() => deleteRun(item)}>ลบรัน</button></li>;
        })}</ul><div className="sample-note"><span className="eyebrow">BROWSER PROCESSING</span><p>ประมวลผลในเบราว์เซอร์ ไม่มีการเรียก AI API หรือส่งไฟล์ออกไปภายนอก</p></div></aside>
        {run && <div className="run-workspace"><RunSummary run={run} /><div className="run-context"><span className="source-label">{sourceFor(run.id)}</span><span>{saveLabel(entries.find(entry => entry.run.id === run.id)!)}</span><code>{run.id}</code><StatusBadge status={run.status} /><span>เริ่ม <time dateTime={run.started_at}>{run.started_at}</time></span><span>จบ {run.ended_at ?? 'ยังไม่จบ'}</span></div><div className="run-panels"><Timeline key={run.id} run={run} selectedId={spanId} onSelect={setSpanId} /><StepDetails span={span} /></div></div>}
      </div>}</div>
      <footer className="scope-note"><p><strong>Agent Debugger</strong> บันทึกในเบราว์เซอร์ · ลบรัน · ส่งออก JSON</p><p>รองรับรูปแบบ Agent Debugger v1 เท่านั้น ยังไม่ได้แปลง log จากทุก Agent SDK</p></footer>
    </main>
  </>;
}

