# Agent Debugger — รุ่นแรก

เว็บตรวจ agent log บนคอมส่วนตัวด้วย React + TypeScript + Vite นำเข้า JSON, ดูไทม์ไลน์และรายละเอียด, ค้นหา/กรอง, เปรียบเทียบสองรัน, บันทึกในเบราว์เซอร์, ลบ และส่งออกสำรอง ประมวลผลข้อมูลในเบราว์เซอร์ ไม่มี AI API, backend สำหรับ log, login หรือ live logs และไม่ได้เผยแพร่ออนไลน์

รองรับเฉพาะ **Agent Debugger schema_version: 1** ยังไม่มีตัวแปลง log จากทุก Agent SDK การแสดงขั้นตอน model เป็นการอ่านข้อมูลใน log ไม่ได้เรียกโมเดลจริง ตัวอย่างทั้งหมดเป็นข้อมูลสมมติ

สถานะหลัง Day 7: **พร้อมใช้ภายในขอบเขตที่ตรวจ** tests 120/120, TypeScript และ build ผ่าน; ดาวน์โหลดจริงและนำ bytes กลับเข้า QA ที่ว่างแล้วเทียบครบทุกฟิลด์ 3 รัน/15 spans; ตรวจ log 1,000/10,000 spans ได้ Picker/native confirm จริงยังไม่ได้ตรวจ ดู [DAY7.md](DAY7.md) สำหรับหลักฐาน ข้อจำกัด และ checklist 10–15 นาที

## ติดตั้งและเปิดเว็บ

ใช้ **Node.js 24 ขึ้นไป** และ npm (ตรวจด้วย Node v24.16.0 บน Windows) ติดตั้ง dependencies ต้องใช้อินเทอร์เน็ตครั้งแรก หลังติดตั้งแล้วเว็บใช้ไฟล์ local ไม่มี CDN, font ภายนอก, analytics หรือ API ภายนอก

~~~powershell
cd "C:\Users\Wai\Desktop\Self Project\Agent Debugger"
npm ci
npm run dev
~~~

เปิด **http://127.0.0.1:5173/** ไม่เปิด index.html ด้วยการดับเบิลคลิก หยุด server ที่คุณเปิดด้วย Ctrl+C Dev/preview ผูกกับ loopback 127.0.0.1 และใช้ strictPort หากพอร์ตถูกใช้จะหยุดแจ้ง error ไม่เปลี่ยนพอร์ตเงียบ ๆ

Package scripts จริง:

~~~powershell
npm test
npm run typecheck
npm run build
npm run preview
~~~

preview ใช้ dist/ จาก build และ URL :5173 เดียวกับ dev ให้หยุด dev ที่คุณเปิดก่อนเปิด preview Vite dev ใช้ local WebSocket สำหรับอัปเดตไฟล์ระหว่างพัฒนา ไม่ใช่ live agent logs ไม่มี deployment ในรุ่นนี้

**เปิดข้อมูลเดิม:** ใช้ browser, profile และ **host/port เดิม** ทุกครั้ง IndexedDB ของ http://127.0.0.1:5173 ต่างจาก localhost:5173 และต่างพอร์ตเป็นคนละ origin ไม่ซิงก์ข้ามเครื่องหรือข้าม profile

## ทดลองด้วยตัวอย่างสามไฟล์

กด **โหลดรันตัวอย่าง** เพื่อทดลองโดยไม่บันทึกอัตโนมัติ หรือเริ่มจากรายการว่างแล้วใช้ **เลือกไฟล์ JSON** นำเข้าทีละไฟล์เพื่อทดลองการบันทึก:

| ไฟล์ใน public/examples | ข้อมูลที่ควรเห็น |
| --- | --- |
| success.json | 1 รัน, 5 spans, สำเร็จ, เวลารวม 12 s |
| tool-error.json | 1 รัน, 4 spans, tool timeout ETIMEDOUT, เวลารวม 8 s |
| parallel-nested.json | 1 รัน, 6 spans, งานซ้อน/พร้อมกัน, ยังไม่จบ |

รวม 3 รัน/15 spans หากโหลดตัวอย่างก่อนแล้วนำเข้าไฟล์เดียวกัน จะชน ID ตามกติกาเดิม การ reload ทำให้ตัวอย่างที่ยังอยู่เฉพาะหน่วยความจำหาย แต่ไม่ลบรันที่บันทึกสำเร็จ

