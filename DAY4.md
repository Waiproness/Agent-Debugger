# ผลงาน Day 4 — 13 ตุลาคม 2026

ทำงานประมาณ 15–20 นาที ภายในกรอบ 4 ชั่วโมง หยุดเมื่อขอบเขต Day 4 ครบ ไม่เริ่ม Day 5

## สิ่งที่เสร็จ

- อ่าน README, DAY3.md, components/types/tests เดิม และคำแนะนำ ancestor ก่อนแก้ ไม่มี AGENTS.md ที่เกี่ยวข้องและยังไม่ใช่ Git repository
- โหมดเปรียบเทียบใช้รายการรันปัจจุบัน รวมตัวอย่างและรันจากไฟล์ มี native select รัน A/B และไม่ให้เลือก ID เดียวกัน มีคำแนะนำเพิ่มข้อมูลเมื่อไม่ถึงสองรัน
- แสดงชื่อ, ID, Agent, ที่มา, สถานะ, เวลารวม, จำนวน spans และจำนวน spans สถานะ error ข้างกัน ใช้ RunSummary/StatusBadge/DataBlock เดิม
- ผลต่างตัวเลขเป็น B − A เวลารัน = ended_at − started_at ไม่บวก span duration ถ้ามีรันที่ยังไม่จบ ไม่คำนวณผลต่างเวลา ไม่มีคะแนนคุณภาพหรือค่าใช้จ่าย
- เลือกขั้นตอน A/B เองจากรายการเรียง started_at ไม่จับคู่หรือเลือกขั้นตอนอัตโนมัติ แม้ ID ตรงกัน เมื่อเปลี่ยนรันฝั่งเดียวล้างเฉพาะ step ฝั่งนั้น รันไม่มี spans มี empty state
- สลับ A/B พร้อมย้ายขั้นตอนตามรัน และย้อนกลับได้ โหมดเดี่ยวยัง mounted แต่ซ่อน จึงรักษารัน/ขั้นตอน/search/filter และ spanDepths memo เดิม เมื่อกลับเข้าเปรียบเทียบ คู่เดิมยังอยู่ใน state
- เทียบ type/name/status/ระยะเวลา/input/output/error ระดับฟิลด์ มีเหมือนกัน/ต่างกัน/ยังเลือกไม่ครบ เทียบ JSON แบบ iterative ตามโครงสร้าง key order ของ object ไม่มีผล แต่ array order มีผล string ตรงตัว และแยก null/0/false/empty string/array/object
- payload แสดงเป็นข้อความเดิมผ่าน React ไม่รันโค้ดหรือ HTML JSON.stringify ใช้เฉพาะการแสดงข้อมูลเดิม ไม่ใช้ตัดสิน equality
- นำเข้าในโหมดเดี่ยวยังเลือกรันใหม่ตามเดิม ในโหมดเปรียบเทียบเพิ่มตัวเลือกโดยไม่เปลี่ยนคู่/ขั้นตอน/รันเดี่ยวที่เก็บไว้ การนำเข้าล้มเหลวไม่เรียก setter ของคู่เปรียบเทียบ
- จอใหญ่สองคอลัมน์ จอแคบ A แล้ว B พร้อม label และ keyboard focus ข้อมูลเปรียบเทียบอยู่เฉพาะหน่วยความจำ
- ไม่เพิ่ม dependency/diff library/virtualization ไม่เปลี่ยน schema/types/validator/search/depth logic ไม่มี auto matching, persistence, export, live logs, login, AI API หรือ deployment

## ผลตรวจอัตโนมัติ

| การตรวจ | ผล |
| --- | --- |
| npm test | ผ่าน 90/90 (78 เดิม + 12 compare tests) |
| ผลต่างสรุป | ตรวจ B − A ทั้งทิศทางบวก/ลบ, running, zero duration และรัน spans ว่าง |
| เลือกรัน/ขั้นตอน | ปฏิเสธ run ID ที่อีกฝั่งใช้, เปลี่ยนฝั่งเดียวล้างเฉพาะ step นั้น, ไม่มี auto-match แม้สองรันใช้ ID root เหมือนกัน |
| สลับ A/B | steps ย้ายตาม run และ swap สองครั้งคืน state เดิม โดยไม่แก้ state ต้นฉบับ |
| JSON equality | object สลับ keys ทุกระดับ, array สลับสมาชิก/เปลี่ยนความยาว, nested values, null/0/false/empty string/array/object, string case/whitespace |
| JSON ลึก | helper เทียบ nested object 20,000 ชั้นด้วย loop ไม่ stack overflow; ไม่ได้อ้างว่า importer/renderer รองรับ payload ลึกขนาดนี้ |
| ระดับฟิลด์ | เลือกไม่ครบได้ unselected ทุกฟิลด์, ระยะเวลาเท่ากันแม้ timestamp ต่างกัน, payload เดิมเป็น object reference เดิม |
| ไม่แก้ข้อมูล | before/after tests สำหรับสรุป, equality และ selection ผ่าน |
| npm run build รวม TypeScript | ผ่าน ได้ dist/ |
| tests เดิม | importer, schema/validation, search/filter และ depth รวม chain 100,000 ขั้นตอนยังผ่าน |

