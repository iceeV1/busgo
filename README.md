# BusGo — ระบบจองตั๋วและบริหารจัดการสถานีขนส่งอัจฉริยะ (Smart Transit Platform)

แพลตฟอร์มระบบขนส่งมวลชนอัจฉริยะแบบครบวงจร (จองตั๋วรถบัสออนไลน์ + แผนที่เรดาร์ติดตามพิกัดรถสดตามแนวถนนหลวง + ระบบบริหารจัดการหลังบ้าน + ศูนย์สำรวจฐานข้อมูลสด) ขับเคลื่อนด้วยสถาปัตยกรรม **Pure Node.js Zero-Dependency** (ไม่มี external npm dependencies)

---

## ลิงก์ระบบออนไลน์จริง (Live Production URLs)

- **หน้าบ้านหลัก (ระบบค้นหาและจองตั๋ว)**: https://busgo.dpdns.org/
- **ระบบบริหารจัดการหลังบ้าน (Admin Console)**: https://busgo.dpdns.org/admin
- **ศูนย์สำรวจฐานข้อมูลสด (Real-Time Database Explorer)**: https://busgo.dpdns.org/database
- **API ตรวจสอบเวอร์ชันและสถานะระบบ**: https://busgo.dpdns.org/api/version

---

## ไฮไลท์ฟีเจอร์สำคัญของระบบ (Key Features)

### 1. ระบบค้นหาและจองตั๋วโดยสารอัจฉริยะ (Smart Booking & Seat Selection)
- ค้นหาเที่ยวรถตามสถานีต้นทาง, สถานีปลายทาง, วันที่เดินทาง และประเภทรถ (VIP Luxury, ปรับอากาศ, ธรรมดา)
- ผังที่นั่งแบบโต้ตอบสด (Interactive SVG/CSS Seat Map) เลือกได้หลายที่นั่งพร้อมกัน
- ระบบป้องกันการจองที่นั่งซ้ำซ้อนระดับเสี้ยววินาที (In-Memory Mutex Lock & Concurrency Control)
- รองรับระบบโค้ดส่วนลดโปรโมชั่น (Promotion Code) คำนวณยอดเงินสุทธิอัตโนมัติ
- รองรับระบบชำระเงินผ่าน PromptPay QR Code แบบจำลองเสมือนจริง

### 2. แผนที่เรดาร์ติดตามพิกัดรถสดตามแนวถนนหลวง (Live Highway GPS Tracking)
- แผนที่ดาวเทียมไฮบริดและแผนที่ไซเบอร์ดาร์กขับเคลื่อนด้วย GPU Canvas Vector Rendering (`preferCanvas: true`) แสดงผลลื่นไหลระดับ 60 FPS
- เวกเตอร์เส้นทางรถบัสวิ่งตามแนวเส้นทางหลวงแผ่นดินจริง (Real Highway Routes: พหลโยธิน, มิตรภาพ, เพชรเกษม, สุขุมวิท ฯลฯ)
- มาร์กเกอร์รถบัสเคลื่อนที่นุ่มนวลต่อเนื่องด้วย CSS Hardware Acceleration Glide Transition
- ระบบกล่องค้นหาเรดาร์และแผงควบคุมตารางรถสด (Fleet Drawer) พร้อม In-Place DOM Reconciliation ไม่กระตุกขณะเลื่อนดู

### 3. ระบบความปลอดภัยระดับสูงและป้องกันการสอดแนม (Security & Anti-Inspection Shield)
- ระบบป้องกันการกด F12, Ctrl+Shift+I/J/C, Ctrl+U และคลิกขวา Inspect บนหน้าเข้าสู่ระบบทุกอัน
- นโยบายความปลอดภัยของเนื้อหา (Content-Security-Policy) รัดกุม ป้องกัน XSS และ Clickjacking
- การควบคุมสิทธิ์ (Permissions-Policy) ตามมาตรฐานความปลอดภัยสากล
- ระบบ Rate Limiting ต่อหมายเลข IP ป้องกันการโจมตีแบบ DoS / Brute Force
- ระบบล็อกบัญชีผู้ดูแลชั่วคราว (Admin Lockout) เมื่อกรอกรหัสผ่านผิดซ้ำ

### 4. ระบบบริหารจัดการหลังบ้าน (Admin Console)
- หน้าจอกราฟสรุปยอดขาย, จำนวนที่นั่ง, รายได้รวม และสถิติเที่ยวรถ
- ตารางตรวจสอบรายชื่อผู้โดยสารและสถานะตั๋ว (Active, Checked-in, Cancelled)
- ระบบสแกนและตรวจรับตั๋วขึ้นรถ (Check-in Scanner System)
- การส่งออกรายงานเป็นไฟล์ Microsoft Excel/CSV ด้วยการเข้ารหัส UTF-8 with BOM:
  - รายชื่อผู้โดยสารรายเที่ยว (Passenger Manifest CSV)
  - สรุปยอดขายแยกตามเส้นทาง (Sales Summary CSV)

