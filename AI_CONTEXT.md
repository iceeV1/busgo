# AI_CONTEXT.md — บริบทโปรเจกต์ BusGo สำหรับ AI Session

> ไฟล์นี้คือ "ความจำ" ของโปรเจกต์ — ทุกครั้งที่เปิดแชทใหม่ (เครื่องไหนก็ได้)
> ให้สั่ง AI: **"อ่าน AI_CONTEXT.md แล้วทำงานต่อ"**
> เมื่อทำงานเสร็จแต่ละชุด ให้ AI อัปเดตไฟล์นี้และ commit ด้วย
> ห้ามใส่รหัสผ่าน / API key / ความลับในไฟล์นี้ (repo เป็น public)

---

## ภาพรวมโปรเจกต์

- **BusGo** — เว็บจองตั๋วรถบัส (ไทย, รถบัสเท่านั้น) deploy บน Render free tier
- โดเมนหลัก `https://busgo.dpdns.org` ผ่าน Cloudflare free tier (proxied), fallback `https://busgo-359q.onrender.com`
- Stack: Node.js ล้วน (server.js ไม่มี npm install), frontend vanilla HTML/CSS/JS, DB = `data/db.json` + Upstash Redis (env `UPSTASH_REDIS_REST_URL/TOKEN`)
- Admin key อยู่ที่ env `ADMIN_KEY` บน Render (ตั้งค่าแล้ว, ไม่ใช่ admin1234)

## สถานะปัจจุบัน (อัปเดต: 2026-08-26)

- เวอร์ชัน **1.1.0** — Phase 1 ระบบสแกนตั๋วเข้า-ออกรถ (Check-in System) เสร็จสมบูรณ์
- รายละเอียด v1.0.2: ดูหัวข้อ "งานรัดความปลอดภัย v1.0.2" ด้านล่าง
- Cloudflare: SSL Full (strict), Always Use HTTPS, Bot Fight Mode, Rate Limit 100 req/min/IP (Block 10 นาที), WAF block `/admin` จากต่างประเทศ (TH only)
- Phase 0 (โดเมน+โครงสร้าง) และ Phase 1 (ระบบสแกนตั๋ว/เช็คอิน) ปิดแล้ว

## งานรัดความปลอดภัยที่ทำไปแล้ว (v1.0.1)

1. `GET /api/bookings`: non-admin เห็นเฉพาะ code/busId/date/seats/status/total (ซ่อน name/phone/note กัน PII leak) — admin ใส่ header `x-admin-key` เห็นเต็ม
2. `PATCH /api/bookings/:code/cancel`: admin ผ่านได้เลย / ผู้จองต้องส่ง body `{ "phone": "..." }` ให้ตรงเบอร์ผู้จอง (403 ถ้าไม่ตรง)
3. `clientIp()`: ใช้ `CF-Connecting-IP` เมื่อมาผ่าน CF (host busgo.dpdns.org/www + มี cf-ray) ไม่งั้นใช้ XFF hop สุดท้าย — กันปลอม IP bypass rate limit/lockout
4. รหัสตั๋วสุ่ม crypto (`BG-` + randomBytes(3).hex) เดาไม่ได้
5. isAdmin ใช้ timingSafeEqual / มี CSP header / path.relative กัน traversal
6. script.js: `withPii()` เติมข้อมูลส่วนตัวตั๋วตัวเองจาก localStorage mirror, saveMirror merge PII ไม่ทำลาย
7. (`d6944f6`) บล็อก serve static ของ server.js, render.yaml, *.md, pss.txt, .env, db.json — โค้ด backend/config ไม่หลุดทางหน้าเว็บ

## งานรัดความปลอดภัยที่ทำไปแล้ว (v1.0.2)

8. Write mutex `withDbLock()` (promise queue, zero-dependency): serialize ทุก write API (POST/PUT/DELETE/PATCH) — Node event loop แทรก request อื่นกลาง read-check-write ทำให้เคยจองที่นั่งซ้ำได้; ทดสอบยิง 2 request พร้อมกันที่นั่งเดิมแล้วได้ 201+409 ถูกต้อง
9. Fail-fast: production (`NODE_ENV=production` / `RENDER=true`) ไม่มี env ADMIN_KEY จะ exit(1) ทันที ปิดช่อง fallback เงียบๆ ไป default key; local dev ยังใช้ default ได้
10. Rate limit PATCH /api/bookings/:code/cancel = 5 ครั้ง/15 นาที/IP กัน brute force เบอร์โทรยกเลิกตั๋วผู้อื่น (โค้ดตั๋วโชว์ public); admin ยกเว้น; ทดสอบได้ 403 x5 + 429 ตามคาด
11. ที่เหลือระยะยาว: ย้าย rate-limit/lockout state ลง Upstash (อยู่รอด redeploy), เพิ่ม ticket code entropy, atomic Lua script บน Upstash REST (รองรับ MULTI/EXEC + EVAL) — ผูกกับ Phase 1.5

