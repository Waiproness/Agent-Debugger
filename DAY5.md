# ผลงาน Day 5 — 14 ตุลาคม 2026

ทำครบขอบเขตภายในกรอบไม่เกิน 4 ชั่วโมง แล้วหยุด ไม่เริ่ม Day 6

## สิ่งที่เสร็จ

- อ่านคำแนะนำโปรเจกต์ README และ DAY4.md ก่อนแก้ ไม่มี AGENTS.md ที่เกี่ยวข้อง และโฟลเดอร์นี้ไม่ใช่ Git repository ใช้ ponytail/coding-workflow และแนวทาง accessibility จาก ui-ux-pro-max
- ตรวจ state เดิม: รายการแยกตัวอย่าง/รันนำเข้า, single run/span เป็น ID, comparison เก็บ runA/runB/spanA/spanB และ Timeline ที่ซ่อนยังรักษา filters วันนี้รวมรายการกับที่มาและสถานะบันทึกใน state เดียว รักษา schema v1, model, validator, importer, search/filter และ comparison logic เดิม
- IndexedDB เก็บ ordered snapshot ของรันจากไฟล์กับชื่อไฟล์เท่านั้น database `agent-debugger` version 1, store `workspace`, key `runs`, `{ storage_version: 1, entries: [{ run, filename }] }` storage version แยกจาก schema_version ของ log ไม่เก็บ filters, selections หรือคู่เปรียบเทียบ ไม่บันทึกตัวอย่างอัตโนมัติ
- เปิดหน้าแล้ว restore และ validate ทั้ง snapshot ก่อนแสดง เลือกรันแรกตามลำดับที่บันทึก ไม่มีข้อมูลแสดง empty state ปิดนำเข้า/โหลดตัวอย่างระหว่าง restore ด้วยทั้ง disabled UI และ synchronous operation guard
- ข้อมูลเสีย/version/layout ไม่รองรับแสดงข้อผิดพลาด ไม่ลบทิ้ง ไม่ซ่อม ไม่เขียนทับอัตโนมัติ write transaction อ่านและ validate snapshot ปัจจุบันซ้ำก่อน save/delete รวมการเปลี่ยนจากแท็บอื่น
- นำเข้าผ่านแล้วตรวจใน memory ได้ทันที แยกผลนำเข้าจากผล save รอ `transaction.oncomplete` จึงแสดงบันทึกสำเร็จ หาก abort/quota/access failure เก็บรันใน memory พร้อมชื่อ, ID, ที่มา, สถานะจะหายเมื่อรีเฟรช และ retry ทั้งกลุ่มจากไฟล์ที่ยังอยู่
- save ทุก run จากไฟล์เดียวกันใน transaction เดียว ไม่มี partial commit ใช้ add semantics ไม่ overwrite ID ที่มีใน storage กติกานำเข้า ID ซ้ำปฏิเสธทั้งไฟล์ รวม ID ที่ restore มา ตัวอย่างข้าม ID ที่มีแล้วและรายงานจำนวน
- ล็อกการนำเข้า/โหลดตัวอย่าง/save/retry/delete ไม่ให้ซ้อนกันในหน้าเดียวกัน ปุ่ม inspect/filter/compare/export ยังใช้ได้ การลบ unsaved run ก่อน retry ไม่ทำให้รันกลับมา
- ปุ่มลบแต่ละรายการและฝั่ง A/B ยืนยันชื่อกับ ID saved run ต้องลบจาก IndexedDB สำเร็จก่อนเปลี่ยนหน้าจอ ล้มเหลวคงรายการ/selection memory-only/sample ลบจากหน้าจอได้ เลือกรันถัดไปเมื่อ single selection ถูกลบ ถ้าลบรายการท้ายวนไปรันแรกที่เหลือ สุดท้ายเป็น empty state comparison ล้างเฉพาะฝั่งกับขั้นตอนของฝั่งที่ลบ ใช้ selection ล่าสุดแม้เปลี่ยนขณะรอ transaction
- ส่งออก single run, A/B หรือทุกรันใน workspace ตรวจ validator ก่อนสร้าง Blob ใช้ envelope v1 เดิม ข้อมูลรันเต็มรวม spans ที่ถูกกรอง ไม่ใส่ชื่อไฟล์หรือ storage metadata ไม่แปลง null/0/false/empty string/payload ใช้ filename คงรูปจาก scope/timestamp ไม่ใช้ชื่อใน log เป็น path และ remove anchor/revoke object URL หลังเริ่ม download
- แจ้ง ID ชนเมื่อนำกลับเข้า workspace เดิม และตรวจขนาด Blob จริงรวม UTF-8/envelope หากเกิน 10 MiB บอกว่านำเข้าตรง ๆ ไม่ได้ ไม่รับรอง round-trip ทุกขนาด
- ข้อความระบุ browser/profile/origin ไม่มี sync ข้ามเครื่อง การล้างข้อมูลเว็บไซต์อาจลบข้อมูล แนะนำ export สำรอง สถานะใช้ข้อความประกอบสี ปุ่มเป็น native button มี accessible labels และ focus ring
- ใช้ Node test runner เดิม เพิ่ม `fake-indexeddb@6.2.5` เป็น dev dependency เท่านั้น เพราะไม่มีตัวจำลองเดิม และต้องตรวจ IndexedDB transaction commit/abort/rollback ไม่รวมใน production bundle ไม่เพิ่ม runtime dependency
- อัปเดต README และเก็บภาพ `docs/day5-preview.png` ไม่เพิ่ม backend/login/live logs/auto matching/AI API/AI วิเคราะห์/clear-all/online deployment

