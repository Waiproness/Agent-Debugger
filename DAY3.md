# ผลงาน Day 3 — 13 ตุลาคม 2026

ทำงานประมาณ 25 นาที รวมเวลารอเครื่องมือเลือกไฟล์ที่ติดสิทธิ์ อยู่ภายในกรอบ 4 ชั่วโมง หยุดหลังขอบเขต Day 3 ครบ ไม่เริ่ม Day 4

## สิ่งที่เสร็จ

- อ่าน README, DAY2.md, types, validator, importer, components และ tests เดิม รวมคำแนะนำ ancestor ก่อนแก้ ไม่มี AGENTS.md ที่เกี่ยวข้องและยังไม่มี Git repository
- เพิ่มค้นหาเหนือไทม์ไลน์ในรันที่เลือก ค้น id/name/type/input/output/error แบบ substring ไม่แยก case รองรับไทย ตัด whitespace หัวท้ายคำค้น ไม่ใช้ regex จากผู้ใช้
- เตรียมข้อความจาก keys/scalar values จริงด้วย loop ครั้งเดียวต่อ spans ผ่าน useMemo ไม่แก้ payload ไม่ stringify/traverse ใหม่ทุกครั้งที่พิมพ์หรือเลือกขั้นตอน ค่า 0/false ค้นได้; null รวมค่าซ้อนไม่มีข้อความค้นหา ข้อความ "ไม่มีข้อมูล" จะค้นเจอเฉพาะเมื่อมีจริงใน log
- กรอง status/type ด้วย enum v1 เดิม และรวมกับคำค้นแบบ AND มีปุ่มล้างคำค้น/ล้างทั้งหมด ตัวนับ พบ X จาก Y และ no-results ที่แยกจากรันว่าง
- เก็บแถวตามลำดับเวลาเดิม แต่กรองเฉพาะแถวที่แสดง ใช้ spans ทั้งหมดสำหรับแกนเวลา spanDepths และสรุปรัน ระยะเยื้อง/ช่วงเวลาไม่เปลี่ยนเมื่อ parent ถูกซ่อน
- หาก selection ถูกกรองออก เก็บรายละเอียดเดิมและแสดงข้อความแจ้ง พร้อมปุ่มล้างตัวกรองเพื่อกลับไปดู
- Timeline เก็บ filters เป็น local state และใช้ key ของ run ID เมื่อเปลี่ยนรันจึงล้างทุกเงื่อนไข รวมการนำเข้าสำเร็จที่เลือก run ID ใหม่ การนำเข้าผิด/ยกเลิก/runs ว่างไม่เปลี่ยนรัน จึงไม่ remount หรือล้าง filters/selection
- คง spanDepths/useMemo จากงานแก้ Day 2 และ memoize search index/ผลกรองเท่าที่จำเป็น ไม่มี library, virtualization, schema/types/validator/import behavior ใหม่
- ใช้ label, native input/select/button, status announcements และ visible keyboard focus ตรวจหน้าจอแคบด้วย
- อัปเดต README และภาพหลักฐาน docs/day3-preview.jpg ไม่มี AI API หรือการเผยแพร่

## ผลตรวจ

| การตรวจ | ผล |
| --- | --- |
| npm test | ผ่าน 78/78 (68 เดิม + 10 search tests) |
| ค้นชื่อ/ID/type/ไทย/input/output/error | ผ่าน รวม key/value ซ้อนและ error code/details |
| query ว่าง/whitespace/case/literal regex characters | ผ่าน |
| payload 0/false/empty string/null | ผ่าน ค่าไม่ถูกสร้างหรือเปลี่ยน และไม่มี placeholder ใน index |
| AND status/type/query, no results, clear | ผ่าน logic tests และ browser ตัวอย่าง |
| prepared index | getter test ยืนยันเปลี่ยน query ไม่อ่าน payload ซ้ำ |
| full-run invariants | tests ยืนยันแถวกรองยังเป็น object เดิม ไม่แก้รัน และ depth/time bounds ยังอิงรันเต็ม |
| npm run build รวม TypeScript | ผ่าน ได้ dist/ |
| browser ปกติ | ทดสอบ production build ใน Brave ที่ loopback origin ใหม่ :5183 เพื่อไม่ใช้ cache QA เก่า |
| case/trim + AND | CHANGELOG.MD + success + tool พบ 1/5; summary ยัง 5 ขั้นตอน/12 s และรายละเอียด root เดิมพร้อม notice |
| error search | etimedout + error + tool พบ lookup 1/4 |
| no-results/clear | เงื่อนไขไม่ตรงพบ 0/4 แจ้งว่ารันมี 4 ขั้นตอน และล้างแล้วกลับ 4/4 |
| เปลี่ยนรัน | query ว่าง, status/type all และเลือก span แรกตามเดิม |
| ไทย/hidden selection | เปรียบเทียบข้อมูลจำลอง พบ prompt 1/6 แต่รายละเอียด read_benchmark pending คงเดิม; ปุ่มกลับไปดูล้างแล้วกลับ 6/6 และเลือกขั้นตอนเดิม |
| parent ที่ถูกซ่อน | read_benchmark + running + tool พบ 1/6; indent 46px, bar left 50%/width 50% และ axis 0/2/4/6 s เท่าก่อนกรอง สรุปรันยัง 6 ขั้นตอน/ยังไม่จบ |
| แป้นพิมพ์/labels | Enter ล้างคำค้นได้; Tab ไปปุ่มล้างมี solid outline; AX แสดง label ของ search/status/type ตามชื่อบนหน้าจอ |
| หน้าจอแคบ | viewport 375×812; document clientWidth/scrollWidth เท่ากัน 360px หลังหัก scrollbar ไม่มี overflow ทั้งหน้า controls อยู่ในกรอบ |

