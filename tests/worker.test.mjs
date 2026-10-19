import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFile } from '../src/import-client.ts';
import { fixture } from '../scripts/fixture.mjs';

test('worker boundary rejects extension/size before reading and small files keep preview semantics',async()=>{
  let reads=0;const file={name:'log.txt',size:1,text:async()=>{reads++;return '{}';}};
  await assert.rejects(inspectFile(file,[],new AbortController().signal),/\.json/);file.name='log.json';file.size=10*1024*1024+1;
  await assert.rejects(inspectFile(file,[],new AbortController().signal),/10 MiB/);assert.equal(reads,0);
  file.size=1;file.text=async()=>JSON.stringify(fixture(1));const preview=await inspectFile(file,[],new AbortController().signal);assert.equal(preview.spanCount,1);
});
test('cancelled worker terminates, ignores late result and cannot replace the new job',async()=>{
  const original=globalThis.Worker,instances=[];
  class WorkerMock{constructor(){instances.push(this);}postMessage(data){this.data=data;}terminate(){this.terminated=true;}}
  globalThis.Worker=WorkerMock;
  try{
    const old=new AbortController(),newer=new AbortController(),file={name:'large.json',size:600000};
    const first=inspectFile(file,['existing'],old.signal);old.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(instances[0].terminated,true);
    const next=inspectFile(file,[],newer.signal);instances[0].onmessage({data:{result:{format:'stale'}}});instances[1].onmessage({data:{result:{format:'new',runs:[],spanCount:0,warnings:[]}}});
    assert.equal((await next).format,'new');assert.equal(instances[1].terminated,true);assert.deepEqual(instances[0].data.ids,['existing']);
  }finally{globalThis.Worker=original;}
});
test('worker parse failures and load errors reject with cleanup; pre-aborted small reads never start',async()=>{
  const original=globalThis.Worker,instances=[];globalThis.Worker=class{constructor(){instances.push(this);}postMessage(){}terminate(){this.terminated=true;}};
  try{const file={name:'large.json',size:600000};let result=inspectFile(file,[],new AbortController().signal);instances[0].onmessage({data:{error:'bad fixture'}});await assert.rejects(result,/bad fixture/);assert.ok(instances[0].terminated);
    result=inspectFile(file,[],new AbortController().signal);instances[1].onerror();await assert.rejects(result,/Worker/);assert.ok(instances[1].terminated);
    const controller=new AbortController();controller.abort();let read=false;await assert.rejects(inspectFile({name:'small.json',size:1,text:async()=>{read=true;}},[],controller.signal),{name:'AbortError'});assert.equal(read,false);
  }finally{globalThis.Worker=original;}
});
