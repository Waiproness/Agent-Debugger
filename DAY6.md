# ผลงาน Day 6 — 14 ตุลาคม 2026

ตรวจการใช้งานต่อจาก Day 5 ภายในกรอบไม่เกิน 4 ชั่วโมง หยุดเมื่อการตรวจที่เครื่องมือรองรับและบันทึกผลครบ ส่วน native flows ที่เครื่องมือไม่รองรับระบุเป็นรายการทดลองเองด้านล่าง **ไม่พบบั๊กในแอปจากกรณีที่ตรวจ จึงไม่แก้ production code หรือเพิ่มฟีเจอร์/dependency**

## ขอบเขตและการแยกข้อมูล

- อ่านคำแนะนำ ponytail/coding-workflow/computer-use, README และ DAY1–DAY5 รวมข้อจำกัดการตรวจเดิม ตรวจ ancestor และไฟล์ในโปรเจกต์แล้วไม่มี AGENTS.md ที่เกี่ยวข้อง และยังไม่มี Git repository
- ใช้ React/TypeScript/Vite, Node test runner และ fake-indexeddb เดิม ตรวจ importer/validator, App event handlers, search/view/compare, workspace/storage/export และ tests ที่เกี่ยวข้อง
- UI QA อยู่ที่ **http://127.0.0.1:5206/** เริ่มด้วยรายการว่าง ใช้ข้อมูลสมมติจาก public/examples สามไฟล์ เพิ่มเฉพาะรันว่างและ payload ทดสอบ HTML/ค่าจริงในหน้า QA ชั่วคราว ไม่มี backend/AI API หรือเผยแพร่ออนไลน์
- ดาวน์โหลด workspace ผ่าน production preview อีก origin **http://127.0.0.1:5208/** โดยโหลดตัวอย่างเดิม ไม่บันทึกตัวอย่างลง storage
- ไม่ควบคุมแท็บผู้ใช้ที่ :5173 ไม่อ่าน/เขียน IndexedDB ของ origin นั้น ไม่ล้างข้อมูลเว็บไซต์ เปลี่ยน settings หรือแตะรันจริง
- การนำเข้า UI ใช้ File/DataTransfer และ dispatch change ใน QA iframe; **ไม่ใช่การเลือกไฟล์จาก OS** การลบ UI ใช้ confirm จำลอง true/false เฉพาะ iframe; **ไม่ใช่ native confirm** ส่วน React handlers, validation, save/delete transactions และ IndexedDB ที่ใช้เป็นของแอปจริง

## ผลตรวจ

