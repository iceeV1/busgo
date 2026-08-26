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
## งานที่ทำแล้ว (v1.1.2 — code review patch)

16. **Fix `cancelBooking()` ใน script.js**: เดิมถ้าเซิร์ฟเวอร์ตอบ error อื่นที่ไม่ใช่ 403 (เช่น 429 rate limit / 500) โค้ดจะหลุดไป set สถานะ `cancelled` ในเครื่องต่อ ทั้งที่เซิร์ฟเวอร์ไม่ได้ยอมรับ → ตอนนี้ response ไม่ ok ใดๆ จะหยุดทันที + โชว์สาเหตุจริงจากเซิร์ฟเวอร์
17. **Fix `genCode()` offline ใน script.js**: เดิมสร้างรหัส `BG-XXXX-123` ซึ่งไม่ผ่าน regex server `^BG-[0-9A-F]{6,12}$` → ตั๋ว offline ใช้ API cancel/search ไม่ได้ → ตอนนี้สุ่ม hex 4 ไบต์ (crypto.getRandomValues) ให้อยู่ฟอร์แมตเดียวกับเซิร์ฟเวอร์
18. แก้ typo ข้อความแต้มสะสม ("ทุกทุก" -> "ทุก") — bump APP_SEMVER เป็น **1.1.2**

## งานที่ทำแล้ว (v1.1.3 — แก้ design limitation ครบทั้ง 4 ข้อ)

19. **ตัด "ที่นั่งถูกจองปลอม" ออก** (`getOccupied` ใน script.js คืน Set ว่าง, ลบ hashStr/seededRand) — ผังที่นั่ง/% ว่างตอนนี้สะท้อนเฉพาะการจองจริงจาก server
20. **Flow offline โปร่งใส** (`payNowBtn`): เพิ่ม `serverConfirmed` flag — จองสำเร็จบน server = "ชำระเงินสำเร็จ", offline/ฟอล์ = "บันทึกในเครื่องชั่วคราวเท่านั้น เซิร์ฟเวอร์ยังไม่รับการจอง" (ไม่ปลอมข้อความสำเร็จอีก)
21. **PromptPay TLV 62 ref** = รหัสเที่ยวรถ + YYMMDD วันเดินทาง (เช่น B01260826) ช่วย reconcile เงินเข้าที่รายการ; sanitize A-Z a-z 0-9 max 25 ตัว fallback "BUSGO"
22. **Admin time picker**: นาทีเลือกได้ทุกนาที 0-59 (เดิม step 5 ทำให้เวลา 08:03 ถูกปัด 08:00 ตอน save), `setTimeValue` รับนาทีใดๆ ได้ — bump APP_SEMVER เป็น **1.1.3**

## สิ่งที่ review แล้วพบว่าโอเค (ไม่แก้): security server แน่น (timingSafeEqual, fail-fast, traversal whitelist, rate limit ครบ, write mutex), XSS ปิดหมดด้วย esc(), server recalc ยอดเงินเอง

## งานที่ทำแล้ว (v1.2.0 — ระบบสมาชิก login/logout + admin session)

