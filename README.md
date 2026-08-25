# BusGo — ระบบจองคิวรถบัสออนไลน์

ระบบดูรอบรถ + จองคิวรถบัส พร้อมหลังบ้านสำหรับผู้ดูแล ทำงานด้วย **Node.js ล้วน (ไม่มี dependencies)**

##ฟีเจอร์

- ค้นหารอบรถ กรองตามต้นทาง / ปลายทาง / วันที่ / ประเภทรถ (VIP, ปรับอากาศ, ธรรมดา)
- เลือกที่นั่งแบบ Seat Map จองได้หลายที่นั่ง พร้อมกันที่นั่งซ้ำฝั่งเซิร์ฟเวอร์
- e-Ticket พร้อมรหัสตั๋วและ Barcode
- "ตั๋วของฉัน" — ดู/ยกเลิกการจองของตัวเอง
- หลังบ้าน (Admin): Dashboard รายได้, จัดการการจอง, Export CSV, เพิ่ม/แก้/ลบเที่ยวรถ
- ฐานข้อมูลไฟล์ JSON (`data/db.json`) บันทึกถาวร

## วิธีรัน

```bash
node server.js
```

หรือดับเบิลคลิก `start.bat` (Windows)

| หน้า | URL |
|------|-----|
| หน้าเว็บหลัก | http://localhost:3000 |
| หลังบ้าน | http://localhost:3000/admin |
| รหัสผ่าน Admin | `admin1234` (แก้ได้ที่ `ADMIN_KEY` ใน `server.js`) |

## API

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/api/buses` | รายการเที่ยวรถ |
| POST / PUT / DELETE | `/api/buses/:id` | จัดการเที่ยวรถ (ต้องมี `x-admin-key`) |
| GET | `/api/bookings` | รายการการจองทั้งหมด |
| POST | `/api/bookings` | จองตั๋ว (ตรวจที่นั่งซ้ำอัตโนมัติ) |
| PATCH | `/api/bookings/:code/cancel` | ยกเลิกการจอง |
| DELETE | `/api/bookings/:code` | ลบการจองถาวร (ต้องมี `x-admin-key`) |

## โครงสร้างไฟล์

```
├── index.html    # หน้าเว็บหลัก (จองตั๋ว)
├── style.css     # ธีม Dark + Glassmorphism
├── script.js     # Logic หน้าเว็บหลัก
├── admin.html    # หน้าหลังบ้าน
├── admin.js      # Logic หลังบ้าน
├── server.js     # Backend + REST API (Node.js ล้วน)
├── start.bat     # รันเซิร์ฟเวอร์ (Windows)
└── data/db.json  # ฐานข้อมูล (สร้างอัตโนมัติ)
```

## เทคโนโลยี

HTML5 · CSS3 · JavaScript (Vanilla) · Node.js (http module ล้วน)

## อัปขึ้นเว็บจริง (Render.com — ฟรี)

1. Push repo นี้ขึ้น GitHub (มีไฟล์ `render.yaml` blueprint เตรียมไว้แล้ว)
2. ไปที่ [render.com](https://render.com) → สมัคร/ล็อกอิน **ด้วย GitHub**
3. New + → **Blueprint** → เลือก repo → Render จะอ่าน `render.yaml` อัตโนมัติ
4. ตั้ง env var `ADMIN_KEY` = รหัสผ่านหลังบ้านที่ต้องการ → Apply
5. รอ build ~2 นาที → ได้ URL สาธารณะ เช่น `https://busgo-xxxx.onrender.com`

> หมายเหตุ Free tier: เว็บจะ "หลับ" ถ้าไม่มีคนใช้ 15 นาที (เปิดใหม่ใช้เวลาโหลด ~50 วินาที) และไฟล์ `data/db.json` จะรีเซ็ตเมื่อ redeploy
