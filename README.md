# Agent Debugger

เครื่องมือตรวจ agent trace บนเครื่องด้วย React + TypeScript + Vite นำเข้าไฟล์ ดู Timeline/JSON ค้นหา สรุปสิ่งที่ควรตรวจ เปรียบเทียบ A/B และส่งออกสำรองพร้อมปกปิดข้อมูล

**ไม่ต้องใช้ API key หรือบริการเสียเงิน** ไม่มีการเรียกโมเดล AI, backend สำหรับ log, login, analytics, CDN หรือการส่งไฟล์ออกนอกเครื่อง การแสดงขั้นตอน `model` เป็นเพียงการอ่าน log ตัวอย่างทั้งหมดเป็นข้อมูลจำลอง ไม่มีข้อมูลลับจริง

## เริ่มใช้งาน

ใช้ Node.js 24 ขึ้นไปและ npm (ทดสอบด้วย v24.16.0 / Windows x64) ติดตั้ง dependencies ครั้งแรกต้องใช้อินเทอร์เน็ต หลังติดตั้งแล้วใช้กับไฟล์ local ได้

```powershell
npm ci
npm run dev
```

เปิด **http://127.0.0.1:5173/** หยุด server ด้วย Ctrl+C ไม่เปิด index.html ด้วยการดับเบิลคลิก `dev`/`preview` ผูกกับ loopback และ strictPort หากพอร์ตไม่ว่างจะหยุดแจ้ง error

```powershell
npm test
npm run typecheck
npm run build
npm run preview
node scripts/benchmark.mjs
node scripts/benchmark-ui.mjs
```

`build` สร้างเว็บ static ใน `dist` ไม่มีการ deploy อัตโนมัติ รักษา `schema_version: 1` เดิมและไม่เพิ่ม dependency

## ลองฟีเจอร์

1. กด **โหลดรันตัวอย่าง** หรือ **เลือกไฟล์ JSON** (.json ไม่เกิน 10 MiB) ไฟล์จริงจะมี preview แสดงรูปแบบ จำนวน Run/Span และคำเตือน ก่อนกดยืนยันนำเข้า ยกเลิกได้โดยไม่เพิ่มหรือบันทึกข้อมูล ปุ่มยกเลิกการอ่านหยุด Worker และทิ้งผลลัพธ์เก่า
2. เลือกรัน เปิด **สิ่งที่ควรตรวจ** เพื่อดู error, ขั้นตอนที่ยังไม่จบ, 5 ขั้นตอน/Tool ที่นานที่สุด และ Tool ชื่อเดิมที่เรียกซ้ำ กดรายการเพื่อเปิดรายละเอียด ใช้หน้ารายการดู error/การเรียกซ้ำทั้งหมด ข้อสังเกตไม่ได้ยืนยันว่าเป็น bug หรือค้าง
3. ค้น substring แบบไม่แยก case ใน ID/ชื่อ/type/keys และค่า input/output/error รวมภาษาไทย กรอง status และ type แบบ AND การกรองไม่เปลี่ยนข้อมูลหรือแกนเวลา Timeline แสดง 100 แถวต่อหน้า ใช้ ↑ ↓ Home End ข้ามหน้าได้ และกด **ไปขั้นตอนที่เลือก** หลังล้างตัวกรอง
4. เปิด **เปรียบเทียบสองรัน** เลือกรัน A/B แล้วเลือกคู่แนะนำหรือเลือกแต่ละฝั่งเอง ค้นขั้นตอนด้วยชื่อ/ID/type ได้ ตัวเลือกแสดงสูงสุด 100 รายการแรกและรายการที่เลือกเพื่อไม่สร้าง DOM หลายหมื่น option
5. คู่แนะนำใช้ type/ชื่อตรงกัน/สาย parent/ลำดับชื่อซ้ำ เรียง siblings ตามเวลาเริ่ม เวลาเท่ากันใช้ลำดับในไฟล์ จากนั้นจับคู่ที่เหลือด้วยชื่อ/type/ความลึกตามลำดับในไฟล์ ไม่อาศัย ID ข้ามรันและไม่ยืนยันว่าทำงานเหมือนกัน รายการจับคู่ไม่ได้แสดงจำนวนและ 100 รายการแรก ค้นรายการอื่นได้ในตัวเลือกแต่ละฝั่ง
6. **แสดงเฉพาะส่วนที่เปลี่ยน** ซ่อน field ที่เท่ากัน และแสดง path/ค่า A/B ของ input/output/error ที่เปลี่ยน (สูงสุด 200 ตำแหน่ง มีข้อความเตือนเมื่อเกิน) ปิดตัวเลือกเพื่อดู payload เต็ม object key order ไม่มีผล array order มีผล และ null/false/0/ข้อความว่างยังแยกกัน เวลาแสดง B − A; งานไม่จบยังไม่มีผลต่างเวลา
7. ส่งออกเลือก **ปกปิดข้อมูลตามกฎ** ได้ (เปิดเริ่มต้น) เพิ่มชื่อ field คั่นด้วย comma ตรวจ preview และตำแหน่งที่ปกปิดก่อนดาวน์โหลด การส่งออกใช้รันเต็มแม้มีตัวกรอง นำกลับเข้าได้ถ้า run ID ไม่ซ้ำกับ workspace ปลายทาง
8. เลือกธีม **ตามระบบ/สว่าง/มืด** ด้านบน จำค่าใน localStorage รองรับคีย์บอร์ด focus ring, reduced motion และหน้าจอเล็ก แผงรายละเอียดปรับความกว้างได้บน desktop; JSON ยุบ/ขยาย/คัดลอกได้ พร้อมจำกัดข้อความเริ่มต้น 24,000 ตัวอักษรและปุ่มแสดงทั้งหมด