## ผลตรวจอัตโนมัติ

| การตรวจ | ผล |
| --- | --- |
| npm test | ผ่าน **120/120**: 97 เดิม + 23 ใหม่ ไม่มี skip |
| npm run typecheck | ผ่าน |
| npm run build | ผ่าน ได้ dist/ |
| Restore | ว่าง, ลำดับบันทึกต่างจากชื่อ/ID, ที่มาและรันเต็มหลัง reopen |
| ID ชน | whole-file import rejection หลัง restore, save ปฏิเสธทั้ง batch, concurrent duplicate save สำเร็จได้หนึ่ง batch |
| Atomicity | รันท้ายผิด validation ไม่ commit รันก่อนหน้า; put request สำเร็จแล้ว transaction abort ยังเป็น failure และ rollback |
| Storage failure | unavailable, SecurityError, QuotaExceededError, retry กลับมาบันทึกได้ memory ต้นฉบับไม่เปลี่ยน |
| ข้อมูลเสีย | version ไม่รองรับ, log/parent เสีย, provenance เสีย, duplicate IDs, metadata เกิน, DB version/layout ไม่รองรับ; restore/save/delete ปฏิเสธและ raw snapshot คงเดิม |
| Delete | ลบ commit สำเร็จ, ลบล้มเหลวเก็บข้อมูล, save/delete transactions ซ้อนไม่ resurrect snapshot เก่า |
| Selection | single next/wrap/empty, ล้างเฉพาะ comparison A/B พร้อม span, ไม่แก้ฝั่งอื่นและ state ต้นฉบับ |
| Samples | ข้าม restored/existing IDs, โหลดซ้ำไม่เพิ่มและรายงาน skipped |
| Export | validate + deep round-trip หนึ่ง/หลายรัน, payload ค่าจริง, spans เต็มขณะกรอง, ปฏิเสธข้อมูลผิด/ID ซ้ำ |
| Export size/resources | UTF-8 bytes, ขนาดเท่ากับ 10 MiB ไม่มี warning, มากกว่าเพดานมี warning, fixed safe filename, remove anchor และ revoke URL แม้ click throw |
| Regression | importer/schema/search/filters/compare/depth เดิมผ่าน รวม chain 100,000 spans |

## ทดลองจริงใน Brave

ใช้ Vite dev server บน **http://127.0.0.1:5195/** แยก origin จากเว็บเดิม :5173 เริ่ม origin ทดสอบด้วยข้อมูลว่าง ใช้ fixtures สมมติจาก local examples และหน้า QA ชั่วคราว ไม่มี log ของผู้ใช้ถูกส่งภายนอก

