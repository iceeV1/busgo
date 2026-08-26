"use strict";
/* ============================================================
   BusGo Backend — Node.js ล้วน ไม่ต้อง npm install
   ฐานข้อมูล: data/db.json | API: /api/buses, /api/bookings
   ============================================================ */
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const IS_PROD = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
const ADMIN_KEY = process.env.ADMIN_KEY || "admin1234"; // local dev เท่านั้น
/* [v1.0.2] Fail-fast: production ห้ามใช้ default key เด็ดขาด — Render ตั้ง
   NODE_ENV=production ให้อัตโนมัติ ถ้าลืมตั้ง ADMIN_KEY จะ exit(1) ให้ deploy fail
   เห็นตั้งแต่หน้า log แทนที่จะเงียบๆ เปิดหลังบ้านด้วยรหัส admin1234 ที่ติด public */
if (IS_PROD && !process.env.ADMIN_KEY) {
  console.error("[FATAL] Missing ADMIN_KEY env - refusing to start on production");
  process.exit(1);
}
const APP_SEMVER = "1.0.3"; // เวอร์ชันระบบ — Phase 1.5 (cross-device ticket lookup by code+phone)
const APP_VERSION = process.env.RENDER_GIT_COMMIT || String(fs.statSync(__filename).mtimeMs);
const APP_VERSION_SHORT = APP_VERSION.slice(0, 7);
const APP_STARTED_AT = new Date().toISOString();

const TYPE_INFO = {
  vip: { seats: 32 },
  air: { seats: 44 },
  eco: { seats: 48 },
};
const PAY_METHODS = ["promptpay", "card", "wallet"];

/* ================= SECURITY =================
   - Rate limiting ต่อ IP (กัน DoS/สแปมจาก client เดียว)
   - Admin lockout (กัน brute force รหัสผ่าน)
   - Security headers (กัน clickjacking / MIME sniffing) */
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

function clientIp(req) {
  /* ป้องกันการปลอม X-Forwarded-For (ช่องโหว่เดิม: ใช้ค่าแรกของแซก ซึ่ง client ตั้งเองได้
     ทำให้ bypass rate limit + admin lockout ได้ทุกตัว)
     1) ผ่าน Cloudflare (โดเมนหลัก): CF ตั้ง cf-connecting-ip เองเสมอ ปลอมไม่ได้
     2) เข้า Render ตรง: ใช้ hop สุดท้ายของ XFF ซึ่ง proxy ที่เชื่อถือได้ append ท้ายแซก */
  const host = String(req.headers.host || "").toLowerCase();
  const viaCF = !!req.headers["cf-ray"] && (host === "busgo.dpdns.org" || host === "www.busgo.dpdns.org");
  if (viaCF && req.headers["cf-connecting-ip"]) return String(req.headers["cf-connecting-ip"]).trim();
  const xf = req.headers["x-forwarded-for"];
  if (xf) {
    const hops = String(xf).split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return req.socket.remoteAddress || "unknown";
}

const rateBuckets = new Map(); // key -> { count, resetAt }
function rateLimit(req, res, key, max, windowMs) {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || now > b.resetAt) { b = { count: 0, resetAt: now + windowMs }; rateBuckets.set(key, b); }
  b.count++;
  if (b.count > max) {
    const retry = Math.ceil((b.resetAt - now) / 1000);
    res.writeHead(429, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Retry-After": String(retry), "Cache-Control": "no-store" });
    res.end(JSON.stringify({ error: `คำขอมากเกินไป กรุณารอ ${retry} วินาทีแล้วลองใหม่` }));
    return false;
  }
  return true;
}

const adminFails = new Map(); // ip -> { count, firstAt, lockedUntil }
const ADMIN_MAX_FAILS = 5;    // ผิดได้ 5 ครั้ง
const ADMIN_FAIL_WINDOW = 5 * 60 * 1000;
const ADMIN_LOCK_MS = 15 * 60 * 1000; // แล้วล็อก 15 นาที
function adminLockInfo(ip) {
  const now = Date.now();
  const st = adminFails.get(ip);
  if (st && st.lockedUntil && now < st.lockedUntil) {
    return { locked: true, minsLeft: Math.ceil((st.lockedUntil - now) / 60000) };
  }
  return { locked: false };
}
function adminRecordFail(ip) {
  const now = Date.now();
  let st = adminFails.get(ip);
  if (!st || now - st.firstAt > ADMIN_FAIL_WINDOW) st = { count: 0, firstAt: now, lockedUntil: 0 };
  st.count++;
  if (st.count >= ADMIN_MAX_FAILS) { st.lockedUntil = now + ADMIN_LOCK_MS; st.count = 0; }
  adminFails.set(ip, st);
}
// เก็บกวาด bucket/สถานะหมดอายุ กัน RAM โต (ใช้กับการโจมตียาวๆ)
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rateBuckets) if (now > b.resetAt) rateBuckets.delete(k);
  for (const [k, s] of adminFails) if (s.lockedUntil && now > s.lockedUntil) adminFails.delete(k);
}, 60 * 1000).unref();