| การตรวจ | ผลและชนิดหลักฐาน |
| --- | --- |
| Automated regression | Node tests **120/120**, ไม่มี skip; typecheck และ Vite build ผ่าน เทียบเท่าคำสั่ง npm ใน README (shell runner เริ่ม process ไม่ได้ จึงเรียก Node scripts โดยตรงผ่าน child_process แบบไม่เปิดหน้าต่าง) |
| UI QA | **36 checks ผ่าน** รวมการลบข้อมูลสมมติเดิมสำหรับ rerun 1 check; ผลรายข้อใน [docs/day6-checks.json](docs/day6-checks.json) |
| ตัวอย่างเดิม | success/tool-error/parallel-nested นำเข้าและบันทึกผ่าน UI handler; ระยะเวลารวม 12 s / 8 s / ยังไม่จบ และ spans 5/4/6 |
| ไฟล์หลายรัน / ไม่มี spans | เพิ่มสองรันจากไฟล์เดียวกัน เก็บ filename ของทั้งสอง; timeline ว่างและ step selector ของ comparison ฝั่งรันว่าง disabled |
| runs ว่าง | ตรวจผ่านโดยไม่เปลี่ยนรายการรัน รัน/ขั้นตอนเดี่ยว คำค้น/status/type หรือ A/B |
| JSON / schema / version ผิด | syntax, required fields และ version 99 ปฏิเสธพร้อม error; state เดิมทุกส่วนคงเดิม |
| ID / parent / เวลา | duplicate run/span, parent หาย, self-parent, วงสองโหนด, end ก่อน start และวันที่ไม่มีจริง ปฏิเสธ; state เดิมทุกส่วนคงเดิม |
| เกิน 10 MiB | File จำลองจริงใน browser ขนาด 10,485,761 bytes ถูกปฏิเสธ; spy ของ readImport ยืนยันไม่เรียก text ก่อนปฏิเสธ และ test เดิมครอบคลุมขนาดเท่าเพดาน |
| เลือกไฟล์เดิมซ้ำ | dispatch change ด้วยไฟล์เดิมสองครั้ง ครั้งที่สองเข้าสู่ importer และถูกปฏิเสธ ID ชน; input.value ถูก reset ผลนี้ไม่แทนการทดสอบ OS picker |
| ข้อความ HTML/โค้ด | input ที่มี img/onerror/script แสดงเป็น JSON text พร้อม escaped quotes ไม่มี img/script node หรือการรันโค้ด ค่า null/0/false/ข้อความว่าง/array/object คงเดิม |
| ค้นไทยใน input/output/error | ทั้งสามทางค้นพบข้อมูลต้นฉบับ รวม error code ที่ซ้อนอยู่; query+status+type ทำงานแบบ AND |
| parent ถูกกรอง | read-benchmark ยัง depth 3, padding 46px, bar เริ่ม 50% และแกนเวลา/ขนาดเดิมจากรันเต็ม |
| selection ถูกซ่อน | details เดิมอยู่ มี notice และปุ่มล้างตัวกรองกลับไปดูขั้นตอนเดิมได้ |
| A/B | เลือกขั้นตอนเอง ไม่มี auto-match, delta B−A = −4 s, swap ย้าย run/span ไปด้วยกันและสลับกลับได้ เปลี่ยนรันฝั่งเดียวล้างเฉพาะ span ฝั่งนั้น |
| ขั้นตอนยังไม่จบ | เมื่อเลือกครบทั้งสองฝั่งและฝั่งหนึ่ง pending แสดง “ยังเปรียบเทียบไม่ได้ — ขั้นตอนยังไม่จบ”; regression เดิมตรวจทั้งสอง pending, จบฝั่งเดียวทั้ง A/B และ 0 duration |
| สลับโหมด / นำเข้าใน compare | กลับ single คืนรัน/span/query/status/type เดิม; import สำเร็จใน compare เพิ่มตัวเลือกโดยไม่เปลี่ยนคู่/span หรือ single ที่ซ่อน |
| Save/reload | IndexedDB จริงคืน 5 รัน ตามลำดับและ filename พร้อมข้อมูลเต็มตรงกับ export; reload เลือกรันแรกและล้าง filters/comparison ตามกติกา |
| โหลดตัวอย่างหลัง restore | ข้าม ID เดิมทั้งสาม ไม่เพิ่มรายการซ้ำ |
| Delete cancellation | confirm จำลอง false คงข้อมูลและตรวจ prompt มีชื่อ/ID; native cancellation ยังไม่ได้ตรวจ |
| Delete acceptance | confirm จำลอง true ลบ saved A แล้ว A/spanA ว่าง แต่ B/spanB อยู่; ลบรันเดี่ยวที่เลือกท้ายรายการวนไปรันแรก ลบ fixtures จนหมดแล้ว reload ยังว่าง |
| Failure/retry | automated tests เดิมตรวจ quota/access/abort/rollback, retry, corrupt storage/version, transaction ซ้อน และไม่มี partial save; รอบนี้ไม่ได้ทำดิสก์จริงเต็มหรือจำลอง faults ใน browser ซ้ำ |
| Export ขณะกรอง | UI handler สร้าง Blob เต็มทุก span ไม่รวม filename/storage metadata; captured single และ workspace 5 รันตรง source |
| Download จริง | อ่านไฟล์จาก Downloads ด้วย validator และ deep equality: รันเดี่ยว 2,024 bytes / 5 spans และ workspace 5,716 bytes / 3 รัน spans 5/4/6 ตรงต้นฉบับทุกฟิลด์ |
| Production UI | preview :5208 โหลดตัวอย่าง ค้น changelog+success+tool พบ 1/5 เลือก read_file ได้; ภาพ [docs/day6-preview.jpg](docs/day6-preview.jpg) |
| Console | ไม่พบ error/warn จากแอปในรายการที่ตรวจรอบ UI สุดท้าย ไม่ใช่การรับรองทุกเหตุการณ์หรือ browser อื่น |

ไฟล์ดาวน์โหลดจริง: agent-debugger-run-1791950629493.json และ agent-debugger-workspace-1791950985969.json ใน Downloads ไม่ลบไฟล์เหล่านี้หรือไฟล์จากวันก่อนอัตโนมัติ UI แสดง “เริ่มดาวน์โหลด” จึงตรวจไฟล์ที่เกิดจริงแยกจากข้อความบนหน้าจอ

## ช่องว่าง native flow และรายการทดลองเอง

