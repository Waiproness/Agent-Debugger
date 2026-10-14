# ผลงาน Day 2 — 13 ตุลาคม 2026

ทำงานประมาณ 15 นาที ภายในกรอบ 4 ชั่วโมง หยุดเมื่อขอบเขต Day 2 และการตรวจที่ทำได้ครบ ไม่มีการเริ่ม Day 3

## สิ่งที่เสร็จ

- อ่าน Day 1, README, schema/types/validator, components และ tests เดิมก่อนแก้ ตรวจว่าไม่มี AGENTS.md ที่เกี่ยวข้องและไม่มี Git repository
- ใช้ React/TypeScript/Vite เดิม ไม่มีการตั้งโปรเจกต์ใหม่ เพิ่ม dependency หรือเปลี่ยน schema v1/types
- ปุ่มเลือกไฟล์ `.json` ครั้งละหนึ่งไฟล์ อ่านด้วย `File.text()` ในเบราว์เซอร์ ตรวจเพดาน 10 MiB ก่อนอ่าน และแสดงเพดานบนหน้าจอ
- ตรวจ JSON syntax และใช้ validator เดิมตรวจทั้งไฟล์ก่อนเพิ่มรัน รองรับ parent ซ้อน งานขนาน และ `ended_at: null` ของงาน running ตาม v1; ไม่ละฟิลด์ ended_at หรือสร้างค่าแทนข้อมูลที่ขาด
- ปฏิเสธ run ID ซ้ำทั้งในไฟล์และกับรายการปัจจุบัน รวมตัวอย่างที่โหลดไว้ ไม่เขียนทับและไม่เพิ่มรันบางส่วนจากไฟล์ที่ผิด
- มีสถานะอ่าน/สำเร็จ/ผิดพลาด ข้อผิดพลาดภาษาไทยระบุฟิลด์แบบ `runs[0].spans[2].parent_id` และวิธีแก้ ย้าย focus ไป error เพื่อให้คีย์บอร์ด/assistive technology พบได้
- นำเข้าสำเร็จแล้วเพิ่มรันต่อท้ายและเลือกรันแรกของไฟล์ทันที; runs ว่างไม่เปลี่ยนรันที่เลือก
- ยกเลิก file picker ไม่เปลี่ยนข้อมูล; handler เปลี่ยนรายการและ selection เฉพาะหลัง read/parse/validation ผ่าน และล็อกการอ่านทีละไฟล์
- แสดงที่มาบนการ์ด/สรุป แยกไฟล์ที่นำเข้ากับข้อมูลตัวอย่าง ใช้สรุปและไทม์ไลน์พื้นฐาน Day 1 เดิม รวมเวลาจาก start–end ไม่บวก spans
- แสดงคำแจ้งว่าข้อมูลอยู่เฉพาะหน่วยความจำและหายเมื่อรีเฟรช ไม่มี persistence, การส่งออกไฟล์, AI API หรือการส่งไฟล์ไปภายนอก
- ข้อความ/HTML/โค้ดจาก log ผ่าน text rendering ของ React ไม่มี eval หรือ HTML rendering

การเปลี่ยนพฤติกรรม Day 1 ที่จำเป็น: เริ่มด้วยรายการว่าง และให้กดโหลดตัวอย่างเมื่อต้องการ เพื่อให้นำเข้าไฟล์ตัวอย่างต้นฉบับทั้งสามได้โดยไม่ชน ID กับตัวอย่างอัตโนมัติ หากโหลดตัวอย่างก่อนแล้วนำเข้าไฟล์เดียวกัน จะปฏิเสธ ID ซ้ำตามกติกาเดียวกัน

ปรับ validator เฉพาะการรายงาน error: เพิ่ม ValidationError ที่มี path/reason และใช้ index ใน path ของ parent/เวลาแทนข้อความ ID; กติกา validation และข้อความเดิมสำหรับ tests Day 1 ยังคงใช้ได้

## ผลตรวจ