const DEFAULT_BUSES = [
  { id: "B01", from: "กรุงเทพฯ", to: "เชียงใหม่", depart: "08:00", arrive: "17:30", duration: "9 ชม. 30 นาที", type: "vip", price: 850 },
  { id: "B02", from: "กรุงเทพฯ", to: "เชียงใหม่", depart: "21:00", arrive: "06:30", duration: "9 ชม. 30 นาที", type: "air", price: 620 },
  { id: "B03", from: "กรุงเทพฯ", to: "ภูเก็ต", depart: "09:30", arrive: "20:00", duration: "10 ชม. 30 นาที", type: "air", price: 720 },
  { id: "B04", from: "กรุงเทพฯ", to: "ภูเก็ต", depart: "19:00", arrive: "05:30", duration: "10 ชม. 30 นาที", type: "vip", price: 950 },
  { id: "B05", from: "กรุงเทพฯ", to: "ขอนแก่น", depart: "07:00", arrive: "13:30", duration: "6 ชม. 30 นาที", type: "eco", price: 380 },
  { id: "B06", from: "กรุงเทพฯ", to: "นครราชสีมา", depart: "10:00", arrive: "14:00", duration: "4 ชม.", type: "eco", price: 260 },
  { id: "B07", from: "กรุงเทพฯ", to: "หาดใหญ่", depart: "18:30", arrive: "06:00", duration: "11 ชม. 30 นาที", type: "vip", price: 1050 },
  { id: "B08", from: "กรุงเทพฯ", to: "พัทยา", depart: "06:30", arrive: "09:00", duration: "2 ชม. 30 นาที", type: "air", price: 180 },
  { id: "B09", from: "กรุงเทพฯ", to: "พัทยา", depart: "12:00", arrive: "14:30", duration: "2 ชม. 30 นาที", type: "eco", price: 150 },
  { id: "B10", from: "กรุงเทพฯ", to: "สุราษฎร์ธานี", depart: "20:00", arrive: "07:00", duration: "11 ชม.", type: "air", price: 780 },
  { id: "B11", from: "กรุงเทพฯ", to: "อุดรธานี", depart: "08:30", arrive: "16:00", duration: "7 ชม. 30 นาที", type: "air", price: 480 },
  { id: "B12", from: "เชียงใหม่", to: "กรุงเทพฯ", depart: "09:00", arrive: "18:30", duration: "9 ชม. 30 นาที", type: "vip", price: 850 },
  { id: "B13", from: "เชียงใหม่", to: "แม่ฮ่องสอน", depart: "07:30", arrive: "12:00", duration: "4 ชม. 30 นาที", type: "eco", price: 280 },
  { id: "B14", from: "ภูเก็ต", to: "กรุงเทพฯ", depart: "16:00", arrive: "02:30", duration: "10 ชม. 30 นาที", type: "air", price: 700 },
];

