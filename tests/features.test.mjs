import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDBFactory } from 'fake-indexeddb';
import { previewImport, parseImport } from '../src/import.ts';
import { matchSpans, diffJson, jsonEqual, compareSpanFields } from '../src/compare.ts';
import { runInsights } from '../src/insights.ts';
import { redactRuns } from '../src/redaction.ts';
import { prepareExport } from '../src/export.ts';
import { restoreRuns, saveRuns, deleteSavedRun } from '../src/storage.ts';
import { buildSpanSearch, filterSpanSearch, EMPTY_FILTERS } from '../src/search.ts';
import { fixture } from '../scripts/benchmark.mjs';

const native=JSON.parse(await readFile(new URL('../public/examples/success.json',import.meta.url),'utf8'));
const otlp=JSON.parse(await readFile(new URL('../public/examples/otlp.json',import.meta.url),'utf8'));
const load=value=>previewImport(JSON.stringify(value),[]);
const span=(value)=>value.resourceSpans[0].scopeSpans[0].spans[1];

test('OTLP preview maps root identity/times/status, parent IDs and explicit payload, then round-trips v1',async()=>{
  const original=structuredClone(otlp), preview=load(otlp);
  assert.match(preview.format,/OTLP/);assert.equal(preview.spanCount,2);assert.ok(preview.warnings.length>=3);
  const run=preview.runs[0];assert.equal(run.id,'1234567890abcdef1234567890abcdef');assert.equal(run.status,'success');
  assert.equal(run.spans[0].input,null);assert.equal(run.spans[1].parent_id,run.spans[0].id);assert.deepEqual(run.spans[1].input,{item:'demo-only'});assert.equal(run.spans[1].error.message,'Demo: item unavailable');
  assert.deepEqual(parseImport(await prepareExport(preview.runs).blob.text(),[]),preview.runs);assert.deepEqual(otlp,original);
});
for(const [name,mutate,pattern] of [
  ['missing start',x=>delete span(x).startTimeUnixNano,/startTimeUnixNano/],
  ['missing end',x=>delete span(x).endTimeUnixNano,/endTimeUnixNano/],
  ['zero default time',x=>span(x).endTimeUnixNano='0',/default/],
  ['unsafe numeric time',x=>span(x).startTimeUnixNano=1792368000100000000,/safe integer/],
  ['unset status',x=>span(x).status={code:0},/UNSET/],
  ['missing status',x=>delete span(x).status,/UNSET/],
  ['string enum',x=>span(x).status={code:'STATUS_CODE_OK'},/status.code/],
  ['missing parent',x=>span(x).parentSpanId='abcdefabcdefabcd',/parent/],
  ['extra root',x=>delete span(x).parentSpanId,/root/],
  ['invalid ID',x=>span(x).traceId='0000',/hex ID/],
  ['reversed time',x=>span(x).endTimeUnixNano='1792368000099999999',/เวลาจบก่อน/],
  ['container mismatch',x=>span(x).endTimeUnixNano='1792368009000000000',/container/],
  ['unsupported AnyValue',x=>span(x).attributes[1].value={bytesValue:'AA=='},/AnyValue/],
  ['duplicate attribute',x=>span(x).attributes.push(span(x).attributes[0]),/ซ้ำ/],
])test(`OTLP rejects ${name} without inventing missing data`,()=>{const value=structuredClone(otlp);mutate(value);const copy=structuredClone(value);assert.throws(()=>load(value),pattern);assert.deepEqual(value,copy);});
test('OTLP grouping normalizes ID case and warns on reduced precision; root error keeps factual code when message absent',()=>{
  const value=structuredClone(otlp);span(value).traceId=span(value).traceId.toUpperCase();span(value).startTimeUnixNano='1792368000100000001';span(value).status={code:2};
  const result=load(value);assert.equal(result.runs.length,1);assert.match(result.warnings.join(' '),/milliseconds/);assert.equal(result.runs[0].spans[1].error.message,'OTLP STATUS_CODE_ERROR');
});
test('OTLP AnyValue preserves false, zero, empty string, arrays and 64-bit integer strings',()=>{
  const value=structuredClone(otlp);span(value).attributes[1].value={arrayValue:{values:[{boolValue:false},{doubleValue:0},{stringValue:''},{intValue:'9223372036854775807'}]}};
  assert.deepEqual(load(value).runs[0].spans[1].input,[false,0,'','9223372036854775807']);
});
test('OTLP rejects duplicate kvlist keys instead of silently dropping payload data',()=>{
  const value=structuredClone(otlp);span(value).attributes[1].value={kvlistValue:{values:[{key:'same',value:{boolValue:false}},{key:'same',value:{doubleValue:0}}]}};
  assert.throws(()=>load(value),/key.*ซ้ำ/);
});
test('insights rank individual durations, list errors/running and count exact repeated tool names without summing overlap',()=>{
  const run=fixture(4).runs[0];run.status='running';run.ended_at=null;
  run.spans[0].name=run.spans[1].name='same';run.spans[0].ended_at='2026-10-19T00:00:00.000Z';
  run.spans[2].status='error';run.spans[2].error={message:'failure'};run.spans[3].status='running';run.spans[3].ended_at=null;
  const result=runInsights(run);assert.deepEqual(result.errors.map(x=>x.id),['s2']);assert.deepEqual(result.unfinished.map(x=>x.id),['s3']);assert.equal(result.repeatedTools[0].spans.length,2);assert.equal(result.slowest[0].id,'s1');assert.equal(result.slowestTools.at(-1).id,'s0');
});
test('matching ignores cross-run IDs, pairs duplicate names by structural occurrence and exposes unmatched steps',()=>{
  const a=fixture(4).runs[0],b=structuredClone(a);b.id='b';
  a.spans.forEach(s=>s.name='repeat');b.spans.forEach((s,i)=>{s.name='repeat';s.id=`different-${i}`;});b.spans[3].name='new';
  const original=structuredClone([a,b]),result=matchSpans(a,b);
  assert.deepEqual(result.pairs.map(p=>[p.a.id,p.b.id]),[['s0','different-0'],['s1','different-1'],['s2','different-2']]);
  assert.equal(result.unmatchedA[0].id,'s3');assert.equal(result.unmatchedB[0].id,'different-3');assert.deepEqual([a,b],original);
});
test('matching distinguishes parent branches and supports 10,000-deep trees in linear path storage',()=>{
  const a=fixture(10000,'chain').runs[0],b=structuredClone(a);b.id='b';b.spans.forEach((s,i)=>{s.id=`b${i}`;s.parent_id=i?`b${i-1}`:null;});
  const result=matchSpans(a,b);assert.equal(result.pairs.length,10000);assert.equal(result.pairs.at(-1).b.id,'b9999');
});
test('matching fallback handles renamed parent and keeps exact type/name/depth with deterministic duplicates',()=>{
  const a=fixture(3,'chain').runs[0],b=structuredClone(a);b.spans[0].name='renamed';b.spans.forEach((s,i)=>{s.id=`b${i}`;s.parent_id=i?`b${i-1}`:null;});
  const result=matchSpans(a,b);assert.deepEqual(result.pairs.map(p=>[p.a.id,p.b.id,p.reason]),[['s1','b1','name-depth'],['s2','b2','name-depth']]);assert.equal(result.unmatchedA.length,1);
});
test('JSON diff ignores key order but distinguishes absent/null, false/0, empty string and array order; caps only display',()=>{
  assert.deepEqual(diffJson({a:1,b:[]},{b:[],a:1}).changes,[]);
  const result=diffJson({a:null,b:false,c:0,d:'',list:[1,2]}, {b:0,c:false,d:null,list:[2,1]});
  assert.equal(result.changes.length,6);assert.equal(result.changes[0].hasA,true);assert.equal(result.changes[0].hasB,false);
  assert.equal(diffJson([1,2,3],[4,5,6],2).truncated,true);
});
test('redaction handles nested objects/arrays, exact custom fields and clear token patterns without changing workspace',async()=>{
  const runs=structuredClone(native.runs),original=structuredClone(runs);runs[0].spans[0].input={authorization:'Bearer test-only-value',nested:[{api_key:'demo',password:false,access_token:0,keep:0,email:'local@example.test'}],text:'Bearer example-only',ordinary:'token count 20',token_count:20};
  const before=structuredClone(runs),result=redactRuns(runs,['email']);
  assert.equal(result.count,6);assert.deepEqual(result.runs[0].spans[0].input,{authorization:'[REDACTED]',nested:[{api_key:'[REDACTED]',password:'[REDACTED]',access_token:'[REDACTED]',keep:0,email:'[REDACTED]'}],text:'[REDACTED]',ordinary:'token count 20',token_count:20});assert.deepEqual(runs,before);
  assert.deepEqual(parseImport(await prepareExport(result.runs).blob.text(),[]),result.runs);assert.notDeepEqual(runs,original);
});
test('redaction preserves benign false, zero, empty, array ordering, object keys and text resembling HTML',()=>{
  const run=fixture(1).runs[0];run.spans[0].input=JSON.parse('{"__proto__":{"keep":0},"ok":[null,false,0,""],"token_count":4,"text":"<script>literal</script>"}');
  const result=redactRuns([run]);assert.equal(result.count,0);assert.ok(jsonEqual(result.runs,[run]));assert.equal({}.keep,undefined);
});
test('custom error field masks payload keys while protecting the required span error object',()=>{
  const run=fixture(1).runs[0];run.spans[0].status='error';run.spans[0].error={message:'Bearer example-value',details:{error:'sensitive payload'}};
  const result=redactRuns([run],['error','message']);assert.equal(result.runs[0].spans[0].error.message,'[REDACTED]');assert.equal(result.runs[0].spans[0].error.details.error,'[REDACTED]');
});
test('integration: local import → inspect/search → match/diff → redacted export/re-import → save/reload/delete',async()=>{
  const factory=new IDBFactory(),preview=load(otlp),run=preview.runs[0],b=structuredClone(run);b.id='variant';b.spans[1].output={found:false};
  const found=filterSpanSearch(buildSpanSearch(run.spans),{...EMPTY_FILTERS,query:'demo-only'});assert.equal(found.length,1);
  const pair=matchSpans(run,b).pairs.find(p=>p.a.id===found[0].id);assert.equal(compareSpanFields(pair.a,pair.b).output,'different');
  const exported=redactRuns([run,b]);const imported=parseImport(await prepareExport(exported.runs).blob.text(),[]);
  await saveRuns(imported.map(run=>({run,filename:'roundtrip.json'})),factory);assert.deepEqual((await restoreRuns(factory)).map(x=>x.run),imported);
  await deleteSavedRun(run.id,factory);assert.deepEqual((await restoreRuns(factory)).map(x=>x.run.id),['variant']);
});
for(const count of [1000,10000])test(`large-data integration ${count} nested spans keeps search, last selection, insights, matching and export`,async()=>{
  const value=fixture(count,'chain'),run=parseImport(JSON.stringify(value),[])[0],index=buildSpanSearch(run.spans);
  assert.equal(filterSpanSearch(index,{...EMPTY_FILTERS,query:`รายการ ${count-1}`})[0].id,`s${count-1}`);
  assert.equal(runInsights(run).repeatedTools.length,20);assert.equal(matchSpans(run,run).pairs.length,count);
  const factory=new IDBFactory();await saveRuns([{run,filename:'large.json'}],factory);assert.equal((await restoreRuns(factory))[0].run.spans.length,count);
  assert.equal(parseImport(await prepareExport([run]).blob.text(),[])[0].spans.length,count);
});