## ไฟล์และ OTLP JSON ที่รองรับ

- **Agent Debugger v1**: นำเข้า/ส่งออกตาม `schema/agent-log-v1.schema.json` และ validator เดิม ไม่เปลี่ยนความหมายของข้อมูล
- **OpenTelemetry OTLP JSON**: เฉพาะ body ของ `ExportTraceServiceRequest` ที่มี `resourceSpans[].scopeSpans[].spans[]` แบบ lowerCamelCase อ่านจากไฟล์เท่านั้น ไม่มีการเชื่อมต่อ Collector/API ไม่รองรับ binary Protobuf, NDJSON หรือ metrics/logs
- ตรวจจาก [OTLP JSON encoding](https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding), [Span/Status protobuf](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/trace/v1/trace.proto) และ [Status semantics](https://opentelemetry.io/docs/specs/otel/trace/api/#set-status) ไม่ตี `UNSET` ว่า success

OTLP ต้องมี traceId hex 32 หลัก, spanId/parentSpanId hex 16 หลัก, ชื่อและเวลาเริ่ม/จบเป็น Unix nanoseconds แบบ decimal string (หรือ safe integer) ที่มากกว่าศูนย์ และ **status.code ที่บันทึกไว้เป็น 1 (OK) หรือ 2 (ERROR)** ทุก span ค่าที่ไม่ระบุ/default/UNSET ไม่สามารถแทนด้วย v1 จึงปฏิเสธทั้งไฟล์ ไม่สร้างสถานะ/เวลาจบขึ้นเอง หากเครื่องมือ export ใช้ UNSET ต้องใช้ไฟล์ v1 ที่บันทึกสถานะจริง หรือ instrumentation ที่บันทึกสถานะจริงก่อนส่งออก ห้ามเปลี่ยนเลขเพื่อทำให้ validation ผ่านโดยไม่มีหลักฐาน

หนึ่ง trace ต้องมี root เดียวและ parents ครบ root เป็นแหล่งชื่อ เวลา และสถานะของ Run โดยตรง ไม่รวมสถานะลูกเป็นสถานะรัน แต่ละ child ต้องอยู่ภายในช่วง parent/root ตามกติกา v1; OTLP ที่ถูกต้องแต่มี child จบหลัง parent จะนำเข้าไม่ได้ ไม่มีการตัดหรือขยับเวลา/แก้ parent ID ให้

ลด nanoseconds เป็น milliseconds โดยปัดเศษลงพร้อมคำเตือน ซึ่งอาจทำให้ช่วงเวลาสั้นมากแสดง 0 ms รูปแบบทั่วไปของ OTLP span ใช้ type `task` (ไม่ได้เดาว่าเป็น Tool/Agent); กำหนดชัดเจนได้ด้วย attribute `agent_debugger.type` ค่าใน enum v1

input/output เริ่มเป็น null เมื่อไม่มีข้อมูล ใช้ custom attributes `agent_debugger.input`/`agent_debugger.output` เพื่อเก็บ AnyValue โดยตรง: string/bool/finite double/int/array/kvlist รองรับ int64 แบบ string เพื่อไม่เสีย precision ไม่รองรับ bytesValue และ kvlist key ซ้ำใน payload เหล่านี้ AnyValue ซ้อนสูงสุด 100 ชั้น

error.message ใช้ status.message ถ้ามี มิฉะนั้นแสดงชื่อรหัส `OTLP STATUS_CODE_ERROR` พร้อมคำเตือน ไม่แต่งคำอธิบายเหตุการณ์ agent_name ใช้ `resource.attributes[service.name]` ของ root หรือป้าย “OTLP (ไม่ระบุ service.name)”

metadata, events, links และ attributes อื่นไม่อยู่ใน schema v1 จึงไม่เก็บในการแปลง/ส่งออก มีคำเตือนก่อนยืนยัน **เก็บไฟล์ต้นฉบับไว้** ดู [public/examples/otlp.json](public/examples/otlp.json) ซึ่งเป็น fixture ปลอดข้อมูลลับ เตรียมไฟล์จาก body ของ exporter ในเครื่อง รวบรวม spans ของแต่ละ trace ให้ครบ และอย่าตัด parents เพื่อแบ่งไฟล์

## IndexedDB และการสำรอง

เก็บเฉพาะ browser/profile/origin นี้ ตัวอย่างอยู่ในหน่วยความจำและไม่บันทึกอัตโนมัติ รันจากไฟล์บันทึกเมื่อยืนยันนำเข้าและ transaction complete; ถ้าล้มเหลวมีป้ายเตือนและปุ่มลองบันทึกใหม่ ยัง inspect/ส่งออกได้แต่จะหายเมื่อ refresh

ฐาน `agent-debugger` อัปเกรดจาก IndexedDB v1 เป็น v2 ใน **versionchange transaction เดียว**: ตรวจ snapshot `workspace/runs` เดิมครบทุก entry ก่อนย้ายเป็น object store `runs` แยก record ตาม run ID และ metadata ลำดับ IDs ใน `workspace` การ save เขียนเฉพาะรันใหม่ การ delete ลบเฉพาะรันนั้น บวก metadata ขนาดเล็ก แต่ยังอ่าน/ตรวจข้อมูล saved workspace ทุกครั้งเพื่อรักษา integrity

ถ้าข้อมูลเดิมเสีย version/layout ไม่รองรับ หรือ transaction ล้มเหลว migration จะ abort รวม schema change ทั้งหมด คงฐาน v1 และ snapshot เดิม ไม่ล้างฐาน ไม่ซ่อม/ทับอัตโนมัติ การ restore ล้มเหลวไม่แสดงชุดข้อมูลบางส่วน ปิดแท็บที่ขวาง upgrade แล้ว reload เพื่อลองใหม่ ไม่ควรล้างข้อมูลเว็บไซต์หากไม่มีสำรอง

run ID ซ้ำปฏิเสธทั้งไฟล์/transaction ไม่มี overwrite การลบต้องยืนยัน dialog ที่มีชื่อและ ID และรอ commit ก่อนนำออกจาก UI ถ้าล้มเหลวคงข้อมูล/selection ไม่มี undo; export สำรองก่อนลบ หลายแท็บไม่ sync UI อัตโนมัติ ใช้แท็บเดียวหรือ reload ก่อนทำงานต่อ

IndexedDB ไม่ใช่ไฟล์สำรอง การล้างเว็บไซต์ private mode นโยบาย browser พื้นที่เต็ม eviction หรืออุปกรณ์เสียอาจทำให้ข้อมูลหายหรือบันทึกไม่ได้ เก็บไฟล์ต้นฉบับและส่งออกสำรองเป็นระยะ ไม่รับประกันการรอดจาก crash/power loss

## การปกปิดข้อมูล

ทำบนสำเนาในหน่วยความจำ ไม่มีการแก้ Workspace/IndexedDB ตรวจชื่อ field แบบไม่แยก case และละเครื่องหมายคั่น เช่น authorization, api_key/apiKey, access_token, refresh_token, password, client_secret, private_key รวม field เพิ่มที่ผู้ใช้ระบุ ตรวจข้อความ Bearer, รูปแบบ key บางชนิด, JWT และ private key ที่ชัดเจน แทนค่าเป็น `[REDACTED]` โดยยังเป็น JSON v1 ที่นำเข้าได้

โครงสร้าง id/parent_id/type/status/timestamps ไม่ถูกเปลี่ยน ปกปิดเฉพาะชื่อที่แสดงและ payload/error fields เพื่อรักษาการนำกลับเข้า ไม่รับประกันว่าจะพบข้อมูลลับทุกชนิด เช่นรูปแบบเฉพาะองค์กรหรือข้อมูลใน ID/ชื่อ field เอง Preview แสดง 24,000 ตัวอักษรแรกและตำแหน่งที่ปกปิดสูงสุด 100 รายการ จำนวนทั้งหมดแสดงแยก ไม่มีการส่งข้อมูลไปตรวจภายนอก

## ประสิทธิภาพและการตรวจสอบ

[docs/performance-before.json](docs/performance-before.json) และ [docs/performance-after.json](docs/performance-after.json) วัด helper ใน Node: 1,000/10,000 spans ทั้ง roots และสาย parent ลึก ตรวจ parse/validate/index/search/depth; fixture สร้างด้วย `scripts/fixture.mjs` โดยไม่เก็บไฟล์ใหญ่ใน repository

10,000 spans หลังปรับ parse/validate median 54.60 ms (roots), 65.06 ms (chain), search 0.37–0.38 ms และ depth 1.29–2.80 ms การย้ายอ่าน/parse/validate ไฟล์ตั้งแต่ 512 KiB ไป module Web Worker จึงช่วยย้ายงานหนักออกจาก main thread ไม่ได้ทำให้การคำนวณเหล่านี้เร็วขึ้น; browser ที่ไม่มี Worker จะใช้ main-thread fallback Search ใช้ดัชนีที่สร้างครั้งเดียวต่อรันและไม่ใช้ Worker เพราะผลวัดยังต่ำ

[docs/performance-ui.json](docs/performance-ui.json) วัด React `renderToString` ของ Timeline จริงจาก Git HEAD เดิมเทียบ working copy บน dependency เดียวกัน 7 รอบหลัง warmup 2 รอบ: 1,000 spans median 110.97 → 41.20 ms; 10,000 spans 1,423.66 → 28.90 ms จำนวนแถว 10,000 → 100 เป็นการวัด CPU/การสร้าง HTML ใน Node **ไม่ใช่เวลาสร้าง DOM, React client render, ความหน่วงการพิมพ์ หรือ browser paint** ไม่ควรตีเป็นอัตราความลื่นจริงของ UI

baseline dev-browser วัด dispatch → Timeline DOM ของ 10,000-deep fixture 1 รอบได้ 1,917.5 ms ก่อนแก้ (10,000 แถว) เป็น DOM-ready ไม่ใช่ paint การตรวจหลังแก้ยืนยัน DOM ไม่เกิน 100 แถวและค้น/เลือก s9999 ได้ ไม่ใช้ตัวเลขต่างขอบเขตกันเพื่ออ้าง speedup ฝั่ง browser ดู [docs/readiness-qa.md](docs/readiness-qa.md)

ข้อจำกัด: เพดานนำเข้า 10 MiB, ไม่ streaming; export อาจใหญ่เกินและนำกลับตรง ๆ ไม่ได้ การ restore/save/delete ยัง clone และ validate saved workspace ทั้งชุด payload ที่ใหญ่/ลึกมากอาจชนหน่วยความจำหรือ stack ของ JSON/structuredClone การ stringify/redaction/export ยังอยู่ main thread มีข้อความตัดทอนใน JSON/diff แต่ข้อมูลส่งออกยังเต็ม ไม่รับรอง workspace หลายรันขนาดใหญ่มากทุกแบบ

Node tests ครอบคลุมของเดิมและ adapter/insights/matching/diff/redaction/Worker/migration รวม integration import → inspect/search → compare → export/re-import และ save → reload → delete พร้อมข้อมูล 1,000/10,000-deep spans ใช้ fake-indexeddb ที่ระดับ tests

เปิด `http://localhost:5173/tests/browser.html` ขณะ `npm run dev` เพื่อใช้ **หน้า QA เฉพาะ dev** บน origin แยกจาก 127.0.0.1 (อย่าใช้ origin ที่มีรันจริง) ปุ่มทดสอบ flow ใช้ React UI กับ File/DataTransfer และ IndexedDB จริง แต่จำลอง file-change/download ไม่ใช่ OS picker/download manager สร้างและลบเฉพาะ fixtures ของตัวเอง ไม่รวมหน้านี้ใน production build

หลักฐาน Day 1–7 เก็บเป็นประวัติใน DAY*.md และ docs/day*-checks.json พฤติกรรมปัจจุบันให้ยึด README นี้และผล QA ล่าสุด การเผยแพร่ทำแยกจากการพัฒนาบนเครื่องตามคำสั่งผู้ใช้ โดยส่งเฉพาะ source และ static build ไม่รวมข้อมูล IndexedDB หรือไฟล์ log ที่นำเข้า

## รูปแบบ JSON ของเว็บนี้ — schema_version 1

นี่คือ **รูปแบบเฉพาะ Agent Debugger** ไม่ใช่รูปแบบมาตรฐานของทุก Agent SDK รองรับไฟล์ v1 โดยตรง และมีตัวแปลง OTLP JSON แบบมีข้อจำกัดตามหัวข้อด้านบน

ไฟล์หนึ่งมี envelope และรันได้หลายรายการ:

```json
{
  "schema_version": 1,
  "runs": [
    {
      "id": "run-demo",
      "name": "ตัวอย่างงานที่กำลังทำ",
      "agent_name": "Demo Agent",
      "status": "running",
      "started_at": "2026-10-13T09:00:00+07:00",
      "ended_at": null,
      "spans": [
        {
          "id": "root",
          "parent_id": null,
          "type": "agent",
          "name": "Run demo task",
          "status": "running",
          "started_at": "2026-10-13T09:00:00+07:00",
          "ended_at": null,
          "input": "ข้อมูลสมมติ",
          "output": null,
          "error": null
        }
      ]
    }
  ]
}
```

ฟิลด์ทั้งหมดตามตัวอย่าง **จำเป็นต้องมี**; ไม่รับฟิลด์ที่ไม่ได้ประกาศในระดับ envelope/run/span/error การเพิ่ม format ใช้ schema version ใหม่ ส่วน payload ใน input/output/details เป็น JSON อิสระ

| ฟิลด์รัน | ความหมาย |
| --- | --- |
| `id` | string ที่ไม่ว่าง ไม่ซ้ำใน document (และชุดตัวอย่างที่รวมกัน) |
| `name`, `agent_name` | string ที่ไม่ว่าง ใช้แสดงชื่อและ agent |
| `status` | `running`, `success`, `error`, `cancelled` |
| `started_at` | เวลาเริ่มที่ถูกต้อง พร้อม timezone |
| `ended_at` | เวลาเสร็จ หรือ `null` เมื่อยังทำอยู่ |
| `spans` | array ของขั้นตอน; ว่างได้ |

| ฟิลด์ขั้นตอน | ความหมาย |
| --- | --- |
| `id` | string ที่ไม่ว่าง ไม่ซ้ำ **ภายในรัน**; ต่างรันใช้ ID เดียวกันได้ |
| `parent_id` | ID ขั้นตอนในรันเดียวกัน หรือ `null` สำหรับขั้นตอนระดับบนสุด |
| `type` | `agent`, `task`, `prompt`, `model`, `tool` |
| `name` | string ที่ไม่ว่าง เช่น ชื่อ tool call |
| `status` | `running`, `success`, `error`, `cancelled` |
| `started_at`, `ended_at` | เวลาเริ่ม/จบตามกติกาเดียวกับรัน |
| `input`, `output` | JSON value ใดก็ได้; `null` เมื่อไม่มีข้อมูล |
| `error` | `null` หรือ object `{ "message": "...", "code": "...", "details": ... }` |

`type` หมายถึง `agent` = งาน agent, `task` = กลุ่มงาน/งานย่อย, `prompt` = prompt ที่ถูกบันทึก, `model` = การเรียกโมเดลที่ถูกบันทึก, `tool` = tool call ตัวเว็บแสดงข้อมูลตาม log เท่านั้น ไม่ดำเนินการขั้นตอนเหล่านี้

`status` หมายถึง `running` = ยังไม่จบ, `success` = สำเร็จ, `error` = จบด้วยข้อผิดพลาด, `cancelled` = ยกเลิกและจบแล้ว สถานะรันเป็นข้อมูลที่ผู้สร้าง log ส่งมา ไม่คำนวณจากสถานะลูกอัตโนมัติ: รันสำเร็จอาจมี tool error ที่จัดการได้

`error.message` จำเป็นและไม่ว่าง; `code` เป็น string ไม่ว่างถ้ามี และ `details` เป็น JSON ถ้ามี ขั้นตอนสถานะ `error` ต้องมี error object; สถานะอื่นต้องใช้ `error: null` รันไม่มีฟิลด์ error เพิ่มเติม ดูรายละเอียดจาก spans

### ข้อมูลที่ไม่มี

- ใช้ `null` แทนไม่มีข้อมูล และห้ามละฟิลด์ที่จำเป็น
- `0`, `false`, `""`, `[]`, `{}` เป็นค่าจริง แสดงตามเดิม ไม่เปลี่ยนเป็น "ไม่มีข้อมูล"
- ใน v1 ค่า JSON `null` ใน input/output หมายถึงข้อมูลที่ไม่มี ไม่มีเครื่องหมายแยกสำหรับ payload ที่เป็น null โดยเจตนา
- Prompt เก็บใน input ของขั้นตอน `prompt`; tool arguments/result เก็บใน input/output ของขั้นตอน `tool`

### เวลา งานซ้อน และงานที่ยังไม่จบ

- ใช้ ISO 8601 แบบ `YYYY-MM-DDTHH:mm:ss[.SSS]Z` หรือ timezone `±HH:mm` เช่น `+07:00` เศษวินาที 1–3 หลัก ใช้ปี 4 หลัก offset สูงสุด ±14:00 ไม่รับวันที่เปล่า เวลาไม่มี timezone, 24:00, leap second หรือวันที่ไม่มีจริง
- `running` ต้องมี `ended_at: null`; ทุกสถานะที่จบแล้วต้องมีเวลา ended_at และต้องไม่น้อยกว่า started_at ระยะเวลา 0 ยอมรับได้
- ขั้นตอนต้องไม่เริ่มก่อนรันหรือ parent; ถ้ารันหรือ parent จบแล้ว ลูกต้องจบแล้วและไม่เกินเวลาจบของ container
- Parent อยู่ก่อนหรือหลังลูกใน array ได้ ต้องอยู่รันเดียวกันและห้าม self-parent/วงวน มี root ได้หลายขั้นตอน
- พี่น้องมีเวลาทับกันได้ และ parent มีเวลาครอบลูกได้ ไม่บังคับเรียงทำทีละขั้น
- เวลารวมรัน = `ended_at - started_at` **ไม่บวกเวลาทุก span** เพราะจะนับงานขนานและ parent ซ้ำ
- งานที่ยังไม่จบแสดงว่า "ยังไม่จบ" ไม่อ้างระยะเวลาที่เสร็จแล้ว แกนไทม์ไลน์ของรัน running สิ้นสุดที่ timestamp ล่าสุดที่มีใน log (max ของ started_at และ ended_at ที่มี) เส้นประลากถึงขอบ snapshot นี้ ไม่มีการใช้เวลาปัจจุบันหรือสมมติเวลาจบ
- เวลาในรายละเอียดแสดง ISO ต้นฉบับพร้อม timezone; การเปรียบเทียบคำนวณเป็น instant เดียวกันหลังแปลง offset

### วิธีตรวจข้อมูล

`schema/agent-log-v1.schema.json` เป็น JSON Schema Draft 2020-12 สำหรับโครงสร้าง ชนิดข้อมูล enums และกติกา status/end/error แต่ JSON Schema เพียงอย่างเดียวไม่ตรวจ ID/กราฟ/ลำดับเวลา และเครื่องมือตรวจบางตัวไม่ assert `format: date-time`

`src/validate.ts` จึงตรวจเพิ่มเติมก่อนแสดงผล:

1. ตรวจ envelope/version/required fields/ชนิดข้อมูลและค่าที่อนุญาต
2. ตรวจวันปฏิทิน เวลา timezone และ end ไม่ก่อน start
3. ใช้ Set ตรวจ run ID ซ้ำ และ Map ตรวจ span ID ซ้ำในแต่ละรัน
4. ตรวจ parent มีอยู่ในรันเดียวกัน แล้วเดินสาย parent ด้วย visiting/checked sets เพื่อตรวจวงวนโดยไม่ใช้ recursive graph traversal
5. ตรวจช่วงเวลาของ span อยู่ในรันและ parent; ไม่ห้ามงานที่ทับกัน

เมื่อผิดจะแจ้งตำแหน่งฟิลด์และเหตุผล และไม่แสดง dataset ที่ตรวจไม่ผ่าน หากตัวอย่างหนึ่งไฟล์ผิดจะเข้า error state ทั้งชุด แก้ไฟล์แล้วกด "ลองโหลดใหม่" ได้ ไม่แสดงข้อมูลบางส่วนที่อาจทำให้เข้าใจผิด