/* ================= DB STORAGE =================
   โหมด 1: มี env UPSTASH_REDIS_REST_URL + TOKEN → เก็บถาวรบนคลาวด์ (ฟรี)
   โหมด 2: ไม่มี → เก็บไฟล์ data/db.json แบบเดิม (local)            */
const UP_URL = process.env.UPSTASH_REDIS_REST_URL;
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const UP_KEY = "busgo:db";
const upEnabled = () => Boolean(UP_URL && UP_TOKEN);

async function upGet(key) {
  const r = await fetch(`${UP_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UP_TOKEN}` },
  });
  const d = await r.json();
  return d.result; // string | null
}
async function upSet(key, value) {
  await fetch(`${UP_URL}/set/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UP_TOKEN}`, "Content-Type": "text/plain" },
    body: value,
  });
}

async function saveDB(db) {
  const json = JSON.stringify(db, null, 2);
  // เขียนไฟล์เสมอ (local ใช้เป็นหลัก / บน cloud ใช้เป็น backup)
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_PATH + ".tmp";
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, DB_PATH);
  } catch (e) {
    console.error("[FILE]", e.message);
  }
  if (upEnabled()) {
    try { await upSet(UP_KEY, json); } catch (e) { console.error("[UPSTASH SET]", e.message); }
  }
}
const DEFAULT_PROMOS = [{ code: "WELCOME10", percent: 10, active: true }];

/* ระบบรองรับเฉพาะรถบัส — ตัดรอบรถไฟ/เรือเฟอร์รี่เก่าออกจากฐานข้อมูลอัตโนมัติ */
function normalize(db) {
  let changed = false;
  (db.buses || []).forEach((b) => { if (!b.mode) { b.mode = "bus"; changed = true; } });
  const before = (db.buses || []).length;
  db.buses = (db.buses || []).filter((b) => (b.mode || "bus") === "bus");
  if (db.buses.length !== before) changed = true;
  if (!Array.isArray(db.promos)) { db.promos = JSON.parse(JSON.stringify(DEFAULT_PROMOS)); changed = true; }
  return changed;
}

async function loadDB() {
  // โหมดคลาวด์: ดึงจาก Upstash ก่อนเสมอ
  if (upEnabled()) {
    try {
      const raw = await upGet(UP_KEY);
      if (raw) {
        const db = JSON.parse(raw);
        if (normalize(db)) await saveDB(db);
        return db;
      }
      console.log("[UPSTASH] ยังไม่มีข้อมูล — สร้างฐานข้อมูลใหม่");
    } catch (e) {
      console.error("[UPSTASH GET]", e.message, "→ ใช้ไฟล์ local ชั่วคราว");
    }
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    if (normalize(db)) await saveDB(db);
    return db;
  } catch {
    const db = {
      buses: DEFAULT_BUSES.map((b) => ({ ...b, mode: "bus" })),
      bookings: [],
      promos: JSON.parse(JSON.stringify(DEFAULT_PROMOS)),
      seq: 1,
    };
    await saveDB(db);
    return db;
  }
}

/* ================= WRITE MUTEX (v1.0.2) =================
   Node เป็น single-threaded แต่ await เปิดช่องให้ request อื่นแทรกทำงานกลางคัน
   (event loop interleave) → read-check-write ของ 2 request ซ้อนกันได้ = double booking
   แก้ด้วย promise queue แบบ concurrency=1 (หลักการเดียวกับ p-queue)
   - release ทุกกรณี (.then(()=>{},()=>{})) ไม่ให้ task ที่ error บล็อก queue
   - error ของ task ยังส่งต่อถึงผู้เรียกปกติ */