สำหรับ QA ให้ใช้ origin แยก เช่น npm run dev -- --port 5237 แล้วเปิด http://127.0.0.1:5237 ตรวจว่ารายการเริ่มว่าง ใช้เฉพาะข้อมูลสมมติ ไม่ล้างข้อมูลเว็บไซต์ของ workspace จริง

## วิธีใช้งานตั้งแต่นำเข้าถึงสำรอง

1. **นำเข้า:** เลือกไฟล์ .json ครั้งละหนึ่งไฟล์ สูงสุด **10 MiB = 10,485,760 bytes** ตรวจขนาดก่อนอ่านและตรวจทั้งไฟล์ก่อนเพิ่มข้อมูล รองรับ UTF-8 BOM และ .JSON ไม่พึ่ง MIME type เมื่อนำเข้าสำเร็จในโหมดเดี่ยว เลือกรันแรกของไฟล์ใหม่; runs ว่างตรวจผ่านโดยไม่เปลี่ยน selection
2. **ตรวจไทม์ไลน์:** เลือกรันทางซ้าย แล้วเลือกขั้นตอนในไทม์ไลน์เพื่อดู ID/parent/เวลา/input/output/error งานซ้อนอยู่บนแกนเวลาเดียวกัน ความลึกอิง parent ระยะเยื้องแสดงสูงสุด 5 ระดับ สรุปเวลารวมใช้ end−start ไม่บวก spans ข้อความ HTML/โค้ดแสดงเป็น text เท่านั้น
3. **ค้นหา/กรอง:** ค้น substring แบบไม่แยก case รองรับไทยใน id/name/type/input/output/error รวม keys และ scalar values ที่ซ้อน; status/type ใช้ select แยก ทั้งสามเงื่อนไขรวมแบบ AND กรองเฉพาะแถว ไม่เปลี่ยนข้อมูล แกนเวลา ความลึก หรือจำนวนรวม หากขั้นตอนที่เลือกถูกซ่อน รายละเอียดยังอยู่และมีปุ่มล้างตัวกรองกลับไปดู
4. **เปรียบเทียบ:** กดเปรียบเทียบสองรัน เลือกรัน A/B คนละ ID แล้วเลือกขั้นตอนเอง ไม่ auto-match แม้ชื่อหรือ span ID เหมือนกัน แสดงผลต่าง B−A และความเหมือน/ต่างระดับฟิลด์ สลับ A/B ย้าย steps ตามกัน เปลี่ยนรันฝั่งเดียวล้าง step ฝั่งนั้น กลับโหมดเดี่ยวคืนรัน/step/filters เดิม
5. **บันทึก:** รันที่นำเข้าผ่านจะบันทึกใน IndexedDB **อัตโนมัติทั้งไฟล์ใน transaction เดียว** ผลนำเข้าแยกจากผลบันทึก รอข้อความบันทึกสำเร็จก่อน reload หากล้มเหลวยังตรวจ/ส่งออกได้และมีลองบันทึกใหม่ รันที่ยังไม่บันทึกจะหายเมื่อ reload ตัวอย่างไม่บันทึกอัตโนมัติ คืนข้อมูลจะตรวจทั้ง snapshot ก่อนแสดง และเลือก first saved run ไม่บันทึก filters/selection/A-B
6. **ส่งออก:** ใช้ส่งออก JSON รันเดี่ยวที่เลือก, ทุกรันใน workspace หรือรัน A/B เก็บรันเต็มรวม spans ที่กรองออกและค่าจริงทุกชนิด ไม่รวม filename/storage metadata ใช้ envelope v1 เดิม ส่งออกก่อนลบและเก็บไฟล์ต้นฉบับไว้ ปุ่มแจ้งเริ่มดาวน์โหลด ให้ตรวจว่าไฟล์เกิดจริงใน Downloads และเปิด/นำเข้าสำเนาใน QA ที่ว่างเพื่อยืนยันสำรอง

