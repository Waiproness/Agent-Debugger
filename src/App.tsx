import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Run, Span, Status } from './model.ts';
import { SPAN_TYPES, STATUSES } from './model.ts';
import { validateLog } from './validate.ts';
import type { ImportPreview } from './import.ts';
import { inspectFile } from './import-client.ts';
import { spanDepths, duration, recordedEnd, seconds } from './view.ts';
import { buildSpanSearch, EMPTY_FILTERS, filterSpanSearch } from './search.ts';
import type { SpanFilters } from './search.ts';
import { chooseComparisonRun, COMPARISON_FIELDS, compareSpanFields, diffJson, EMPTY_COMPARISON, matchSpans, spanField, summaryDifference, swapComparison } from './compare.ts';
import type { ComparisonField, ComparisonSelection, FieldDifference } from './compare.ts';
import { deleteSavedRun, restoreRuns, saveRuns } from './storage.ts';
import { newExamples, selectionAfterDelete } from './workspace.ts';
import { DataBlock, ExportDialog, Insights, Modal, ThemePicker } from './ui.tsx';

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
function RunSummary({ run }: { run: Run }) {
  return <section className="run-summary" aria-label="สรุปรัน">
    <div><p className="eyebrow">รันที่เลือก</p><h2>{run.name}</h2><p className="subtle">{run.agent_name}</p></div>
    <dl className="metrics">
      <div><dt>เวลารวม</dt><dd>{duration(run.started_at, run.ended_at)}</dd></div>
      <div><dt>ขั้นตอน</dt><dd>{run.spans.length}</dd></div>
      <div><dt>ขั้นตอนที่ผิดพลาด</dt><dd className={run.spans.some(span => span.status === 'error') ? 'error-text' : ''}>{run.spans.filter(span => span.status === 'error').length}</dd></div>
    </dl>
  </section>;
}
function Timeline({ run, selectedId, onSelect }: { run: Run; selectedId: string | null; onSelect: (id: string) => void }) {
  const [filters, setFilters] = useState<SpanFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const rows = useRef<HTMLOListElement>(null);
  const depths = useMemo(() => spanDepths(run.spans), [run.spans]);
  const searchIndex = useMemo(() => buildSpanSearch([...run.spans].sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))), [run.spans]);
  const visible = useMemo(() => filterSpanSearch(searchIndex, filters), [searchIndex, filters]);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const paged = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  useEffect(() => { setPage(0); }, [filters]);
  useEffect(() => { const index = visible.findIndex(span => span.id === selectedId); if (index >= 0) { setPage(Math.floor(index / pageSize)); requestAnimationFrame(() => rows.current?.querySelector('.selected')?.scrollIntoView({ block: 'nearest' })); } }, [selectedId]);
  const reveal = () => { const index = visible.findIndex(span => span.id === selectedId); if (index >= 0) { setPage(Math.floor(index / pageSize)); requestAnimationFrame(() => rows.current?.querySelector('.selected')?.scrollIntoView({ block: 'nearest' })); } };
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
      <div className="timeline-axis" aria-hidden="true"><span>ขั้นตอน / ประเภท</span><div>{[0, 1, 2, 3].map(index => <span key={index}>{seconds((end - start) * index / 3)}</span>)}</div></div>
      {run.spans.length === 0 ? <p className="panel-empty">รันนี้ยังไม่มีขั้นตอน</p> : visible.length === 0 ? <div className="panel-empty no-results"><p>ไม่พบขั้นตอนที่ตรงกับคำค้นและตัวกรอง รันนี้มี {run.spans.length} ขั้นตอน</p><button onClick={clearFilters}>ล้างตัวกรองและแสดงทุกขั้นตอน</button></div> : <ol className="timeline-list" ref={rows}>
        {paged.map((span, rowIndex) => {
          const left = Math.min(100, (Date.parse(span.started_at) - start) / windowMs * 100);
          const width = Math.max(0, ((span.ended_at === null ? end : Date.parse(span.ended_at)) - Date.parse(span.started_at)) / windowMs * 100);
          return <li key={span.id} aria-posinset={currentPage * pageSize + rowIndex + 1} aria-setsize={visible.length}>
            <button className={`span-row ${selectedId === span.id ? 'selected' : ''}`} onClick={() => onSelect(span.id)} onKeyDown={event => {
              const index = currentPage * pageSize + rowIndex;
              const target = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : -1;
              if (target < 0 || target >= visible.length) return;
              event.preventDefault(); setPage(Math.floor(target / pageSize)); onSelect(visible[target].id);
              requestAnimationFrame(() => document.getElementById(`timeline-${target}`)?.focus());
            }} id={`timeline-${currentPage * pageSize + rowIndex}`} aria-pressed={selectedId === span.id} aria-label={`${span.name}, ${span.id}, ${span.type}, ${STATUS_LABELS[span.status]}, ${duration(span.started_at, span.ended_at)}`}>
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
    <div className="pagination"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button><label>หน้า<select aria-label="หน้า Timeline" value={currentPage} onChange={event => setPage(Number(event.target.value))}>{Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{index + 1} / {pages}</option>)}</select></label><button disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>ถัดไป</button><button onClick={reveal} disabled={hiddenSelection || !selectedId}>ไปขั้นตอนที่เลือก</button></div>
    <footer className="timeline-footnote"><span className="subtle">แสดงสูงสุด 100 แถวต่อหน้า · ใช้ ↑ ↓ Home End เพื่อเลื่อนขั้นตอน · เวลาตาม log</span>{run.ended_at === null && <p>เส้นประแสดงงานที่ยังไม่จบ ถึงเวลาล่าสุดที่บันทึก ({seconds(end - start)}) ไม่ใช่เวลาปัจจุบัน</p>}<p>งานซ้อนกันได้ — เวลารวมของรันไม่ใช่ผลบวกของทุกขั้นตอน</p></footer>
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
function SpanPicker({ side, spans, value, onChange }: { side: string; spans: Span[]; value: string | null; onChange: (id: string | null) => void }) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => spans.filter(span => `${span.id} ${span.name} ${span.type}`.toLowerCase().includes(query.trim().toLowerCase())), [spans, query]);
  const options = matches.slice(0, 100), selected = spans.find(span => span.id === value);
  if (selected && !options.includes(selected)) options.unshift(selected);
  return <div className="span-picker"><label>ค้นขั้นตอน {side}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ชื่อ, ID หรือ type" /></label><label>ขั้นตอน {side}<select value={value ?? ''} disabled={!spans.length} onChange={event => onChange(event.target.value || null)}><option value="">เลือกขั้นตอน {side}</option>{options.map(span => <option key={span.id} value={span.id}>{span.name} · {span.id} · {span.type}</option>)}</select></label><small>พบ {matches.length.toLocaleString()} · แสดง 100 รายการแรกและขั้นตอนที่เลือก</small></div>;
}
function JsonDifference({ a, b }: { a: unknown; b: unknown }) {
  const result = useMemo(() => diffJson(a, b), [a, b]);
  return <div className="json-diff">{result.changes.map(change => <section key={change.path}><code>{change.path}</code><div className="comparison-columns"><div><small>A</small>{change.hasA ? <DataBlock label="ค่า A" value={change.a} /> : <p className="subtle">ไม่มี field นี้</p>}</div><div><small>B</small>{change.hasB ? <DataBlock label="ค่า B" value={change.b} /> : <p className="subtle">ไม่มี field นี้</p>}</div></div></section>)}{!result.changes.length && <p className="subtle">ไม่มีค่าที่เปลี่ยน</p>}{result.truncated && <p className="notice">แสดงความต่าง 200 ตำแหน่งแรก ยกเลิกตัวเลือกเฉพาะส่วนที่เปลี่ยนเพื่อดู payload เต็ม</p>}</div>;
}
function Comparison({ runs, selection, onChange, sourceFor, onExport, onDelete, busy }: { runs: Run[]; selection: ComparisonSelection; onChange: (selection: ComparisonSelection) => void; sourceFor: (id: string) => string; onExport: (runs: Run[]) => void; onDelete: (run: Run) => void; busy: boolean }) {
  const [changedOnly, setChangedOnly] = useState(false), [matchQuery, setMatchQuery] = useState('');
  const a = runs.find(run => run.id === selection.runA);
  const b = runs.find(run => run.id === selection.runB);
  const spanA = a?.spans.find(span => span.id === selection.spanA);
  const spanB = b?.spans.find(span => span.id === selection.spanB);
  const fields = useMemo(() => compareSpanFields(spanA, spanB), [spanA, spanB]);
  const orderedA = useMemo(() => a ? [...a.spans].sort((x, y) => Date.parse(x.started_at) - Date.parse(y.started_at)) : [], [a]);
  const orderedB = useMemo(() => b ? [...b.spans].sort((x, y) => Date.parse(x.started_at) - Date.parse(y.started_at)) : [], [b]);
  const matching = useMemo(() => a && b ? matchSpans(a, b) : null, [a, b]);
  const suggestions = useMemo(() => matching?.pairs.filter(pair => `${pair.a.name} ${pair.a.id} ${pair.b.id}`.toLowerCase().includes(matchQuery.trim().toLowerCase())).slice(0, 100) ?? [], [matching, matchQuery]);
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
    {matching && <section className="panel matching"><h3>คู่ขั้นตอนที่แนะนำ · {matching.pairs.length.toLocaleString()} คู่</h3><p className="subtle">ใช้ type + ชื่อตรงกัน + สาย parent และลำดับชื่อซ้ำตามเวลาเริ่ม (เวลาเท่ากันใช้ลำดับในไฟล์) แล้วสำรองด้วยชื่อ/ประเภท/ความลึก ไม่ใช้ ID ข้ามรันเป็นเกณฑ์ · ข้อเสนอไม่ยืนยันว่างานเหมือนกัน แก้แต่ละฝั่งด้านล่างได้</p><label>ค้นคู่แนะนำ<input type="search" value={matchQuery} onChange={event => setMatchQuery(event.target.value)} /></label><label>เลือกคู่แนะนำ (สูงสุด 100 คู่)<select value="" onChange={event => { const pair = suggestions[Number(event.target.value)]; if (pair) onChange({ ...selection, spanA: pair.a.id, spanB: pair.b.id }); }}><option value="">ใช้คู่แนะนำ…</option>{suggestions.map((pair, index) => <option key={pair.a.id} value={index}>{pair.a.name} · {pair.a.id} ↔ {pair.b.id} · {pair.reason === 'structure' ? 'โครงสร้างตรงกัน' : 'ชื่อและความลึกตรงกัน'}</option>)}</select></label><details><summary>จับคู่ไม่ได้: A {matching.unmatchedA.length} · B {matching.unmatchedB.length}</summary>{(['A', 'B'] as const).map(side => <div key={side}><h4>รัน {side}</h4><ul className="unmatched">{(side === 'A' ? matching.unmatchedA : matching.unmatchedB).slice(0, 100).map(span => <li key={span.id}><button onClick={() => onChange({ ...selection, ...(side === 'A' ? { spanA: span.id } : { spanB: span.id }) })}>{span.name} · {span.id}</button></li>)}</ul><p className="subtle">แสดงสูงสุด 100 รายการ ค้นและเลือกทั้งหมดได้ด้านล่าง</p></div>)}</details></section>}
    <section className="panel comparison-steps" aria-labelledby="compare-steps-heading"><h3 id="compare-steps-heading">เลือกหรือแก้คู่ขั้นตอน</h3><p className="subtle">เลือกแต่ละฝั่งได้อย่างอิสระ</p><div className="comparison-columns">
      {(['A', 'B'] as const).map(side => {
        const run = side === 'A' ? a : b;
        const ordered = side === 'A' ? orderedA : orderedB;
        return <SpanPicker key={`${side}-${run?.id}`} side={side} spans={ordered} value={side === 'A' ? selection.spanA : selection.spanB} onChange={id => onChange({ ...selection, ...(side === 'A' ? { spanA: id } : { spanB: id }) })} />;
      })}
    </div></section>
    <label className="check-label"><input type="checkbox" checked={changedOnly} onChange={event => setChangedOnly(event.target.checked)} />แสดงเฉพาะส่วนที่เปลี่ยน</label>
    <div className="comparison-fields">{COMPARISON_FIELDS.filter(field => !changedOnly || fields[field] !== 'same').map(field => <section className="panel comparison-field" key={field}><header><h3>{FIELD_LABELS[field]}</h3><span className={`difference difference-${fields[field]}`}>{DIFFERENCE_LABELS[fields[field]]}</span></header>{changedOnly && spanA && spanB && ['input', 'output', 'error'].includes(field) ? <JsonDifference a={spanField(spanA, field)} b={spanField(spanB, field)} /> : <div className="comparison-columns">{([spanA, spanB] as const).map((span, index) => <div key={index}><h4>ขั้นตอน {index === 0 ? 'A' : 'B'}</h4>{span ? field === 'duration' ? <p className="comparison-duration">{duration(span.started_at, span.ended_at)}</p> : <DataBlock label={FIELD_LABELS[field]} value={spanField(span, field)} /> : <p className="panel-empty">ยังไม่ได้เลือกขั้นตอน {index === 0 ? 'A' : 'B'}</p>}</div>)}</div>}{field === 'duration' && <p className="subtle">B − A: {spanA && spanB && spanA.ended_at !== null && spanB.ended_at !== null ? seconds((Date.parse(spanB.ended_at) - Date.parse(spanB.started_at)) - (Date.parse(spanA.ended_at) - Date.parse(spanA.started_at))) : 'ยังเปรียบเทียบไม่ได้'}</p>}</section>)}</div>
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
  const [exportRequest, setExportRequest] = useState<Run[] | null>(null);
  const [pendingImport, setPendingImport] = useState<{ filename: string; preview: ImportPreview } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Run | null>(null);
  const importAbort = useRef<AbortController | null>(null);
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
  const runs = useMemo(() => entries.map(entry => entry.run), [entries]);
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
    const controller = new AbortController(); importAbort.current = controller;
    try {
      const preview = await inspectFile(file, runs.map(run => run.id), controller.signal);
      if (controller.signal.aborted) return;
      setPendingImport({ filename: file.name, preview }); setImportState({ kind: 'idle' });
    } catch (error) {
      if (controller.signal.aborted) { setImportState({ kind: 'idle' }); setFeedback('ยกเลิกการอ่านไฟล์แล้ว'); }
      else setImportState({ kind: 'error', filename: file.name, message: errorMessage(error) });
    } finally { if (importAbort.current === controller) { importAbort.current = null; finishOperation(); } }
  }
  async function confirmImport() {
    if (!pendingImport || !startOperation()) return;
    const { filename, preview } = pendingImport;
    setPendingImport(null);
    try {
      const id = ++batchId.current;
      const batch: WorkspaceEntry[] = preview.runs.map(run => ({ run, filename, batch: id, saved: 'saving' }));
      setEntries(current => [...current, ...batch]);
      if (preview.runs.length && mode === 'single') { setRunId(preview.runs[0].id); setSpanId(preview.runs[0].spans[0]?.id ?? null); }
      setImportState({ kind: 'success', filename, count: preview.runs.length });
      if (batch.length) await persist(batch);
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
    if (!startOperation()) return;
    setPendingDelete(null);
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
    setExportRequest(selected);
  }
  return <>
    {pendingImport && <Modal title="ตรวจไฟล์ก่อนนำเข้า" onClose={() => { setPendingImport(null); setFeedback('ยกเลิกนำเข้าแล้ว ไม่ได้เพิ่มหรือบันทึกข้อมูล'); }}><div className="modal-body"><p><strong>{pendingImport.filename}</strong></p><dl className="preview-metrics"><div><dt>รูปแบบ</dt><dd>{pendingImport.preview.format}</dd></div><div><dt>Run</dt><dd>{pendingImport.preview.runs.length.toLocaleString()}</dd></div><div><dt>Span</dt><dd>{pendingImport.preview.spanCount.toLocaleString()}</dd></div></dl><h3>ข้อจำกัดและคำเตือน</h3>{pendingImport.preview.warnings.length ? <ul className="warning-list">{pendingImport.preview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : <p className="subtle">ตรวจ schema v1 ผ่าน ไม่มีคำเตือนจากตัวแปลง</p>}<ul className="preview-runs">{pendingImport.preview.runs.slice(0, 20).map(run => <li key={run.id}><strong>{run.name}</strong><code>{run.id}</code><span>{run.spans.length.toLocaleString()} spans · {STATUS_LABELS[run.status]}</span></li>)}</ul>{pendingImport.preview.runs.length > 20 && <p>แสดงตัวอย่าง 20 รันแรก</p>}<p className="subtle">เมื่อยืนยัน จะเพิ่มรันทั้งหมดและบันทึกใน IndexedDB ของเบราว์เซอร์นี้</p></div><footer className="modal-actions"><button onClick={() => { setPendingImport(null); setFeedback('ยกเลิกนำเข้าแล้ว ไม่ได้เพิ่มหรือบันทึกข้อมูล'); }}>ยกเลิกนำเข้า</button><button className="primary" onClick={confirmImport}>ยืนยันนำเข้า</button></footer></Modal>}
    {exportRequest && <ExportDialog runs={exportRequest} onClose={() => setExportRequest(null)} onDone={setExportFeedback} />}
    {pendingDelete && <Modal title="ยืนยันลบรัน" onClose={() => setPendingDelete(null)}><div className="modal-body"><p>ลบรัน “{pendingDelete.name}” หรือไม่?</p><code>{pendingDelete.id}</code><p className="notice">จะลบจาก workspace และ IndexedDB เมื่อบันทึกไว้แล้ว ไม่มี undo ควรส่งออกสำรองก่อน</p></div><footer className="modal-actions"><button autoFocus onClick={() => setPendingDelete(null)}>ยกเลิกลบ</button><button className="danger" onClick={() => deleteRun(pendingDelete)}>ยืนยันลบ</button></footer></Modal>}
    <header className="app-header"><div className="brand"><span className="brand-mark" aria-hidden="true">a<span>·</span></span><div><strong>Agent Debugger</strong><small>พื้นที่ตรวจ agent trace</small></div></div><div className="header-tags"><span className="local-badge"><span aria-hidden="true" />ข้อมูลอยู่บนเครื่อง</span><span className="version-tag">SCHEMA v1</span><ThemePicker /></div></header>
    <main>
      <section className="intro"><div><p className="eyebrow">TRACE WORKSPACE / LOCAL FIRST</p><h1>เข้าใจทุกขั้นตอนของ Agent</h1><p>จาก log สู่คำตอบที่ตรวจสอบได้ ค้นหา เปรียบเทียบ และติดตามจุดที่ควรตรวจในที่เดียว</p></div><span className="sample-tag">ไม่ต้องใช้ API key · ประมวลผลบนเครื่อง</span></section>
      <section className="import-panel" aria-labelledby="import-heading" aria-busy={locked}>
        <div className="import-controls"><div><h2 id="import-heading">นำเข้าบันทึกการทำงาน</h2><p id="import-help">Agent Debugger v1 หรือ OTLP JSON (subset) · .json สูงสุด 10 MiB · ตรวจ preview ก่อนบันทึก</p></div><div className="import-actions">
          <input ref={fileInput} type="file" accept=".json" hidden disabled={locked} onChange={importFile} />
          <button className="import-button" disabled={locked} aria-describedby="import-help persistence-note" onClick={() => fileInput.current?.click()}>{isReading ? 'กำลังอ่านไฟล์…' : 'เลือกไฟล์ JSON'}</button>
          <button className="example-button" disabled={locked} onClick={loadExamples}>โหลดรันตัวอย่าง</button>
          {isReading && <button onClick={() => importAbort.current?.abort()}>ยกเลิกการอ่าน</button>}
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
        <p className="import-feedback" role="status">{exportFeedback}</p>
      </section>
      {restoring && <div className="state-panel" role="status"><h2>กำลังคืนรันที่บันทึก…</h2><p>ตรวจ storage version และข้อมูลผ่าน validator ก่อนแสดง</p></div>}
      {!restoring && runs.length === 0 && <div className="state-panel" role="status"><h2>ยังไม่มีรัน</h2><p>เลือกไฟล์ JSON ด้านบนเพื่อเริ่ม หรือโหลดรันตัวอย่างเพื่อทดลองหน้าจอ</p></div>}
      <nav className="mode-switch" aria-label="โหมดตรวจบันทึก"><button aria-pressed={mode === 'single'} onClick={() => setMode('single')}>ตรวจรันเดี่ยว</button><button aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>เปรียบเทียบสองรัน</button></nav>
      {mode === 'compare' && <Comparison runs={runs} selection={comparison} onChange={setComparison} sourceFor={id => `${sourceFor(id)} · ${saveLabel(entries.find(entry => entry.run.id === id)!)}`} onExport={exportRuns} onDelete={setPendingDelete} busy={locked} />}
      <div hidden={mode !== 'single'}>{runs.length > 0 && <div className="workspace">
        <aside className="panel runs-panel" aria-labelledby="runs-heading"><header className="panel-heading"><div><h3 id="runs-heading">รายการรัน</h3><p>ตรวจข้อมูลผ่านแล้ว · {entries.filter(entry => entry.filename !== null).length} รันจากไฟล์</p></div><span className="count-label">{runs.length}</span></header><ul className="runs-list">{entries.map((entry, index) => {
          const item = entry.run;
          return <li key={item.id}><button className={`run-card ${item.id === runId ? 'selected' : ''}`} aria-pressed={item.id === runId} onClick={() => { setRunId(item.id); setSpanId(item.spans[0]?.id ?? null); }}><span className="run-card-top"><span className="run-number">RUN {String(index + 1).padStart(2, '0')}</span><StatusBadge status={item.status} /></span><span className={`source-label ${entry.filename ? 'source-file' : 'source-sample'}`}>{sourceFor(item.id)}</span><strong>{item.name}</strong><span className="run-agent">{item.agent_name}</span><span className="save-state">{saveLabel(entry)}</span><span className="run-card-bottom"><span>{item.spans.length} ขั้นตอน</span><span>{duration(item.started_at, item.ended_at)}</span></span></button><button className="delete-run example-button" disabled={locked} aria-label={`ลบรัน ${item.name}`} onClick={() => setPendingDelete(item)}>ลบรัน</button></li>;
        })}</ul><div className="sample-note"><span className="eyebrow">ประมวลผลบนเครื่อง</span><p>ประมวลผลในเบราว์เซอร์ ไม่มีการเรียก AI API หรือส่งไฟล์ออกไปภายนอก</p></div></aside>
        {run && <div className="run-workspace"><RunSummary run={run} /><div className="run-context"><span className="source-label">{sourceFor(run.id)}</span><span>{saveLabel(entries.find(entry => entry.run.id === run.id)!)}</span><code>{run.id}</code><StatusBadge status={run.status} /><span>เริ่ม <time dateTime={run.started_at}>{run.started_at}</time></span><span>จบ {run.ended_at ?? 'ยังไม่จบ'}</span></div><Insights key={run.id} run={run} onSelect={setSpanId} /><label className="panel-width-control">ขนาดแผงรายละเอียด<input aria-label="ขนาดแผงรายละเอียด" type="range" min="280" max="560" defaultValue="340" onChange={event => document.documentElement.style.setProperty('--details-width', `${event.target.value}px`)} /></label><div className="run-panels"><Timeline key={run.id} run={run} selectedId={spanId} onSelect={setSpanId} /><StepDetails span={span} /></div></div>}
      </div>}</div>
      <footer className="scope-note"><p><strong>Agent Debugger</strong> บันทึกในเบราว์เซอร์ · ลบรัน · ส่งออก JSON</p><p>รองรับ Agent Debugger v1 และ OTLP JSON แบบมีข้อจำกัด · ไม่มี API หรือบริการเสียเงิน</p></footer>
    </main>
  </>;
}