ส่วนขยายไม่อนุญาต file chooser (`Allow access to file URLs`) จึงใช้หน้า QA สร้าง File/DataTransfer แล้ว dispatch change เข้า input เดิม ฟังก์ชัน readImport, state ของ App และ IndexedDB จริงเป็นตัวเดียวกับเว็บ ไม่อ้างว่าผ่านการเลือกไฟล์จาก OS

- นำเข้า success fixture: หน้าจอแยกนำเข้าสำเร็จ 1 รันกับบันทึกสำเร็จ reload คืน `run-release-summary` พร้อม `success-source.json`, 5 spans และเลือกรันแรก ข้อมูลเต็มตรงกับต้นฉบับ
- นำ success เดิมเข้าซ้ำหลัง restore ปฏิเสธทั้งไฟล์ตาม ID เดิม โหลดตัวอย่างเพิ่ม 2 รันและข้าม 1 ID ไม่เกิด ID ซ้ำ ตัวอย่างหายหลัง reload ตามที่ตั้งใจ
- จำลอง quota โดยให้ put throw QuotaExceededError นำเข้าหลายรันแล้ว memory มีทั้งสอง พร้อมปุ่ม retry/ชื่อ/ID/ที่มา raw storage ยังมีเพียงรันที่บันทึกก่อนหน้า ไม่มี partial batch
- จำลอง unavailable ด้วย open throw SecurityError แล้ว retry ยังล้มเหลวและ memory คงอยู่ เมื่อเอา fault ออก retry บันทึกสองรันได้ทั้งหมด reload คืนลำดับและ `multi-source.json` ของทั้งคู่
- ทำให้ stored parent อ้าง ID ที่ไม่มี แล้ว reload: restore แจ้ง validator error ไม่แสดงรันเสีย นำรันใหม่เข้าหน่วยความจำได้แต่ save ล้มเหลว raw snapshot ยังมีรันเดิมและ parent ที่เสีย ต่อด้วย storage_version 99 ก็แจ้ง version ไม่รองรับและ raw version/entries ยังเดิมหลังพยายาม save ใช้คำสั่ง QA คืนเฉพาะ fixture สมมติด้วยตนเองเพื่อทดสอบต่อ ไม่ใช่ recovery อัตโนมัติของ app
- กรอง single timeline ด้วย `changelog` เหลือ 1/5 แล้วดาวน์โหลดรันเดี่ยวจริง ตรวจไฟล์ใน Downloads ด้วย validator และ deep equality ตรงกับต้นฉบับ รวม **5 spans** ครบ
- ส่งออก workspace จริง 3 รัน: saved success กับสองรันจาก multi-source ตรวจไฟล์ดาวน์โหลด validate ผ่านและตรงต้นฉบับทุกฟิลด์ ไม่มี provenance/storage metadata
- เครื่องมือรอ download event timeout แต่ไฟล์เกิดจริง จึงอ่านและตรวจไฟล์ที่ดาวน์โหลดแทน: `agent-debugger-run-1791947689901.json` (2,090 bytes), `agent-debugger-workspace-1791947718864.json` (5,862 bytes) อยู่ใน Downloads ไม่ลบไฟล์เหล่านี้อัตโนมัติ
- native confirm dialog ทำให้ API ควบคุม browser timeout ต้องปิดแท็บ QA แล้วใช้ confirmation fixture ที่ตอบรับและบันทึกข้อความ prompt ในหน้าทดสอบ ข้อความจริงระบุชื่อกับ ID ไม่มีการเปลี่ยน confirm ของ production app
- ลบ saved A เมื่อ quota fault เปิด: หน้าจอแจ้งลบไม่สำเร็จ ยังมี A/B กับ read/lookup เดิม เมื่อเอา fault ออกลบ A สำเร็จ A/spanA ว่าง แต่ B/spanB ยังอยู่ กลับ single เลือกรันถัดไป `qa-batch-0`
- ลบ saved B อีกครั้ง: B/spanB ว่าง แต่ A/sample run และ lookup A ยังอยู่ ตรวจ IndexedDB แล้ว ID ที่ลบหายจริง
- ลบ sample ที่เลือกใน single: เลือก sample ถัดไปและไม่เปลี่ยน saved snapshot
- นำเข้าใหม่สองรันภายใต้ quota failure ลบ unsaved `qa-retry-1` แล้ว retry เหลือเฉพาะ `qa-retry-0` บันทึกสำเร็จ ID ที่ลบไม่กลับมา
- ลบ fixtures ที่เหลือทีละรายการผ่านปุ่มลบ แล้ว reload ได้ empty state และ saved entries ว่าง ไม่แตะข้อมูล :5173 หรือแท็บของผู้ใช้
- Tab จากปุ่มส่งออกรันเดี่ยวไปส่งออก workspace focus ถูกต้องและมี solid outline เก็บ screenshot ของ app ปกติที่มี saved run และ samples ใน `docs/day5-preview.png`