### 5. ศูนย์สำรวจและจัดการฐานข้อมูลสด (Dual-Layer Database Architecture)
- สถาปัตยกรรมฐานข้อมูล 2 รูปแบบคู่ขนาน:
  - **NoSQL Document Store (JSON Engine)** สำหรับการประมวลผลความเร็วสูงระดับ Microsecond
  - **Relational SQL Schema Exporter** แปลงข้อมูลเป็นชุดคำสั่ง SQL (`busgo_database.sql`) รองรับการนำเข้า MySQL / MariaDB / PostgreSQL ได้ทันที
- หน้าสำรวจโครงสร้างและข้อมูลตารางสด (`/database`) แสดงโครงสร้างฟิลด์ ชนิดข้อมูล และเรคคอร์ดล่าสุดแบบ Real-Time

---

## การเริ่มต้นใช้งานบนเครื่อง Local (Quick Start)

### ความต้องการของระบบ (System Requirements)
- ติดตั้ง **Node.js** เวอร์ชัน 18.0.0 ขึ้นไป (ไม่มีการใช้งานแพ็กเกจภายนอก ไม่ต้องรัน `npm install`)

### ขั้นตอนการรันระบบ

1. **เปิดโฟลเดอร์โปรเจกต์ใน Terminal หรือ Command Prompt**:
   ```bash
   node server.js
   ```
   หรือสำหรับผู้ใช้ Windows: ดับเบิลคลิกที่ไฟล์ `start.bat`

2. **เปิดเบราว์เซอร์เข้าใช้งาน**:
   - หน้าบ้านหลัก: `http://localhost:3000`
   - ระบบหลังบ้าน: `http://localhost:3000/admin`
   - หน้าฐานข้อมูล: `http://localhost:3000/database`

3. **ข้อมูลเข้าสู่ระบบผู้ดูแลระบบสำหรับการทดสอบ**:
   - รหัสผ่านผู้ดูแลระบบ (Local Dev): `admin1234`

---

## โครงสร้างไฟล์โปรเจกต์ (Project Directory Structure)

```
busgo/
├── index.html            # หน้าเว็บหลัก: ค้นหาเที่ยวรถ ผังที่นั่ง ชำระเงิน ตั๋วของฉัน และแผนที่เรดาร์สด
├── admin.html            # หน้าเว็บระบบหลังบ้านสำหรับผู้ดูแลระบบ
├── database.html         # ศูนย์สำรวจและตรวจสอบโครงสร้างฐานข้อมูล Real-Time
├── style.css             # สไตล์ชีตระบบ ดีไซน์แบบ Cyber Dark Glassmorphism
├── script.js             # ลอจิกฝั่งผู้ใช้งาน การจอง แผนที่เรดาร์ และการจัดการสเตท
├── admin.js              # ลอจิกฝั่งผู้ดูแลระบบ การวิเคราะห์สถิติ และการส่งออกรายงาน
├── database.js           # ลอจิกฝั่งตรวจสอบฐานข้อมูลและสคีมาแบบ Real-Time
├── theme-boot.js         # สคริปต์บูตธีมและระบบรักษาความปลอดภัย ป้องกันการกด F12 บนหน้าล็อกอิน
├── routes.js             # ชุดข้อมูลพิกัดเส้นทางหลวงแผ่นดินความละเอียดสูง
├── leaflet.js            # ไลบรารีแผนที่เวกเตอร์
├── leaflet.css           # สไตล์ชีตของระบบแผนที่
├── busgo_database.sql    # สคริปต์โครงสร้างตารางและข้อมูล SQL Dump ล่าสุด
├── server.js             # เซิร์ฟเวอร์และ REST API ฝั่ง Backend (Node.js Built-in Modules ล้วน)
├── start.bat             # สคริปต์ดับเบิลคลิกรันเซิร์ฟเวอร์บนระบบปฏิบัติการ Windows
├── package.json          # ไฟล์คอนฟิกโครงการตามมาตรฐาน Node.js
├── render.yaml           # บลูปริ้นต์การ Deploy อัตโนมัติบน Render Cloud
└── README.md             # เอกสารคู่มือระบบฉบับสมบูรณ์
```

---

## เทคโนโลยีที่นำมาประยุกต์ใช้ (Technology Stack)

- **Frontend**: HTML5 Semantic Markup, Vanilla CSS3 (Custom Properties, Flexbox, CSS Grid, Transitions), JavaScript ES6+ (Native Fetch, Canvas API, Async/Await)
- **Backend**: Node.js Core Runtime (`http`, `fs`, `path`, `crypto`, `zlib`)
- **Optimization**: Native Gzip Compression, ETag 304 Caching, GPU Canvas Vector Rendering
- **Database Engine**: Dual-Layer JSON Persistence Engine with Relational SQL Interchange
- **Mapping & GIS**: Leaflet Map Engine with Road-Aligned Highway Polylines

---

## ข้อมูลสำหรับการส่งงานและการประเมินโครงงาน

- โปรเจกต์นี้ได้รับการพัฒนาและตรวจสอบตามข้อกำหนดมาตรฐาน:
  - ปราศจาก Emoji ทุกตำแหน่งในโค้ดและส่วนติดต่อผู้ใช้ (Zero-Emoji Compliance)
  - ปราศจาก Error หรือ Warning ใน DevTools Console (Clean Console Verification)
  - ซอร์สโค้ดทั้งหมดบรรจุอยู่ในไฟล์ `busgo_source_code.zip` พร้อมสำหรับการส่งมอบงาน