## Phase 1.5 ที่ทำไปแล้ว (v1.0.4)

12. **`GET /api/bookings/search?code=BG-XXXXXX&phone=0XXXXXXXXX`** — ค้นตั๋วข้ามเครื่อง (ไม่ต้อง login, ไม่ต้อง localStorage) แก้ปัญหา "เปลี่ยนมือถือ/เคลียร์ browser แล้วตั๋วหาย"; ต้องรู้ทั้งรหัสตั๋ว + เบอร์โทร (เบอร์เป็น shared secret เพิ่ม); คืนเฉพาะ public view (ไม่มี PII เพิ่ม); validate: `code` ต้องตรง `^BG-[0-9A-F]{6,12}$`, `phone` ต้องตรง `^0\d{8,9}$`; ทดสอบบนเครื่อง local ผ่าน 5/5 เคส (200, 404 code ไม่เจอ, 404 phone ไม่ตรง, 400 format ผิด, 400 phone format ผิด) — admin **ไม่ต้องใช้** endpoint นี้ ใช้ `/api/bookings` ตามเดิม
13. **UI ค้นหาตั๋วข้ามเครื่อง (เสร็จสมบูรณ์)**: เพิ่มการ์ดค้นหาตั๋วข้ามเครื่องในหน้า "ตั๋วของฉัน" (index.html, script.js, style.css) ค้นหาด้วย code + phone เมื่อพบตั๋วจะบันทึกลง localStorage mirror และแสดงผลในรายการตั๋วทันที

## Phase 1 ที่ทำไปแล้ว (v1.1.0)

14. **ระบบสแกนตั๋วเข้า-ออกรถ (Check-in System)**:
    - Backend: API `PATCH /api/bookings/:code/checkin` (admin only) เปลี่ยนสถานะเป็น `checked_in` และบันทึก `checkedInAt` พร้อมป้องกันการเช็คอินตั๋วที่ยกเลิกไปแล้ว หรือเช็คอินซ้ำ (409)
    - Backend: API `PATCH /api/bookings/:code/uncheckin` (admin only) ยกเลิกสถานะเช็คอินกรณีพนักงานกดผิด
    - Backend: ป้องกันการยกเลิกตั๋ว (`/cancel`) เมื่อตั๋วขึ้นรถไปแล้ว (`checked_in`)
    - Admin UI: เพิ่มแท็บ "สแกนตั๋ว / เช็คอิน" รองรับการยิงบาร์โค้ด QR หรือพิมพ์รหัสตั๋ว แสดงการ์ดรายละเอียดตั๋วครบถ้วนพร้อมปุ่มเช็คอิน และตารางประวัติเช็คอินขึ้นรถล่าสุด
    - Public UI: หน้า "ตั๋วของฉัน" แสดงสถานะ "ขึ้นรถแล้ว" (`status-checkedin`) พร้อมเวลาขึ้นรถ
15. ค้างต่อ: เพิ่ม Lua script บน Upstash กัน double-booking ข้าม instance, ย้าย rate-limit/lockout state ลง Redis (อยู่รอด redeploy)

## กติกาโปรเจกต์ (ห้ามลืม)

- **ห้ามใช้อีโมจิ (emoji) ทุกกรณี** ในโค้ด/UI/เอกสาร
- Deploy flow: แก้ -> `node --check server.js script.js admin.js` -> git commit/push -> เช็ค hash ที่ `/api/version` (~50 วินาที)
- Bump `APP_SEMVER` ใน server.js เมื่ออัปเดตใหญ่ (popup อัปเดตจะเด้งหา user): patch x.y.Z แก้เล็ก / minor x.Y.z ฟีเจอร์ใหม่
- อย่ายิงทดสอบรัวจนโดน rate limit ตัวเอง (Cloudflare 100/min, app-level 120/min, admin check 10 ครั้ง/5 นาที lockout)
- ทดสอบ POST/curl บน PowerShell: เขียน JSON body ลงไฟล์ด้วย UTF8 ไม่มี BOM (`[IO.File]::WriteAllText`) ไม่งั้น JSON.parse พัง

## ค้างอยู่ / Next

1. Acceptance test: ทดสอบการจองจริง 1 รอบผ่าน busgo.dpdns.org + สแกนเช็คอินใน /admin
2. Domain ต่ออายุฟรีที่ DigitalPlat ก่อน **2027-08-26**
3. แนะนำ user: ลบไฟล์ pss.txt ในเครื่องทิ้ง + เปลี่ยนรหัสที่ใช้ร่วมกันที่อื่น

## โครงสร้างไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|------|---------|
| server.js | backend ทั้งหมด: static + API + security (rate limit, lockout, CSP) |
| script.js | frontend หน้าหลัก (จอง/ตั๋วของฉัน/localStorage mirror) |
| admin.js | หลังบ้าน (login ด้วย x-admin-key, เก็บ sessionStorage) |
| data/db.json | DB local (gitignored, สร้างเองตอนรัน) |