23. **ระบบสมาชิกผู้โดยสาร**: `POST /api/auth/register|login|logout`, `GET /api/auth/me` — password เก็บ scrypt+salt per-user, session token randomBytes(32) เก็บใน `db.sessions` (TTL member 7 วัน), rate limit auth: 10/5นาที/IP, anti-enumeration (401 message เดียวกัน)
24. **จองแบบล็อกอิน**: POST /api/bookings ผูก `booking.userId` อัตโนมัติ; `GET /api/bookings?mine=1` (ต้องมี x-session) คืนตั๋วตัวเองพร้อม PII เต็ม
25. **Frontend หน้าหลัก**: navbar ปุ่ม "เข้าสู่ระบบ/สมัครสมาชิก" → modal login/register (#authModal); prefill ชื่อ-เบอร์จากโปรไฟล์ตอนจอง; syncMineTickets() ดึงตั๋วจากบัญชี (`mine=1`) มาแสดงใน "ตั๋วของฉัน"; token เก็บ localStorage `busgo_member_token`
26. **Admin auth ยกระดับ**: `POST /api/admin/login {key, remember}` → session token 8 ชม. / 30 วัน (remember) — admin.js ส่ง `x-session` แทน key ตรง; isAdmin ยอมรับทั้ง session token และ x-admin-key เดิม (backward compat กับ curl); admin.html เพิ่ม checkbox "จดจำฉันไว้ในเครื่องนี้"
27. **บั๊กที่จับได้ระหว่างทำ**: /api/admin/login เคยเทียบรหัสจาก header (ซึ่ง client ส่งใน body.key) → เทียบ body.key timing-safe ถูกต้อง
28. **Smoke test local ผ่าน 12/12** (register/dup/login/wrong-pass/me/mine/admin-login/logout) — bump APP_SEMVER เป็น **1.2.0**

## งานที่ทำแล้ว (v1.2.1 — login ด้วยชื่อบัญชีแทนอีเมล)

28a. register/login ใช้ `name` เป็นตัวระบุบัญชี (เก็บ `nameLower` unique + backfill ให้ user เก่าใน normalize); ตัดช่องอีเมลออกจากฟอร์ม; publicSelf ไม่ส่ง email — bump **1.2.1**

## งานที่ทำแล้ว (v1.2.2 — Firebase Realtime Database)

29. **โหมดเก็บข้อมูลบน Firebase RTDB** (env `FIREBASE_DB_URL` + `FIREBASE_DB_SECRET`): ลำดับอ่าน Firebase → Upstash → local; ครั้งแรกที่ Firebase ว่างจะดึงข้อมูลจากแหล่งสำรองแล้ว sync ขึ้นไปอัตโนมัติ; saveDB เขียนทั้ง Firebase + Upstash + local file พร้อมกัน
30. `ensureArrays()` กัน RTDB ตัด empty array ทิ้ง + แปลง object-index กลับเป็น array ใช้ได้เสมอ
31. จุดประสงค์: อาจารย์เปิด Firebase Console แล้วเห็นข้อมูลทั้งหมดแบบสด (users/bookings/buses/promos) ตามโจทย์ส่งงาน — **secret เก็บเฉพาะ env บน Render ห้ามขึ้น repo**; smoke test ผ่าน (register/booking ขึ้น Firebase จริง, empty-array purge ไม่พัง) — bump **1.2.2**

## Design limitation ที่เหลือ

- เหลือ item 15: Lua script Upstash + rate-limit state ลง Redis; การถอด secret Firebase จากแชทเก่าไป regenerate ใน Firebase console ถ้าต้องการความปลอดภัยสูงสุด

## งานที่ทำแล้ว (v1.3.x — ธีม + ตกแต่ง + แก้บั๊กจอขาว)

32. **ระบบธีม Light/Dark** (v1.3.0): แปลงสี hardcoded เป็น CSS variable system ทั้งหน้าหลัก+admin, ปุ่มสลับ ☀️/🌙, จำค่า localStorage, theme-boot.js กัน FOUC, `?theme=light|dark` ทาง URL, favicon.svg ใหม่ + รถบัส SVG ใน hero
33. **บั๊กใหญ่ที่จับได้**: สคริปต์แปลงสีทำ `style.css` ขาดวงเล็บปิด 1 ตัวที่ `.remember-row` → CSS หลังบรรทัดนั้นถูกกลืนทั้งหมด → ธีม/เลย์เอาต์ไม่ทำงาน, จอขาวตัวหนังสือขาว (v1.3.4 แก้ + เขียน checker วงเล็บ) — บทเรียน: แก้ CSS ด้วยสคริปต์ต้องตรวจสมดุลวงเล็บ + เรนเดอร์ภาพจริงเสมอ
34. **Cache-bust ด้วย query string** `?v=<semver>` ทุก static file (style/script/admin.js ใน index.html + admin.html) — เปลี่ยนเวอร์ชันทุกครั้งที่แก้ไฟล์เหล่านี้ กัน CDN/เบราว์เซอร์ cache เก่า
35. เลย์เอาต์ v1.3.1–v1.3.2: header 3 ส่วน, hero รถเล็ก 128px, การ์ดสูงเท่ากัน, ปุ่มค้นหาแถวเดียวกับช่องกรอก

## งานที่ทำแล้ว (v1.4.0 — Mobile-first UI)

36. **แถบเมนูล่างแบบแอป** `.tabbar` (≤760px): 3 ปุ่ม data-tab (ตารางเดินรถ/ตั๋วของฉัน+badge/ค้นตั๋ว) ใช้ระบบ `data-tab` เดิม, badge sync ผ่าน `.js-tab-badge`, ปุ่มค้นตั๋ว scroll ไปฟอร์ม lookup + focus
37. โมดัลเป็น bottom-sheet (keyframes `slideUp` เพิ่มใหม่), ช่องกรอก 16px กัน iOS zoom, ฟอร์มค้นหา 2 คอลัมน์ ⇄ หมุนกลาง, header มือถือแถวเดียว, toast เหนือแถบล่าง, /admin แท็บเลื่อนแนวนอน + ช่องสแกนเต็มกว้าง
38. Defensive: `overflow-x: clip` + `min-width: 0` บน grid children, `.login-card` max-width `min(380px, 100vw-28px)`
39. CSP `frame-ancestors 'self'` (เดิม 'none') เพื่อทดสอบด้วย iframe 390px — เครื่องมือ: headless Chrome Windows บังคับความกว้างขั้นต่ำ **500px** แม้ `--window-size=390` → ต้องทดสอบมือถือด้วย iframe จำลอง
40. Deploy ยืนยัน: build `121646a`, production serve `.tabbar` + `?v=1.4.0` แล้ว — **เหลือ user เปิดบนมือถือจริงเช็คความรู้สึกใช้งานเอง**



## กติกาโปรเจกต์ (ห้ามลืม)

- **ห้ามใช้อีโมจิ (emoji) ทุกกรณี** ในโค้ด/UI/เอกสาร
- Deploy flow: แก้ -> `node --check server.js script.js admin.js` -> git commit/push -> เช็ค hash ที่ `/api/version` (~50 วินาที)
- Bump `APP_SEMVER` ใน server.js เมื่ออัปเดตใหญ่ (popup อัปเดตจะเด้งหา user): patch x.y.Z แก้เล็ก / minor x.Y.z ฟีเจอร์ใหม่
- อย่ายิงทดสอบรัวจนโดน rate limit ตัวเอง (Cloudflare 100/min, app-level 120/min, admin check 10 ครั้ง/5 นาที lockout)
- ทดสอบ POST/curl บน PowerShell: เขียน JSON body ลงไฟล์ด้วย UTF8 ไม่มี BOM (`[IO.File]::WriteAllText`) ไม่งั้น JSON.parse พัง

## ค้างอยู่ / Next

1. ~~Acceptance test~~ **เสร็จแล้ว 2026-08-26**: deploy v1.1.3 (build 561d955) ยืนยันที่ /api/version + ทดสอบ production ผ่าน 6/6 (จอง B01 → public view ซ่อน PII → cancel เบอร์ผิด 403 → cancel เบอร์ถูก → search ข้ามเครื่อง) — เหลือ user ลองสแกนเช็คอินใน /admin ด้วยตัวเอง (ไม่มี ADMIN_KEY ฝั่ง dev)
2. Domain ต่ออายุฟรีที่ DigitalPlat ก่อน **2027-08-26**
3. แนะนำ user: ลบไฟล์ pss.txt ในเครื่องทิ้ง + เปลี่ยนรหัสที่ใช้ร่วมกันที่อื่น
4. Tooling: เครื่องนี้ไม่มี git ใน PATH — ใช้ MinGit portable ที่ `%LOCALAPPDATA%\MinGit\cmd\git.exe` ( credential GitHub ผูกกับ Windows Credential Manager ใช้ push ได้แล้ว)

## โครงสร้างไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|------|---------|
| server.js | backend ทั้งหมด: static + API + security (rate limit, lockout, CSP) |
| script.js | frontend หน้าหลัก (จอง/ตั๋วของฉัน/localStorage mirror) |
| admin.js | หลังบ้าน (login ด้วย x-admin-key, เก็บ sessionStorage) |
| data/db.json | DB local (gitignored, สร้างเองตอนรัน) |