## ทดลองจริงในเบราว์เซอร์

ทดสอบ production build ใน Brave ผ่าน loopback origin ใหม่ :5194 ใช้สำเนา dist ใน .day4-qa เพื่อเพิ่มรันว่างเฉพาะ QA ไม่แก้ public/examples หรือ build ตัวจริง

- ก่อนโหลดข้อมูล เข้าโหมดเปรียบเทียบเห็นคำแนะนำต้องมีสองรัน
- เลือก A = success (12 s/5 spans/0 errors), B = tool-error (8 s/4 spans/2 errors) ได้ −4 s, −1 span, +2 error spans
- ตัวเลือกที่เป็น run ID ของอีกฝั่ง disabled ทั้ง A/B; step A/B เริ่มว่าง ไม่ถูกเลือกให้เอง
- เลือก read A และ lookup B เองได้ Type เหมือนกัน ส่วน name/status/duration/input/output/error ต่างกัน
- สลับ A/B ได้ IDs/steps ย้ายตามกันและผลต่างเป็น +4 s, +1 span, −2 errors
- กลับเดี่ยวแล้วยังเลือก read_file ของ success พร้อม query changelog และผลกรอง 1/5 ตามที่เลือกไว้ก่อนเปรียบเทียบ กลับเปรียบเทียบอีกครั้งคู่/ขั้นตอนยังอยู่
- เปลี่ยน B เป็น running ล้างเฉพาะ step B; lookup A ยังอยู่ ทุก field เป็น unselected จนเลือกครบ ไม่มีผลต่างเวลา
- เลือก pending step B แล้วเปลี่ยน A เป็นรันว่าง A step selector disabled และแจ้งรัน A ไม่มีขั้นตอน แต่ B step ยังเลือกเดิม
- viewport 375×812 มี comparison grid หนึ่งคอลัมน์ A/B ชัดเจน document clientWidth/scrollWidth เท่ากัน 360px หลังหัก scrollbar ไม่มี overflow ทั้งหน้า Tab จาก run A ไป run B มี solid focus outline
- ตรวจชื่อ/ID/Agent/ที่มาและสถานะในสรุปทั้งสองฝั่ง และบันทึกภาพ docs/day4-preview.jpg

## ตรวจจากโค้ดและส่วนที่ยังไม่ได้ตรวจจริง

- การนำเข้าล้มเหลว/สำเร็จไม่เปลี่ยน comparison state: ตรวจจาก importer ที่ไม่เรียก setComparison และใช้ IDs หา run/span ในรายการที่เพิ่มต่อท้าย ไม่ใช่ index การนำเข้าใน compare mode ไม่เรียก setRunId/setSpanId จึงรักษารันเดี่ยวที่ซ่อนไว้ด้วย
- ยังไม่ได้ยืนยัน flow นำเข้าไฟล์ระหว่างเปรียบเทียบแบบ browser end-to-end หรือเปรียบเทียบที่มาจากไฟล์จริงผ่าน UI รอบนี้ ข้อจำกัดสิทธิ์ Allow access to file URLs ของส่วนขยายจาก Day 3 ยังไม่ได้แก้ ไม่ลองเปลี่ยน settings และไม่ได้อ้างว่า file picker ผ่านแล้ว Node importer tests เดิมยังผ่าน
- ไม่ได้ทดสอบ screen reader จริง, browser อื่น, log ใหญ่ หรือวัด render/input latency ใช้ native step selects ซึ่งยังมีทุก option ไม่มี virtualization
- equality helper รองรับข้อมูลลึกแบบ iterative แต่ DataBlock เดิมยัง pretty-print JSON ด้วย JSON.stringify การผ่าน helper test ไม่รับรองการอ่าน/render payload ลึกมาก
- เครื่องมือ capture screenshot ครั้งหนึ่ง timeout; ตรวจ DOM ยืนยันข้อมูลปัจจุบันแล้วใช้ tab screenshot API เก็บภาพสำเร็จ ไม่ใช้ timeout นี้เป็นตัววัดความหน่วงของแอป
- ปิด QA tab/server และลบสำเนา .day4-qa เมื่อจบ ไม่ปิด dev server :5173 ที่มีอยู่ก่อน