let _dbLock = Promise.resolve();
function withDbLock(fn) {
  const run = _dbLock.then(fn, fn);
  _dbLock = run.then(() => {}, () => {});
  return run;
}

/* ================= HELPERS ================= */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function send(res, status, obj) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(obj));
}
function sendFile(res, filePath) {
  const full = path.normalize(filePath);
  /* กัน path traversal: ต้องอยู่ใน ROOT เท่านั้น (เช็คด้วย relative กันกรณี prefix ซ้ำ เช่น /app vs /app2) */
  const rel = path.relative(ROOT, full);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return send(res, 403, { error: "Forbidden" });
  /* บล็อกไฟล์ sensitive ไม่ให้ถูก serve เป็น static เด็ดขาด */
  const base = path.basename(full).toLowerCase();
  if (base === "pss.txt" || base.endsWith(".env") || base.startsWith(".") || full === DB_PATH ||
      base === "server.js" || base === "render.yaml" || base === "ai_context.md" || base.endsWith(".md"))
    return send(res, 403, { error: "Forbidden" });
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return send(res, 404, { error: "Not Found" });
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "Content-Type": MIME[path.extname(full).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  const stream = fs.createReadStream(full);
  stream.on("error", (e) => {
    console.error("[STREAM]", e.message);
    try { send(res, 500, { error: "File read error" }); } catch {}
  });
  stream.pipe(res);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 1e5) req.destroy(); }); // จำกัด body 100KB กันถล่ม RAM
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(new Error("JSON ไม่ถูกต้อง")); } });
    req.on("error", reject);
  });
}
/* เทียบรหัสแบบ timing-safe กัน timing attack */
function isAdmin(req) {
  const given = Buffer.from(String(req.headers["x-admin-key"] || ""));
  const want = Buffer.from(ADMIN_KEY);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function validateBus(b) {
  if (!b || typeof b !== "object") return "ข้อมูลไม่ถูกต้อง";
  if (!String(b.from || "").trim()) return "กรุณาระบุต้นทาง";
  if (!String(b.to || "").trim()) return "กรุณาระบุปลายทาง";
  if (!/^\d{2}:\d{2}$/.test(b.depart || "")) return "เวลาออกไม่ถูกต้อง";
  if (!/^\d{2}:\d{2}$/.test(b.arrive || "")) return "เวลาถึงไม่ถูกต้อง";
  if (!String(b.duration || "").trim()) return "กรุณาระบุระยะเวลาเดินทาง";
  if (!TYPE_INFO[b.type]) return "ประเภทรถต้องเป็น vip / air / eco";
  if (b.mode && b.mode !== "bus") return "ระบบนี้รองรับเฉพาะรถบัส";
  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 0 || price > 100000) return "ราคาไม่ถูกต้อง";
  return null;
}