ปิดแท็บ/server และลบหน้า QA ชั่วคราวหลังตรวจเสร็จ ไม่เหลือ fault injection หรือ fixture controls ใน source/build ของเว็บ

## ข้อจำกัดและความเสี่ยงด้านข้อมูล

- **ยังไม่ตรวจ:** OS file picker/upload end-to-end เพราะสิทธิ์ส่วนขยาย; การกดยืนยัน/ยกเลิก native confirm แบบ browser automation เพราะ API timeout (flow ลบและข้อความ prompt ตรวจด้วย fixture); screen reader จริง, browser อื่น, private mode, workspace ใหญ่ หรือ browser/process crash/power loss หลัง commit ระหว่าง restore ตรวจ disabled/guard จากโค้ด ไม่ได้หน่วง restore จริงใน browser
- quota/access failure ใน browser ใช้ fault injection ไม่ได้ทำดิสก์จริงเต็ม ผล unit tests ใช้ตัวจำลอง; ไม่อ้างว่าเทียบเท่าทุกนโยบาย/ทุก crash ของเบราว์เซอร์
- transaction complete คือ IndexedDB ยืนยัน commit ไม่ใช่การรับรองว่าข้อมูลจะไม่ถูก eviction/ล้างเว็บไซต์หรือหายจากปัญหาอุปกรณ์ ต้องส่งออกและเก็บไฟล์ต้นฉบับสำรอง รันที่ยังไม่บันทึกกับตัวอย่างหายเมื่อ refresh
- ข้อมูลเสียจะยังอยู่ แต่ UI ยังไม่มี recovery/migration/raw-storage export จึงอาจเปิดรันเดิมไม่ได้จนแก้ข้อมูลด้วยวิธีภายนอก อย่าล้างเว็บไซต์โดยไม่มีสำรอง
- ลบไม่มี undo ไม่ใช่ secure erasure ส่งออกก่อนลบหากต้องเก็บข้อมูล ข้อมูลเป็น local browser storage ไม่ได้เพิ่มการเข้ารหัส
- ใช้ ordered snapshot เดียว ทำให้ทุก write อ่าน/validate/เขียน saved workspace ทั้งชุด ปริมาณมากอาจช้า ใช้แท็บเดียวเพราะ UI ระหว่างแท็บไม่ sync อัตโนมัติ แม้ transaction ป้องกัน stale overwrite และ duplicate ID
- Export ใช้ validator และ JSON.stringify เดิม จึงยังมีขีดจำกัด payload ลึกมาก/หน่วยความจำ ไม่มี streaming/virtualization/ตัวช่วยแบ่งรันเดียวที่ใหญ่กว่า 10 MiB

## ไฟล์หลัก

`src/storage.ts`, `src/export.ts`, `src/workspace.ts`, `src/App.tsx`, `src/styles.css`, tests ใหม่ 3 ไฟล์, `package.json`/lockfile, README, DAY5 และภาพหน้าจอ ไม่เปลี่ยน schema/validator/types/dependencies เดิม