เครื่องมือเลือกไฟล์ยังแจ้งว่าต้องเปิด Allow access to file URLs ของส่วนขยาย ซึ่งไม่ได้เปลี่ยน ส่วน Windows Computer Use หยุดเพราะยืนยัน URL ของหน้าต่างไม่ได้ จึงหยุด native automation ตามข้อจำกัด ไม่ฝืนส่ง input ไปยังหน้าต่างผู้ใช้ และไม่ได้ทดสอบ native confirm ยืนยัน/ยกเลิกจริง ไม่มีการอ้างว่าผล File/DataTransfer หรือ confirm fixture ผ่าน native flow

ใช้ข้อมูลสมมติบน origin QA ใหม่ เช่น **http://127.0.0.1:5216/** เปิดด้วย:

~~~powershell
npm run dev -- --port 5216
~~~

หากพอร์ตถูกใช้ให้เลือกพอร์ตว่างอื่น ตรวจ URL ให้ต่างจาก :5173 และรายการเริ่มว่างก่อนทดลอง อย่าล้างข้อมูลเว็บไซต์หรือใช้รันจริง

1. **Picker เลือกไฟล์:** กดเลือกไฟล์ JSON แล้วเลือก public/examples/success.json จาก dialog ของระบบ ต้องมี 1 รัน/5 spans และบันทึกสำเร็จ จากนั้นเลือก tool-error.json และ parallel-nested.json ตรวจ 3 รัน/15 spans
2. **Picker ยกเลิก:** เลือกขั้นตอน ตั้ง query/status/type และ A/B+ขั้นตอนทั้งสองไว้ เปิด picker แล้วกด Cancel ต้องคงรายการรัน selection ตัวกรอง และคู่เปรียบเทียบเดิม
3. **Picker เลือกไฟล์เดิมซ้ำ:** เลือก success.json อีกครั้งสองรอบ ต้องถูกปฏิเสธ ID ซ้ำทั้งสองครั้งและคง state; เพื่อยืนยัน retry จาก path เดิม ให้ใช้สำเนาข้อมูลสมมติที่มี run ID ใหม่ ทำ schema_version ผิด เลือกจน error แล้วแก้ version กลับเป็น 1 และเลือก path เดิมอีกครั้ง ต้องนำเข้าได้
4. **Native confirm:** กดลบรัน QA แล้วตรวจชื่อ/ID ใน dialog กด Cancel ต้องคงรัน/selection/A/B; เปิด dialog ใหม่ กด OK ต้องลบรันนั้น เมื่อ reload ต้องไม่กลับมา และคู่/ขั้นตอนอีกฝั่งต้องอยู่เดิม

## สิ่งที่เปลี่ยนและการจบงาน

เปลี่ยนเฉพาะ README, DAY6.md และหลักฐาน docs/day6-checks.json / docs/day6-preview.jpg ไม่เปลี่ยน src, schema, tests, package manifest/lockfile หรือ public examples เนื่องจากไม่มี app bug ที่ reproduce ได้

หน้า QA ชั่วคราวมีข้อผิดพลาดของ harness เองระหว่างเตรียม: closing script tag ต้อง escape, การตรวจ string ต้องเทียบรูปแบบ JSON.stringify เดิม และการโหลด samples ต้องรอ async operation ไม่ตีความว่าเป็นบั๊กของแอป แก้ harness แล้วจบรอบ 36 checks ผ่าน การดาวน์โหลดหลายไฟล์อัตโนมัติในหน้า QA ไม่เกิด workspace file ที่ :5206 จึงใช้ fresh origin :5208 ดาวน์โหลด workspace เพียงครั้งเดียวโดยไม่เปลี่ยน browser settings

ลบเฉพาะ fixtures สมมติผ่าน App delete ใน QA :5206 แล้วตรวจ reload ว่าง ไม่ล้าง database หรือเว็บไซต์ ปิดเฉพาะแท็บ/server ที่เปิดเอง และลบหน้า QA ชั่วคราว ไม่มี confirm override/fault injection/fixture controls ใน source หรือ production bundle

ยังไม่ได้ตรวจ OS picker/native confirm จริง, screen reader, browser อื่น/private mode, workspace ใหญ่, crash/power loss หรือประสิทธิภาพเชิงตัวเลข ข้อจำกัด storage/export เดิมของ Day 5 ยังมีอยู่ การไม่พบบั๊กในกรณีนี้ไม่ใช่การรับรองว่าไม่มีบั๊กทุกกรณี