| การตรวจ | ผล |
| --- | --- |
| `npm test` | ผ่าน 64/64 (41 tests เดิม + 23 tests ทางนำเข้า) |
| ตัวอย่างทั้งสาม | นำเข้าผ่าน readImport/File ของ Node ต่อกันเป็น 3 รัน รวม running ที่ ended_at เป็น null |
| JSON/schema/type/status/required fields | ผ่านกรณีผิดที่สำคัญ พร้อมตรวจ path และข้อความภาษาไทย |
| ID/parent/วงวน/เวลา | ผ่าน ทั้ง duplicate ภายในไฟล์/รัน และชนกับข้อมูลเดิม |
| เพดานไฟล์ | ตรวจ 10 MiB และ 10 MiB + 1 byte; spy ยืนยันว่าเกินขนาดไม่เรียกอ่านไฟล์ |
| อ่านไฟล์ผิด/ข้อมูลผิด | ชุดทดสอบยืนยัน existing runs ไม่ถูกเปลี่ยน และรันผิดในตำแหน่งท้ายทำให้ทั้งไฟล์ถูกปฏิเสธ |
| BOM/MIME/นามสกุล/runs ว่าง | ผ่าน รับ UTF-8 BOM, .JSON และไม่พึ่ง MIME; ปฏิเสธนามสกุลอื่นก่อนอ่าน |
| ข้อความคล้าย HTML/โค้ด | parser คงข้อความเดิม และตรวจ source ว่า React แสดงเป็นข้อความ ไม่มี eval/dangerouslySetInnerHTML |
| `npm run build` รวม TypeScript | ผ่าน หลังแก้ไฟล์รอบสุดท้าย ได้ dist/ |
| JSON Schema เดิม | ตรวจ Draft 2020-12 และตัวอย่างทั้งสามผ่าน โดยใช้ jsonschema ที่มีอยู่ในเครื่อง |
| หน้าเว็บเริ่มต้น | เปิด/reload ใน Brave เห็น Day 2, ปุ่มเลือกไฟล์, เพดานขนาด, คำแจ้ง persistence และรายการว่าง |

## ข้อจำกัดการตรวจเบราว์เซอร์

ยังไม่ได้ยืนยันการเลือกไฟล์/ยกเลิก picker, สถานะอ่าน/สำเร็จ/ผิดพลาด, การเลือกรันที่นำเข้า และการคง selection เมื่อผิดพลาดแบบ end-to-end ในเบราว์เซอร์:

1. Browser extension แจ้งว่าการตั้งไฟล์ให้ chooser ต้องมีสิทธิ์ **Allow access to file URLs** ใน Brave จึงตั้งไฟล์อัตโนมัติไม่ได้ ไม่ได้เปลี่ยน setting นี้
2. ลองเตรียม native picker ผ่าน Computer Use แต่เครื่องมือหยุดก่อนส่ง input เพราะยืนยัน URL ของหน้าต่าง Windows ได้ไม่แน่ชัด จึงหยุดการควบคุม UI ต่อ และรายงานข้อจำกัดตามจริง

Parser/file-size/validation ผ่าน automated tests แต่ไม่แทนการทดสอบ React UI end-to-end ไม่มีการอ้างว่าการเลือกไฟล์ใน browser ผ่านแล้ว ไม่ได้ทดสอบ screen reader จริง, browser อื่น หรือประสิทธิภาพกับ log ใหญ่จำนวนมาก

มี dev server อยู่ก่อนแล้วบน 127.0.0.1:5173 จึงใช้ server เดิมทดสอบ HTTP/หน้าเริ่มต้น ไม่ได้ปิด server ที่ไม่ได้เริ่มเอง ไฟล์ QA ชั่วคราวที่สร้างสำหรับ browser ถูกลบหลังจบงาน ไม่แก้ตัวอย่างต้นฉบับ

## ไฟล์ที่เปลี่ยน

