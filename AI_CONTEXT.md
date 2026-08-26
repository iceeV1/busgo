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

- เวอร์ชัน **1.0.1**, commit ล่าสุด `a22a4b4` — security hardening
- Cloudflare: SSL Full (strict), Always Use HTTPS, Bot Fight Mode, Rate Limit 100 req/min/IP (Block 10 นาที), WAF block `/admin` จากต่างประเทศ (TH only)
- Phase 0 (โดเมน+โครงสร้าง) ปิดแล้ว / **Phase 1 รอเริ่ม**: ระบบสแกนตั๋วเข้า-ออก (check-in)

## งานรัดความปลอดภัยที่ทำไปแล้ว (v1.0.1)

1. `GET /api/bookings`: non-admin เห็นเฉพาะ code/busId/date/seats/status/total (ซ่อน name/phone/note กัน PII leak) — admin ใส่ header `x-admin-key` เห็นเต็ม
2. `PATCH /api/bookings/:code/cancel`: admin ผ่านได้เลย / ผู้จองต้องส่ง body `{ "phone": "..." }` ให้ตรงเบอร์ผู้จอง (403 ถ้าไม่ตรง)
3. `clientIp()`: ใช้ `CF-Connecting-IP` เมื่อมาผ่าน CF (host busgo.dpdns.org/www + มี cf-ray) ไม่งั้นใช้ XFF hop สุดท้าย — กันปลอม IP bypass rate limit/lockout
4. รหัสตั๋วสุ่ม crypto (`BG-` + randomBytes(3).hex) เดาไม่ได้
5. isAdmin ใช้ timingSafeEqual / มี CSP header / บล็อก serve pss.txt, .env, db.json, dotfiles / path.relative กัน traversal
6. script.js: `withPii()` เติมข้อมูลส่วนตัวตั๋วตัวเองจาก localStorage mirror, saveMirror merge PII ไม่ทำลาย

## กติกาโปรเจกต์ (ห้ามลืม)

- **ห้ามใช้อีโมจิ (emoji) ทุกกรณี** ในโค้ด/UI/เอกสาร
- Deploy flow: แก้ -> `node --check server.js script.js admin.js` -> git commit/push -> เช็ค hash ที่ `/api/version` (~50 วินาที)
- Bump `APP_SEMVER` ใน server.js เมื่ออัปเดตใหญ่ (popup อัปเดตจะเด้งหา user): patch x.y.Z แก้เล็ก / minor x.Y.z ฟีเจอร์ใหม่
- อย่ายิงทดสอบรัวจนโดน rate limit ตัวเอง (Cloudflare 100/min, app-level 120/min, admin check 10 ครั้ง/5 นาที lockout)
- ทดสอบ POST/curl บน PowerShell: เขียน JSON body ลงไฟล์ด้วย UTF8 ไม่มี BOM (`[IO.File]::WriteAllText`) ไม่งั้น JSON.parse พัง

## ค้างอยู่ / Next

1. Acceptance test Phase 0: จองจริง 1 รอบผ่าน busgo.dpdns.org + เช็คใน /admin
2. **Phase 1**: ticket scan/check-in system (bump เป็น 1.1.0)
3. **Phase 1.5 (เสนอ)**: ช่องค้นตั๋วข้ามเครื่องด้วย รหัสตั๋ว + เบอร์โทร (API lookup ตรวจทั้งสองค่า) เพราะตอนนี้ "ตั๋วของฉัน" ผูก localStorage ของเครื่องเดิม เปลี่ยนมือถือแล้วไม่โชว์
4. Domain ต่ออายุฟรีที่ DigitalPlat ก่อน **2027-08-26**
5. แนะนำ user: ลบไฟล์ pss.txt ในเครื่องทิ้ง + เปลี่ยนรหัสที่ใช้ร่วมกันที่อื่น

## โครงสร้างไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|------|---------|
| server.js | backend ทั้งหมด: static + API + security (rate limit, lockout, CSP) |
| script.js | frontend หน้าหลัก (จอง/ตั๋วของฉัน/localStorage mirror) |
| admin.js | หลังบ้าน (login ด้วย x-admin-key, เก็บ sessionStorage) |
| data/db.json | DB local (gitignored, สร้างเองตอนรัน) |