## ไฟล์หลักและการเปิด

- src/compare.ts — selection A/B, swap, duration/delta และ structural equality
- src/App.tsx — โหมด/controls และ comparison fields ใช้ components เดิม
- src/styles.css — layout สองฝั่งและจอแคบ
- tests/compare.test.mjs — 12 tests ใหม่
- README.md, DAY4.md และ docs/day4-preview.jpg — วิธีใช้ ผลตรวจ และหลักฐาน

ใช้ npm run dev แล้วเปิด http://127.0.0.1:5173/ หรือใช้ server เดิม กดโหลดตัวอย่าง/นำเข้าข้อมูล แล้วเลือกโหมดเปรียบเทียบตาม README

## งานต่อที่เสนอ (ยังไม่ได้ทำ Day 5)

บันทึกในเบราว์เซอร์และส่งออก กำหนดกติกา restore, run ID ชน และข้อมูลใดเก็บไว้ก่อนเริ่ม ไม่รวม auto matching, live logs, login หรือ AI วิเคราะห์

## แก้ duration ที่ยังไม่จบจากรีวิว — 14 ตุลาคม 2026

เพิ่ม FieldDifference `unavailable` เฉพาะ duration ใน compareSpanFields หลังตรวจว่ามีขั้นตอนครบสองฝั่ง หาก ended_at ของฝั่งใดเป็น null จะแสดง **"ยังเปรียบเทียบไม่ได้ — ขั้นตอนยังไม่จบ"** พร้อม style แยกและข้อความประกอบ เลือกไม่ครบยังเป็น unselected ทั้งคู่จบแล้วใช้ equality ของระยะเวลาเดิม รวม 0

ไม่แก้ jsonEqual, elapsedMs หรือ summaryDifference: input/output/error ที่เป็น null ทั้งคู่ยัง same ผลต่างเวลารวมของรันยังไม่คำนวณเมื่อรันยังไม่จบ ไม่เพิ่ม dependency หรือเปลี่ยน schema แก้ README ที่อธิบายพฤติกรรมเก่าให้ตรงกับการแก้นี้

- npm test ผ่าน **97/97** (90 เดิม + 7 regression tests) ครอบคลุมเลือกไม่ครบ, ทั้งคู่ยังไม่จบ, จบฝั่งเดียวทั้ง A/B, จบแล้วต่างกัน, 0 ทั้งคู่ และ null payload ที่ยัง same; กรณีจบแล้วระยะเวลาเท่ากันและผลต่างรันยังผ่าน tests เดิม
- npm run build รวม TypeScript ผ่าน
- ทดลองจริงใน Brave บน production build สำเนา QA :5196 เพิ่มสองรัน running เฉพาะสำเนาและกำหนด input/output/error ของ root เป็น null ไม่เปลี่ยนตัวอย่างต้นฉบับ
- Browser ยืนยัน unselected ก่อนเลือกครบ, unavailable เมื่อทั้งคู่ยังไม่จบและกรณีฝั่งเดียวทั้ง A/B, same เมื่อเลือก prompt ที่จบแล้วทั้งคู่ ระยะเวลา 1 s ส่วน null payload ทั้งสามยัง same ข้อความผลต่างเวลารวมของรันยังเป็นไม่มีผลต่างเวลาเมื่อรัน running
- เก็บภาพ docs/duration-unavailable-preview.jpg ปิดแท็บ/server และลบสำเนา QA ที่สร้างเองเมื่อจบ
- **ไม่ได้ตรวจใน browser รอบนี้:** zero duration และ finished-but-different (ผ่าน automated tests), file picker/import flow, screen reader หรือ browser อื่น ไม่ได้เพิ่ม Day 5 หรือเผยแพร่

ไฟล์หลักที่แก้: src/compare.ts, src/App.tsx, src/styles.css, tests/compare.test.mjs, README.md และบันทึกนี้