ใช้คีย์บอร์ดกับปุ่ม/input/select ได้ มี focus ring และสถานะข้อความประกอบสี จอแคบเรียง panels ลงด้านล่าง ค้น query ไม่ได้รวม status/parent/timestamps หรือข้อความ placeholder ที่เว็บสร้างขึ้น ค่า null แสดงว่าไม่มีข้อมูล ต่างจาก 0, false และข้อความว่าง

## กติกาสำคัญ

- **ID ซ้ำ:** run ID ต้องไม่ซ้ำในไฟล์หรือรายการปัจจุบัน รวมตัวอย่างและ restored runs ชนแม้คนละชื่อไฟล์ก็ปฏิเสธทั้งไฟล์ ไม่มี overwrite/merge Span ID ซ้ำไม่ได้ภายในรัน แต่ต่างรันใช้ ID เดียวกันได้ Parent ต้องอยู่ในรันเดียวกันและห้ามวน ไฟล์ผิดไม่เปลี่ยนรายการ selection filters หรือ A/B
- **ไฟล์เกินขนาด:** มากกว่า 10 MiB ปฏิเสธก่อนอ่าน ขนาดเท่าเพดานรับได้ แบ่งเป็นหลายไฟล์โดยแต่ละรันและ spans ยังครบ ID ไม่ซ้ำข้ามไฟล์ อย่าตัด spans จน parent หาย ไฟล์ส่งออกอาจเกินเพดาน; หากรันเดียวใหญ่เกินยังไม่มีตัวช่วยแบ่ง/streaming และนำกลับตรง ๆ ไม่ได้
- **ขั้นตอนยังไม่จบ:** running ต้องมี ended_at: null แสดง “ยังไม่จบ” ไทม์ไลน์สิ้นสุดที่เวลาล่าสุดที่มีใน log ไม่ใช้เวลาปัจจุบัน หากเปรียบเทียบ steps ครบแต่ฝั่งใดยังไม่จบ ระยะเวลาแสดง “ยังเปรียบเทียบไม่ได้ — ขั้นตอนยังไม่จบ” หากยังเลือกไม่ครบแสดงสถานะเลือกไม่ครบ ค่าที่เป็น null ของ input/output/error ยังเทียบตามกติกา JSON เดิม
- **ความเท่ากันของ JSON:** object key order ไม่มีผล array order มีผล strings เทียบตรงตัว ไม่ trim/เปลี่ยน case และแยก null/0/false/ข้อความว่าง/array/object ไม่ใช่การยืนยันว่าขั้นตอนสองฝั่งเป็นงานเดียวกัน
- **ลบ:** ยืนยัน dialog ที่มีชื่อ/ID ของรัน saved run ต้องลบจาก IndexedDB สำเร็จก่อนออกจาก UI หากล้มเหลวคงรันและ selection ไม่มี undo ลบรันที่เลือกจะเลือกถัดไปหรือวนไป first remaining ลบใน comparison ล้างเฉพาะฝั่งนั้นและ step ของฝั่งนั้น

## ข้อมูลบันทึกและการสำรอง

IndexedDB เก็บรันกับ filename เฉพาะ browser/profile/origin นี้ การล้างข้อมูลเว็บไซต์/private mode/นโยบาย browser/พื้นที่เต็มหรือปัญหาอุปกรณ์อาจทำให้ข้อมูลหายหรือบันทึกไม่ได้ คำว่า transaction complete ยืนยัน commit แต่ไม่รับรองการรอดจาก eviction/crash/power loss ควรเก็บไฟล์ต้นฉบับและส่งออกสำรองเป็นระยะ

หาก storage เสียหรือ version/layout ไม่รองรับ เว็บไม่แสดงบางส่วนและ **ไม่ลบ ซ่อม หรือเขียนทับอัตโนมัติ** ยังนำรันใหม่เข้าหน่วยความจำได้ แต่ save จะล้มเหลวถ้า storage ยังอ่าน/validate ไม่ผ่าน รันเดิมอาจยังอยู่แต่ UI เปิดไม่ได้ ไม่มี recovery/migration/raw-storage export ในรุ่นแรก อย่าล้างเว็บไซต์โดยไม่มีสำรอง ใช้ JSON สำรองที่ถูกต้องใน origin QA/ใหม่ที่ว่างเพื่ออ่านข้อมูล ไม่แก้ DB หรือรันจริงเพื่อทดสอบ

