import { fixture } from '../scripts/fixture.mjs';
import { parseImport } from '../src/import.ts';
import { jsonEqual } from '../src/compare.ts';

// Runs against a disposable local origin; exercises React UI with browser File/IndexedDB APIs.
export async function runFlow() {
  const output=document.getElementById('flow-result'), report=[];
  const check=(value,message)=>{if(!value)throw new Error(message);report.push(message);output.textContent=`${report.length} checks: ${message}`;};
  const wait=async predicate=>{const end=performance.now()+15000;while(!predicate()){if(performance.now()>end)throw new Error('Timed out: '+predicate);await new Promise(resolve=>requestAnimationFrame(resolve));}};
  const button=text=>[...document.querySelectorAll('#root button')].find(el=>el.textContent.trim()===text);
  const click=async text=>{await wait(()=>button(text)&&!button(text).disabled);button(text).click();};
  const change=(element,value)=>{const setter=Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(element,value);element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));};
  const inject=value=>{const data=new DataTransfer();data.items.add(new File([JSON.stringify(value)],'qa-flow.json',{type:'application/json'}));const input=document.querySelector('input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));};
  const id=`flow-${Date.now()}`, a=fixture(1000,'chain',id),b=structuredClone(a);b.runs[0].id=`${id}-b`;b.runs[0].name='QA variant';b.runs[0].spans[0].output={ok:false};a.runs[0].spans[0].input={api_key:'example-only-secret',query:'needle-qa'};
  b.runs[0].spans[0].input=structuredClone(a.runs[0].spans[0].input);
  let captured; const originalURL=URL.createObjectURL, originalClick=HTMLAnchorElement.prototype.click;
  try {
    await wait(()=>button('เลือกไฟล์ JSON')&&!button('เลือกไฟล์ JSON').disabled);
    const count=document.querySelectorAll('.run-card').length;inject(a);await wait(()=>document.querySelector('dialog[open]'));
    check(document.querySelector('dialog').textContent.includes('1,000'),'import preview counts 1,000 spans');
    await click('ยกเลิกนำเข้า');await wait(()=>!document.querySelector('dialog[open]'));check(document.querySelectorAll('.run-card').length===count,'cancel import preserves workspace');
    inject(a);await wait(()=>document.querySelector('dialog[open]'));await click('ยืนยันนำเข้า');await wait(()=>document.querySelector('.run-context')?.textContent.includes(id)&&document.querySelector('.import-feedback')?.textContent.includes('บันทึกสำเร็จ'));
    check(document.querySelectorAll('.span-row').length===100,'timeline DOM bounded at 100 rows');
    change(document.getElementById('span-search'),'needle-qa');await wait(()=>document.querySelectorAll('.span-row').length===1);document.querySelector('.span-row').click();await wait(()=>document.querySelector('.details-content')?.textContent.includes('example-only-secret'));check(true,'search finds payload and inspect keeps original');
    await click('ล้างตัวกรองทั้งหมด');await wait(()=>document.querySelectorAll('.span-row').length===100);
    inject(b);await wait(()=>document.querySelector('dialog[open]'));await click('ยืนยันนำเข้า');await wait(()=>document.querySelector('.run-context')?.textContent.includes(`${id}-b`)&&button('เลือกไฟล์ JSON')&&!button('เลือกไฟล์ JSON').disabled);
    await click('เปรียบเทียบสองรัน');change(document.getElementById('compare-run-A'),id);change(document.getElementById('compare-run-B'),`${id}-b`);await wait(()=>document.querySelector('.matching'));
    change(document.querySelector('.matching select'),'0');await wait(()=>document.querySelector('.comparison-fields')?.textContent.includes('ต่างกัน'));check(document.querySelectorAll('.span-picker option').length<=204,'comparison bounds options and accepts structural pair');
    const checkbox=document.querySelector('.comparison>.check-label input');checkbox.click();await wait(()=>document.querySelector('.json-diff'));check(document.querySelector('.json-diff').textContent.includes('$'),'changed-only JSON diff shows paths');
    await click('ตรวจรันเดี่ยว');await click('ส่งออก JSON รันเดี่ยวที่เลือก');await wait(()=>document.querySelector('dialog textarea')?.value);check(!document.querySelector('dialog textarea').value.includes('example-only-secret'),'redacted export preview does not contain secret');
    URL.createObjectURL=blob=>{captured=blob;return originalURL.call(URL,blob);};HTMLAnchorElement.prototype.click=function(){};
    await click('ดาวน์โหลด JSON');await wait(()=>!document.querySelector('dialog[open]'));check(parseImport(await captured.text(),[])[0].id===`${id}-b`,'export produces valid re-importable schema v1 JSON');
    const exported=parseImport(await captured.text(),[])[0];exported.id=`${id}-roundtrip`;inject({schema_version:1,runs:[exported]});await wait(()=>document.querySelector('dialog[open]'));await click('ยืนยันนำเข้า');await wait(()=>document.querySelector('.run-context')?.textContent.includes(exported.id)&&button('เลือกไฟล์ JSON')&&!button('เลือกไฟล์ JSON').disabled);check(true,'exported JSON imports through preview and persists');
    const cards=[...document.querySelectorAll('.run-card')],target=cards.find(el=>el.textContent.includes(a.runs[0].name)&&el.textContent.includes('qa-flow.json'));target.click();await wait(()=>document.querySelector('.run-context')?.textContent.includes(id));check(document.querySelector('.details-content')?.textContent.includes('example-only-secret'),'export leaves workspace payload intact');
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('agent-debugger');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const saved=await new Promise(resolve=>{const tx=db.transaction('runs'),r=tx.objectStore('runs').get(id);tx.oncomplete=()=>resolve(r.result);});db.close();check(jsonEqual(saved.run,a.runs[0]),'real IndexedDB retains exact original run');
    // Delete only the three fixture IDs created by this run, through confirmation UI.
    for(const ownId of [id,`${id}-b`,exported.id]) {
      // Use provenance plus active context for exact fixture selection.
      const records=await new Promise((resolve,reject)=>{const r=indexedDB.open('agent-debugger');r.onsuccess=()=>{const d=r.result,tx=d.transaction('runs'),q=tx.objectStore('runs').getAll();tx.oncomplete=()=>{d.close();resolve(q.result);};};r.onerror=()=>reject(r.error);});
      const order=records.find(x=>x.run.id===ownId);if(!order)throw new Error('fixture missing');
      const matchingCards=[...document.querySelectorAll('.run-card')].filter(el=>el.querySelector('strong')?.textContent===order.run.name);
      let chosen;
      for(const candidate of matchingCards){candidate.click();await new Promise(resolve=>requestAnimationFrame(resolve));if(document.querySelector('.run-context code')?.textContent===ownId){chosen=candidate;break;}}
      if(!chosen)throw new Error('fixture card missing');chosen.closest('li').querySelector('.delete-run').click();await wait(()=>document.querySelector('dialog[open]'));
      if(ownId===id){await click('ยกเลิกลบ');await wait(()=>!document.querySelector('dialog[open]'));check(document.querySelector('.run-context code')?.textContent===id,'cancel delete preserves selection');chosen.closest('li').querySelector('.delete-run').click();await wait(()=>document.querySelector('dialog[open]'));}
      await click('ยืนยันลบ');await wait(()=>!document.querySelector('dialog[open]')&&button('เลือกไฟล์ JSON')&&!button('เลือกไฟล์ JSON').disabled);
    }
    check(document.querySelectorAll('.run-card').length===count,'confirmed deletion removes only QA fixtures');
    output.textContent=`PASS ${report.length} checks (file change/download simulated; IndexedDB real). ${report.join(' | ')}`;
  }catch(error){output.textContent=`FAIL after ${report.length}: ${error.message}`;console.error(error);}
  finally{URL.createObjectURL=originalURL;HTMLAnchorElement.prototype.click=originalClick;}
}