/* ================= API ================= */
async function handleApi(req, res, p) {
  const db = await loadDB(); // อ่านใหม่ทุก request → ข้อมูลสดเสมอ
  const m = req.method;

  /* ---------- BUSES ---------- */
  if (p === "/api/buses" && m === "GET") return send(res, 200, db.buses);

  if (p === "/api/buses" && m === "POST") {
    if (!isAdmin(req)) return send(res, 401, { error: "ต้องการสิทธิ์ผู้ดูแล" });
    const b = await readBody(req);
    const err = validateBus(b);
    if (err) return send(res, 400, { error: err });
    if (db.buses.some((x) => x.from === b.from && x.to === b.to && x.depart === b.depart))
      return send(res, 409, { error: "มีเที่ยวรถเส้นทางและเวลานี้อยู่แล้ว" });
    const bus = {
      id: "T" + Date.now().toString(36).toUpperCase().slice(-5),
      from: String(b.from).trim(), to: String(b.to).trim(),
      depart: b.depart, arrive: b.arrive,
      duration: String(b.duration).trim(), type: b.type,
      mode: "bus",
      price: Number(b.price), seats: TYPE_INFO[b.type].seats,
    };
    db.buses.push(bus);
    await saveDB(db);
    return send(res, 201, bus);
  }

  let mt;
  if ((mt = p.match(/^\/api\/buses\/([^/]+)$/))) {
    const id = decodeURIComponent(mt[1]);
    const idx = db.buses.findIndex((x) => x.id === id);
    if (idx === -1) return send(res, 404, { error: "ไม่พบเที่ยวรถนี้" });

    if (m === "GET") return send(res, 200, db.buses[idx]);

    if (m === "PUT") {
      if (!isAdmin(req)) return send(res, 401, { error: "ต้องการสิทธิ์ผู้ดูแล" });
      const b = await readBody(req);
      const err = validateBus(b);
      if (err) return send(res, 400, { error: err });
      Object.assign(db.buses[idx], {
        from: String(b.from).trim(), to: String(b.to).trim(),
        depart: b.depart, arrive: b.arrive,
        duration: String(b.duration).trim(), type: b.type,
        price: Number(b.price), seats: TYPE_INFO[b.type].seats,
      });
      await saveDB(db);
      return send(res, 200, db.buses[idx]);
    }

    if (m === "DELETE") {
      if (!isAdmin(req)) return send(res, 401, { error: "ต้องการสิทธิ์ผู้ดูแล" });
      const removed = db.buses.splice(idx, 1)[0];
      await saveDB(db);
      return send(res, 200, { deleted: removed });
    }
  }

  /* ---------- BOOKINGS ---------- */
  if (p === "/api/bookings" && m === "GET") {
    const list = [...db.bookings].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    /* [FIXED] เดิมเปิด PII ทั้งหมดให้คนทั่วไป (ชื่อ/เบอร์โทร/หมายเหตุ) — ตอนนี้ non-admin
       เห็นเฉพาะส่วนจำเป็นต่อผังที่นั่งและสถานะตั๋ว ข้อมูลส่วนตัวเห็นได้ปุ่มยั้ง admin */
    if (!isAdmin(req)) {
      return send(res, 200, list.map((b) => ({
        code: b.code,
        busId: b.busId,
        date: b.date,
        seats: b.seats,
        status: b.status,
        total: b.total,
        createdAt: b.createdAt,
      })));
    }
    return send(res, 200, list);
  }

  /* [v1.0.3] ค้นตั๋วข้ามเครื่อง (ไม่ต้อง login / ไม่ต้อง localStorage)
     — ใช้เมื่อผู้จองเปิดจากเครื่องอื่น หรือเคลียร์ browser cache
     — ต้องรู้ทั้ง code + เบอร์โทร (เบอร์เป็น shared secret เพิ่มเติม)
     — คืนเฉพาะ public view (ไม่มี PII เพิ่ม) และเฉพาะรายการที่ยัง active หรือ cancelled (ไม่คืนเก่าเกิน 90 วัน) */
  if (p === "/api/bookings/search" && m === "GET") {
    const u = new URL(req.url, "http://x");
    const code = String(u.searchParams.get("code") || "").trim().toUpperCase();
    const phone = String(u.searchParams.get("phone") || "").replace(/[-\s]/g, "");
    if (!/^BG-[0-9A-F]{6,12}$/.test(code)) return send(res, 400, { error: "รูปแบบรหัสตั๋วไม่ถูกต้อง" });
    if (!/^0\d{8,9}$/.test(phone)) return send(res, 400, { error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" });
    const hit = db.bookings.find((b) => b.code === code && b.phone === phone);
    if (!hit) return send(res, 404, { error: "ไม่พบรายการจองที่ตรงกัน" });
    return send(res, 200, {
      code: hit.code,
      busId: hit.busId,
      date: hit.date,
      seats: hit.seats,
      status: hit.status,
      total: hit.total,
      createdAt: hit.createdAt,
    });
  }

  if (p === "/api/bookings" && m === "POST") {
    const body = await readBody(req);
    const bus = db.buses.find((x) => x.id === body.busId);
    if (!bus) return send(res, 400, { error: "ไม่พบเที่ยวรถที่เลือก" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")) return send(res, 400, { error: "รูปแบบวันที่ไม่ถูกต้อง" });

    const seats = Array.isArray(body.seats) ? [...new Set(body.seats.map(Number))] : [];
    const totalSeats = bus.seats || TYPE_INFO[bus.type].seats;
    if (!seats.length) return send(res, 400, { error: "กรุณาเลือกที่นั่งอย่างน้อย 1 ที่" });
    if (seats.some((s) => !Number.isInteger(s) || s < 1 || s > totalSeats))
      return send(res, 400, { error: `หมายเลขที่นั่งต้องอยู่ระหว่าง 1-${totalSeats}` });

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").replace(/[-\s]/g, "");
    if (name.length < 3) return send(res, 400, { error: "กรุณากรอกชื่อ–นามสกุล" });
    if (!/^0\d{8,9}$/.test(phone)) return send(res, 400, { error: "เบอร์โทรศัพท์ไม่ถูกต้อง" });

    // ตรวจที่นั่งซ้ำกับการจองที่ยัง active
    const taken = new Set(
      db.bookings.filter((k) => k.busId === bus.id && k.date === body.date && k.status === "active")
        .flatMap((k) => k.seats)
    );
    const conflict = seats.find((s) => taken.has(s));
    if (conflict) return send(res, 409, { error: `ที่นั่ง ${conflict} ถูกจองไปแล้ว กรุณาเลือกที่นั่งใหม่` });

    // โปรโมชั่น (ส่วนลด)
    let promo = null;
    if (body.promoCode) {
      promo = (db.promos || []).find((p) => p.active && p.code === String(body.promoCode).trim().toUpperCase());
      if (!promo) return send(res, 400, { error: "ไม่พบโค้ดโปรโมชั่นนี้ หรือโค้ดหมดอายุ" });
    }
    // ช่องทางชำระเงิน
    const payMethod = PAY_METHODS.includes(body.payMethod) ? body.payMethod : null;

    const gross = seats.length * bus.price;
    const discount = promo ? Math.round((gross * promo.percent) / 100) : 0;

    const booking = {
      code: "BG-" + crypto.randomBytes(3).toString("hex").toUpperCase(), // สุ่มแบบ unguessable กันเดารหัสตั๋ว
      busId: bus.id,
      date: body.date,
      seats,
      name, phone,
      note: String(body.note || "").slice(0, 200),
      promoCode: promo ? promo.code : null,
      discount,
      total: gross - discount,
      payMethod,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    db.bookings.push(booking);
    await saveDB(db);
    return send(res, 201, { booking });
  }

  let mb;
  if ((mb = p.match(/^\/api\/bookings\/([^/]+)(\/cancel)?$/))) {
    const code = decodeURIComponent(mb[1]);
    const bk = db.bookings.find((x) => x.code === code);
    if (!bk) return send(res, 404, { error: "ไม่พบรายการจองนี้" });

    if (mb[2] && m === "PATCH") {
      if (bk.status !== "active") return send(res, 409, { error: "รายการนี้ถูกยกเลิกไปแล้ว" });
      /* [FIXED] เดิมใครรู้รหัสตั๋วก็ยกเลิกได้ — ตอนนี้ admin ผ่านได้เลย
         ส่วนผู้จองตัวจริงต้องส่งเบอร์โทรมายืนยันให้ตรงกับรายการ */
      if (!isAdmin(req)) {
        let body = {};
        try { body = await readBody(req); } catch {}
        const givenPhone = String(body.phone || "").replace(/[-\s]/g, "");
        if (givenPhone !== bk.phone) return send(res, 403, { error: "เบอร์โทรศัพท์ไม่ตรงกับผู้จอง" });
      }
      bk.status = "cancelled";
      bk.cancelledAt = new Date().toISOString();
      await saveDB(db);
      return send(res, 200, { booking: bk });
    }
    if (!mb[2] && m === "DELETE") {
      if (!isAdmin(req)) return send(res, 401, { error: "ต้องการสิทธิ์ผู้ดูแล" });
      db.bookings = db.bookings.filter((x) => x.code !== code);
      await saveDB(db);
      return send(res, 200, { deleted: code });
    }
  }

  /* ---------- PROMOTIONS ---------- */
  if (p === "/api/promos" && m === "GET") {
    const all = db.promos || [];
    if (isAdmin(req)) return send(res, 200, all);
    return send(res, 200, all.filter((x) => x.active).map(({ code, percent }) => ({ code, percent })));
  }

  if (p === "/api/promos" && m === "POST") {
    if (!isAdmin(req)) return send(res, 401, { error: "ต้องการสิทธิ์ผู้ดูแล" });
    const body = await readBody(req);
    const code = String(body.code || "").trim().toUpperCase();
    const percent = Math.round(Number(body.percent));
    if (!/^[A-Z0-9]{3,20}$/.test(code)) return send(res, 400, { error: "โค้ดต้องเป็น A-Z หรือตัวเลข 3-20 ตัว" });
    if (!Number.isFinite(percent) || percent < 1 || percent > 90) return send(res, 400, { error: "ส่วนลดต้องอยู่ระหว่าง 1-90 %" });
    if ((db.promos || []).some((x) => x.code === code)) return send(res, 409, { error: "มีโค้ดนี้อยู่แล้ว" });
    const promo = { code, percent, active: true };
    db.promos.push(promo);
    await saveDB(db);
    return send(res, 201, promo);
  }

  let mp;
  if ((mp = p.match(/^\/api\/promos\/([^/]+)(\/toggle)?$/))) {
    const code = decodeURIComponent(mp[1]);
    const pr = (db.promos || []).find((x) => x.code === code);
    if (!pr) return send(res, 404, { error: "ไม่พบโค้ดนี้" });

    if (mp[2] && m === "PATCH") {
      if (!isAdmin(req)) return send(res, 401, { error: "ต้องการสิทธิ์ผู้ดูแล" });
      pr.active = !pr.active;
      await saveDB(db);
      return send(res, 200, pr);
    }
    if (!mp[2] && m === "DELETE") {
      if (!isAdmin(req)) return send(res, 401, { error: "ต้องการสิทธิ์ผู้ดูแล" });
      db.promos = db.promos.filter((x) => x.code !== code);
      await saveDB(db);
      return send(res, 200, { deleted: code });
    }
  }

  /* ---------- VERSION (update notifier) ---------- */
  if (p === "/api/version" && m === "GET") {
    return send(res, 200, {
      version: APP_VERSION,
      semver: APP_SEMVER,
      short: APP_VERSION_SHORT,
      started: APP_STARTED_AT,
      source: process.env.RENDER_GIT_COMMIT ? "render" : "local",
    });
  }

  /* ---------- ADMIN AUTH CHECK (มี lockout กัน brute force) ---------- */
  if (p === "/api/admin/check" && m === "GET") {
    const ip = clientIp(req);
    const lock = adminLockInfo(ip);
    if (lock.locked) return send(res, 429, { error: `ล็อกอินผิดพลาดหลายครั้ง — ลองใหม่ในอีก ${lock.minsLeft} นาที` });
    const ok = isAdmin(req);
    if (ok) { adminFails.delete(ip); return send(res, 200, { ok: true }); }
    adminRecordFail(ip);
    const left = ADMIN_MAX_FAILS - (adminFails.get(ip)?.count || 0);
    return send(res, 401, { ok: false, error: "รหัสผ่านไม่ถูกต้อง", remaining: Math.max(left, 0) });
  }

  return send(res, 404, { error: "API ไม่พบ: " + p });
}

/* ================= SERVER ================= */
const server = http.createServer(async (req, res) => {
  let p = new URL(req.url, "http://x").pathname;
  try {
    /* ---- ป้องกันขั้นพื้นฐาน: URL ยาวผิดปกติ + Rate limit ต่อ IP ---- */
    if (req.url.length > 2048) return send(res, 414, { error: "URI Too Long" });
    const ip = clientIp(req);
    const m = req.method;
    if (p.startsWith("/api/")) {
      // API ทั่วไป: 120 ครั้ง/นาที (หน้าเว็บ poll version ทุก 60 วิ ใช้สบาย)
      if (!rateLimit(req, res, "api:" + ip, 120, 60 * 1000)) return;
      // สร้างการจอง: 5 ครั้ง/10 นาที ต่อ IP (กันสแปมจองเป็นจำนวนมาก)
      if (p === "/api/bookings" && m === "POST" && !rateLimit(req, res, "book:" + ip, 5, 10 * 60 * 1000)) return;
      // เช็ครหัส admin: 10 ครั้ง/5 นาที (กัน brute force)
      if (p === "/api/admin/check" && !rateLimit(req, res, "auth:" + ip, 10, 5 * 60 * 1000)) return;
      /* [v1.0.2] ยกเลิกการจอง: 5 ครั้ง/15 นาที ต่อ IP — โค้ดตั๋วโชว์สาธารณะบนผังที่นั่ง
         คนร้ายจึงลองเดาเบอร์โทรเพื่อ PATCH /cancel ได้ ต้องมี limit เฉพาะ (admin ยกเว้น) */
      if (m === "PATCH" && /^\/api\/bookings\/[^/]+\/cancel$/.test(p) && !isAdmin(req)
        && !rateLimit(req, res, "cancel:" + ip, 5, 15 * 60 * 1000)) return;
      // เขียนข้อมูล buses/promos (admin): 30 ครั้ง/นาที
      if ((p.startsWith("/api/buses") || p.startsWith("/api/promos")) && m !== "GET" && !rateLimit(req, res, "awrite:" + ip, 30, 60 * 1000)) return;
    }
    if (p.startsWith("/api/") && m !== "GET") {
      /* [v1.0.2] การเขียนข้อมูลทุกชนิด serialize ผ่าน mutex กัน race condition
         (loadDB → check → saveDB ของ 2 request ซ้อน timeline กันได้) */
      return await withDbLock(() => handleApi(req, res, p));
    }
    if (p.startsWith("/api/")) return await handleApi(req, res, p);
    if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "") || "/"; // รองรับ /admin/
    let file = p === "/" ? "/index.html" : p === "/admin" ? "/admin.html" : p;
    return sendFile(res, path.join(ROOT, file));
  } catch (e) {
    console.error("[ERROR]", e.message);
    try { send(res, 500, { error: "Internal Server Error" }); } catch {}
  }
});

// ตัดการเชื่อมต่อค้างเปิดช้าๆ (กัน Slowloris)
server.headersTimeout = 15000;
server.requestTimeout = 60000;

// กัน process ล่มบน cloud (สำคัญมากสำหรับ free tier)
process.on("uncaughtException", (e) => console.error("[UNCAUGHT]", e.message));
process.on("unhandledRejection", (e) => console.error("[REJECTION]", e && e.message ? e.message : e));

server.listen(PORT, () => {
  console.log("=========================================");
  console.log("  BusGo Server กำลังทำงาน");
  console.log(`  หน้าเว็บหลัก : http://localhost:${PORT}`);
  console.log(`  หลังบ้าน     : http://localhost:${PORT}/admin`);
  console.log(`  Admin Key    : ${ADMIN_KEY.slice(0, 3)}****** (ซ่อนบางส่วน)`);
  console.log(`  ฐานข้อมูล    : ${DB_PATH}`);
  console.log("=========================================");
});