ระหว่าง import/load/save/retry/delete ล็อกการเปลี่ยนรายการที่ซ้อนกัน แต่ยัง inspect/filter/compare/export ได้ write transaction อ่านข้อมูลปัจจุบันซ้ำก่อนเขียนเพื่อป้องกัน snapshot เก่า แต่ UI หลายแท็บไม่ sync อัตโนมัติ ใช้แท็บเดียวหรือ reload ก่อนทำงานต่อ

## Log ใหญ่และขอบเขตที่ตรวจ

Day 7 ใช้ Brave/Chromium 155 บน Windows, i5-11400H, RAM ประมาณ 32 GiB กับ production build: fixtures 1,000 spans (324,552 bytes) และ 10,000 spans (3,294,284 bytes) ผ่าน import/render/search/selection/comparison ด้วย input จำลองใน browser และ IndexedDB จริง ข้อมูลมี parent 2 ระดับและ payload สั้น ไม่แทนทุก log รูปแบบ/ขนาด

สำหรับ 10,000 spans วัด dispatch→DOM พร้อมหลัง import/save 2.99 s (1 รอบ), remount timeline median 738 ms (3 รอบ), search 132 ms / กลับทุกแถว 825 ms / เปลี่ยน step B ใน comparison 490 ms (อย่างละ 5 รอบ) ตัวเลขรวมการคำนวณ/React commit/การตรวจ DOM ของ QA **ไม่ใช่เวลา React render ล้วนหรือความหน่วงการพิมพ์จริง** ค่า frame/paint ยืนยันไม่ได้และไม่ใช้ timeout ของเครื่องมือเป็นตัวเลขความหน่วง รายละเอียด/ช่วง min–max อยู่ใน DAY7.md

ยัง render ทุกแถวและสร้างทุก option เมื่อเทียบรัน ไม่มี virtualization ความหน่วงของ 10,000 spans ชัดเจน ให้ใช้คำค้นเพื่อลดแถวที่แสดงและแบ่งไฟล์โดยรักษารัน/parent ให้ครบ ไม่รับรองความลื่น หรือประสิทธิภาพกับ workspace ใหญ่หลายรัน/payload ลึกมาก JSON.stringify และ validation ยังมีข้อจำกัดหน่วยความจำ/ความลึก ทุก write ตรวจและเขียน saved snapshot ทั้งชุด

**ยังไม่ได้ตรวจ:** OS picker เลือก/Cancel/เลือกไฟล์เดิมหลังแก้, native confirm Cancel/OK, physical typing latency, React render/paint ล้วน, screen reader, browser อื่น/private mode, crash/power loss หรือ stress workspace ใหญ่หลายรัน ผลจำลองไม่นับเป็น native flow ไม่มี AI API และไม่มีตัวแปลงทุก SDK

## รูปแบบ JSON ของเว็บนี้ — schema_version 1

นี่คือ **รูปแบบเฉพาะ Agent Debugger** ไม่ใช่รูปแบบมาตรฐานของทุก Agent SDK ไฟล์จาก SDK อื่นต้องแปลงให้ตรง v1 ก่อน; ยังไม่มีตัวแปลง

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


## หลักฐานและไฟล์หลัก

- [DAY7.md](DAY7.md): ตารางสถานะรุ่นแรก ปัญหา/ผลกระทบ วิธีทำซ้ำ และ checklist ผู้ใช้ 10–15 นาที
- [docs/day7-checks.json](docs/day7-checks.json): round-trip และ helper/UI measurements ดิบ พร้อมข้อจำกัดวิธีวัด
- [docs/day7-preview.jpg](docs/day7-preview.jpg): QA 10,000 spans ค้น/เลือก s9995
- DAY1–DAY6.md และ docs/day6-checks.json: หลักฐานก่อนหน้า แยก native flows ที่ยังไม่ได้ตรวจ
- src/model.ts / validate.ts / import.ts: schema types/validation/local import; src/view.ts / search.ts / compare.ts: timeline/search/compare; src/storage.ts / workspace.ts / export.ts: persistence/delete/export; src/App.tsx และ styles.css: UI

Day 7 ปิดงานรุ่นแรกภายในขอบเขตนี้ ไม่เริ่ม backend/login/live logs/AI/virtualization หรือ deployment ต่อโดยอัตโนมัติ