## ประสิทธิภาพและข้อจำกัดที่ยังเหลือ

ระหว่างเปิด QA ที่ :5174 browser cache ยังเก็บไฟล์ตัวอย่าง synthetic 10,000 spans จากรอบแก้ depth ก่อนหน้าไว้ HTTP server ตอบ 304 เนื่องจาก timestamps ของไฟล์ต้นฉบับเก่ากว่า cache ตรวจ CLI แล้ว public/examples/success.json และ dist/examples/success.json ยังเป็นต้นฉบับ 5 spans จึงย้าย origin สำหรับทดสอบตัวอย่างปกติ โดยไม่เปลี่ยนข้อมูลหรือพฤติกรรมแอป

บนข้อมูล QA 10,000 spans นั้น ค้น 4321 เหลือ 1 แถว รายละเอียด root เดิมคงอยู่พร้อม hidden notice จากนั้นเลือก 4321, กรอง error จน 0 ผล และล้างกลับ 10,000 แถวได้โดย selection 4321 คงเดิม เครื่องมือมี timeout ตอนอ่าน AX tree และตอนล้างกลับ DOM จำนวนมาก แต่ DOM ที่อ่านถัดมายืนยันว่าล้างสำเร็จ ไม่มีการวัด render/layout/paint หรือ input latency เชิงตัวเลข จึงไม่อ้างว่าทุกแถวลื่น และไม่ได้เพิ่ม virtualization

ทางเลือกไฟล์อัตโนมัติของ Brave ยังถูกปฏิเสธด้วยสิทธิ์ **Allow access to file URLs** จึงยังไม่ได้ตรวจการค้นหา/กรองกับรันที่นำเข้าจริง การรักษา filters เมื่อ import fail และ reset หลัง import success แบบ browser end-to-end ไม่เปลี่ยน setting เบราว์เซอร์หรือใช้ native fallback ที่เคยถูกหยุด

ทางนำเข้าเดิมมี 23 tests ที่ยังผ่าน แต่ไม่ใช่การตรวจ React UI end-to-end พฤติกรรม filters/selection เมื่อ import เปลี่ยน/ไม่เปลี่ยนรันตรวจจากการใช้ Timeline เดียวกันและ run key ในโค้ด รวม browser run-switch test ข้างต้น ยังไม่ได้ทดสอบ screen reader จริง, browser อื่น หรือใช้ profiler วัด memoization ใน React

ปิด QA tabs และ server ที่เริ่มเอง (:5174/:5183) เมื่อจบ ไม่ปิด dev server :5173 ที่มีอยู่ก่อน

## ไฟล์หลักและการเปิดทดลอง

- src/search.ts — เตรียมดัชนีและกรองแบบ AND
- src/App.tsx — search/filter controls, notices, count และ run-key reset
- src/styles.css — controls/focus และการจัดวาง
- tests/search.test.mjs — 10 tests ของ logic ใหม่
- README.md, DAY3.md และ docs/day3-preview.jpg — วิธีใช้และผลตรวจ

ใช้ npm run dev แล้วเปิด http://127.0.0.1:5173/ หรือใช้ server เดิมที่ URL นี้ กดโหลดตัวอย่าง/เลือกไฟล์ JSON จากนั้นค้นหาและกรองเหนือไทม์ไลน์

## งานต่อที่เสนอสำหรับ Day 4 (ยังไม่ได้ทำ)

เปรียบเทียบสองรัน โดยตกลงวิธีจับคู่ขั้นตอนและแสดง input/output/error ที่ต่างกันก่อนพัฒนา การบันทึกถาวร/ส่งออกเป็นงานวันถัดไป ไม่รวม live logs, login หรือ AI วิเคราะห์