- `src/import.ts` — size/extension/read/parse/collision และคำแนะนำ error
- `src/validate.ts` — path/reason ของ error และ indexed span paths
- `src/App.tsx` — import UI/states, commit หลังตรวจผ่าน, source labels และ optional samples
- `src/styles.css` — import states และรายการรันบนหน้าจอแคบรองรับจำนวนรายการที่เพิ่มขึ้น
- `tests/import.test.mjs` — 23 tests ของทางนำเข้า ใช้ Node runner เดิม
- `index.html` — คำอธิบายหน้าสำหรับการนำเข้า
- `README.md` — วิธีนำเข้า, ขนาด, error, รูปแบบ v1 และข้อจำกัด persistence
- `DAY2.md` — ผลงานและผลตรวจนี้

## เปิดทดลองและงาน Day 3

ใช้ `npm run dev` แล้วเปิด <http://127.0.0.1:5173/> หาก server เดิมยังทำงาน ให้ใช้ URL นี้ได้โดยไม่เริ่มอีกตัว จากรายการว่างเลือก success.json, tool-error.json และ parallel-nested.json ใน public/examples ทีละไฟล์; รายละเอียดอยู่ใน README

Day 3: ค้นหาและกรองขั้นตอนบนข้อมูลที่นำเข้าแล้ว โดยรักษา selection/ข้อความต้นฉบับและการประมวลผลในเบราว์เซอร์ ไม่รวมเปรียบเทียบ, persistence, live log หรือ AI วิเคราะห์ในงาน Day 3 โดยอัตโนมัติ

## แก้ประสิทธิภาพ depth ตามรีวิว Day 2

แก้เฉพาะคอขวดการคำนวณความลึก ไม่เปลี่ยน schema, validator, ทางนำเข้า, dependencies หรือเพิ่ม virtualization/ฟีเจอร์ Day 3

- ค้นทุก caller ก่อนแก้: Timeline ใน `src/App.tsx` และ test ข้อมูลซ้อนใน `tests/log.test.mjs`
- แทน `depth(span, spans)` ที่สร้าง Map ใหม่ทุกแถวด้วย `spanDepths(spans)` ใน `src/view.ts`: สร้าง lookup parent → children ครั้งเดียว แล้วเดินจากทุก root ด้วย queue และ loop แต่ละขั้นตอนถูกประมวลผลครั้งเดียว ผลลัพธ์เป็น Map ของ ID → depth เวลาและหน่วยความจำ O(n)
- ไม่มี recursion หรือการเดินย้อน chain ซ้ำต่อแถว root = 0 และ parent อยู่ก่อน/หลังลูกใน array ได้ ใช้เฉพาะ spans ที่ผ่าน validator เดิมแล้ว
- Timeline ใช้ `useMemo(..., [run.spans])` เก็บผลร่วมกัน ทุกแถวอ่าน Map โดยตรง เมื่อเปลี่ยนเฉพาะ selectedId อ้างอิง spans เดิม จึงใช้ผลเดิม; เมื่อข้อมูล spans เป็น array ใหม่หรือเปลี่ยนรัน จะคำนวณใหม่ ตามการเก็บข้อมูลแบบไม่แก้ array เดิมของแอป
- ระยะเยื้องยังใช้ `Math.min(depth, 5) * 12 + 10` เหมือนเดิม (root 10px, สูงสุด 70px) ไม่เปลี่ยนการเรียงไทม์ไลน์หรือรายละเอียด

### ผลตรวจหลังแก้

`npm test` ผ่าน **68/68** (64 เดิม + 4 depth tests) ครอบคลุมหลาย root, parent หลังลูก, sibling/หลายระดับ, array ใหม่ที่ ancestry เปลี่ยน และ chain ย้อนลำดับ **100,000** ขั้นตอนโดยไม่ stack overflow ตรวจทุกระดับใน chain โดยไม่มีเกณฑ์เวลาตายตัว `npm run build` รวม TypeScript ผ่าน

เพิ่ม `scripts/benchmark-depth.mjs` รันซ้ำได้ด้วย:

