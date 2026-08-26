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

- เวอร์ชัน **1.0.2**, commit ล่าสุด `ab79e84` — security hardening
- Cloudflare: SSL Full (strict), Always Use HTTPS, Bot Fight Mode, Rate Limit 100 req/min/IP (Block 10 นาที), WAF block `/admin` จากต่างประเทศ (TH only)
- Phase 0 (โดเมน+โครงสร้าง) ปิดแล้ว / **Phase 1 รอเริ่ม**: ระบบสแกนตั๋วเข้า-ออก (check-in)

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