```powershell
node scripts/benchmark-depth.mjs
```

วัดจริงด้วย `performance.now()` บน Node v24.16.0 / Windows x64 สร้างข้อมูลก่อนเริ่มจับเวลา แต่ละกรณี warmup 5 ครั้ง แล้ววัด 21 ครั้ง ใช้ median และรายงาน min/max ไม่มี assertion ตัดสินผ่านจากเวลา chain ถูกกลับลำดับให้ลูกอยู่ก่อน parent

| รูปแบบ | ขั้นตอน | Median (ms) | Min (ms) | Max (ms) |
| --- | ---: | ---: | ---: | ---: |
| roots | 1,000 | 0.143 | 0.084 | 0.356 |
| roots | 5,000 | 0.807 | 0.388 | 1.848 |
| roots | 10,000 | 0.915 | 0.794 | 3.556 |
| chain | 1,000 | 0.118 | 0.109 | 0.421 |
| chain | 5,000 | 0.801 | 0.639 | 2.683 |
| chain | 10,000 | 1.665 | 1.457 | 3.882 |

ตัวเลขนี้รวมการสร้าง lookup/queue และ depth Map ของฟังก์ชันใหม่ แต่ **ไม่รวม** สร้าง fixtures, อ่าน/parse JSON, validation, sort, React render, layout, paint หรือการตอบสนองหลังคลิก ไม่ใช้เป็นตัวเลข end-to-end หรือเทียบเป็นอัตราเร็วกับการวัดเก่าที่ใช้วิธีวัดต่างกัน

### ทดลองไทม์ไลน์ขนาดใหญ่ในเบราว์เซอร์

ใช้ production build แยกในโฟลเดอร์ QA ชั่วคราว บน loopback 127.0.0.1:5174 และเปลี่ยนเฉพาะไฟล์ตัวอย่างในสำเนา build ให้มี root/chain อย่างละ 10,000 spans ไม่เขียนทับตัวอย่างต้นฉบับและไม่ใช้สิทธิ์ file picker ที่ติดขัดในรอบ Day 2

- Brave แสดง 10,000 แถวทั้ง root และ chain ที่ parent อยู่หลังลูก
- เลือก `roots step 4321`: รายละเอียด ID s4321, parent null และมีแถว selected เพียงแถวเดียว
- สลับไป chain: ขั้นตอนแรกใน array คือ s9999 มี parent s9998 และ padding-left 70px
- เลือก `chain step 9998`: รายละเอียด ID s9998, parent s9997 และมีแถว selected เพียงแถวเดียว ระยะเยื้องยัง 70px
- เก็บภาพ `docs/depth-performance-preview.jpg` แล้วปิดหน้า/server และลบสำเนา QA ที่สร้างเอง

**ข้อจำกัด:** ไม่ได้วัดเวลา render/layout/paint หรือ latency ของ selection เชิงตัวเลข ไม่ได้ instrument จำนวนการเรียก useMemo ใน browser; การใช้ cache ตรวจจาก dependency/อ้างอิงข้อมูลในโค้ด เครื่องมือ CDP รายงาน timeout ระหว่างสลับรันครั้งหนึ่ง แต่ DOM ที่ตรวจถัดมายืนยันว่ารันเปลี่ยนสำเร็จ จึงไม่อ้างว่า DOM 10,000 แถวลื่นหรือการเลือกไม่มีหน่วง การลด depth เป็น O(n) ไม่ได้แก้ค่าใช้จ่ายของการ render DOM ทุกแถว และยังไม่มี virtualization ตามขอบเขตงานนี้

ไฟล์เพิ่ม/แก้ในรอบนี้: `src/view.ts`, `src/App.tsx`, `tests/log.test.mjs`, `tests/depth.test.mjs`, `scripts/benchmark-depth.mjs`, ภาพหลักฐาน และบันทึกส่วนนี้ ไม่มีการเริ่ม Day 3 หรือเผยแพร่ออนไลน์
