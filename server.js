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
const APP_SEMVER = "2.0.2"; // เวอร์ชันระบบ — Patch: 24/7 Live 2D GPS Radar Telemetry Map
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
    "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; connect-src 'self' https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
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
  if (!IS_PROD) return { locked: false };
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
  /* [v1.4.3 FIX] เดิมลบเฉพาะรายการที่ถูกล็อก — รายการนับ fail ค้าง (ไม่มี lockedUntil)
     อยู่ถาวรทำให้ Map โตตามจำนวน IP ตอนนี้ลบทุกที่ที่หมดหน้าต่าง 5 นาทีแล้ว */
  for (const [k, s] of adminFails) {
    if ((s.lockedUntil && now > s.lockedUntil) || (!s.lockedUntil && now - s.firstAt > ADMIN_FAIL_WINDOW))
      adminFails.delete(k);
  }
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
  if (fbEnabled()) {
    try { await fbPut(json); } catch (e) { console.error("[FIREBASE PUT]", e.message); }
  }
  if (upEnabled()) {
    try { await upSet(UP_KEY, json); } catch (e) { console.error("[UPSTASH SET]", e.message); }
  }
}

/* ================= FIREBASE REALTIME DATABASE (v1.2.2) =================
   โหมด 0: มี env FIREBASE_DB_URL + FIREBASE_DB_SECRET → เก็บบน Firebase
   (อาจารย์/เจ้าของเปิด Firebase Console แล้วเห็นข้อมูลทั้งหมดแบบสด)
   ใช้ REST API ผ่าน fetch ล้วน — ไม่ต้องลง npm */
const FB_URL = (process.env.FIREBASE_DB_URL || "").trim().replace(/\/+$/, "");
const FB_SECRET = process.env.FIREBASE_DB_SECRET || "";
const fbEnabled = () => Boolean(FB_URL && FB_SECRET);

async function fbGet() {
  const r = await fetch(`${FB_URL}/.json?auth=${FB_SECRET}`);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const t = await r.text();
  return t === "null" ? null : t;
}
async function fbPut(json) {
  const r = await fetch(`${FB_URL}/.json?auth=${FB_SECRET}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: json,
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
}
/* RTDB ลบ key ที่เป็นค่าว่างทิ้ง (empty array จะหาย) และอาจคืน array เป็น object
   เมื่อ index ไม่ต่อเนื่อง — ฟังก์ชันนี้ปรับให้กลับเป็น array ใช้งานได้เสมอ (in-memory) */
function ensureArrays(db) {
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === "object" ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : []);
  db.buses = toArr(db.buses);
  db.bookings = toArr(db.bookings);
  db.users = toArr(db.users);
  db.sessions = toArr(db.sessions);
  db.promos = toArr(db.promos);
  /* [v1.4.1] purge session หมดอายุบน Firebase path ด้วย — เดิมมีแต่ใน normalize()
     (Upstash/local) ทำให้ sessions สะสมไม่มีวันลดเมื่อใช้ Firebase */
  const now = Date.now();
  db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  if (!db.promos.length) db.promos = JSON.parse(JSON.stringify(DEFAULT_PROMOS));
  db.buses.forEach((b) => { if (!b.mode) b.mode = "bus"; });
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
  /* [v1.2.0] users/sessions สำหรับระบบสมาชิก — ตัด session ที่หมดอายุออกกัน DB บวม */
  if (!Array.isArray(db.users)) { db.users = []; changed = true; }
  if (!Array.isArray(db.sessions)) { db.sessions = []; changed = true; }
  /* [v1.2.1] backfill nameLower ให้ user เก่าที่สมัครก่อนมีระบบชื่อบัญชี */
  (db.users || []).forEach((u) => { if (u.name && !u.nameLower) { u.nameLower = String(u.name).toLowerCase(); changed = true; } });
  const now = Date.now();
  const alive = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  if (alive.length !== db.sessions.length) { db.sessions = alive; changed = true; }
  return changed;
}

async function loadDB() {
  /* [v1.2.2] ลำดับการอ่าน: Firebase (ถ้าตั้งค่า) → Upstash → ไฟล์ local
     ครั้งแรกที่ Firebase ว่าง จะดึงข้อมูลเดิมจากแหล่งสำรองแล้ว sync ขึ้น Firebase ให้อัตโนมัติ */
  let fbEmpty = false; // [v1.4.1] true เมื่อ Firebase ว่างจริง (GET สำเร็จแต่ไม่มีข้อมูล) — ใช้กำกับว่าจะ sync ขึ้นได้เท่านั้น
  if (fbEnabled()) {
    try {
      const raw = await fbGet();
      if (raw) {
        const db = JSON.parse(raw);
        ensureArrays(db);
        return db;
      }
      fbEmpty = true; // Firebase ว่างจริง (ไม่ใช่กรณี GET error)
      console.log("[FIREBASE] ยังไม่มีข้อมูล — ดึงจากแหล่งสำรองแล้วจะ sync ขึ้น Firebase");
    } catch (e) {
      console.error("[FIREBASE GET]", e.message, "→ ใช้แหล่งสำรองชั่วคราว");
      /* [v1.4.1 FIX] กรณี GET error จะไม่ fbPut ทับข้อมูล Firebase ด้านล่างอย่างเด็ดขาด
         กันกรณี GET พลาดชั่วคราวแต่ PUT สำเร็จ → ข้อมูลเก่าจากแหล่งสำรองทับข้อมูลใหม่ */
    }
  }
  let db = null;
  // โหมดคลาวด์: ดึงจาก Upstash
  if (upEnabled()) {
    try {
      const raw = await upGet(UP_KEY);
      if (raw) {
        db = JSON.parse(raw);
        if (normalize(db)) await saveDB(db);
      } else {
        console.log("[UPSTASH] ยังไม่มีข้อมูล — สร้างฐานข้อมูลใหม่");
      }
    } catch (e) {
      console.error("[UPSTASH GET]", e.message, "→ ใช้ไฟล์ local ชั่วคราว");
    }
  }
  // โหมดไฟล์ local
  if (!db) {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      if (normalize(db)) await saveDB(db);
    } catch {
      db = {
        buses: DEFAULT_BUSES.map((b) => ({ ...b, mode: "bus" })),
        bookings: [],
        promos: JSON.parse(JSON.stringify(DEFAULT_PROMOS)),
        users: [],
        sessions: [],
        seq: 1,
      };
      await saveDB(db);
    }
  }
  // sync ข้อมูลชุดแรกขึ้น Firebase (ครั้งเดียวตอน Firebase ยังว่าง — เช็ค fbEmpty กันทับข้อมูล)
  if (fbEnabled() && db && fbEmpty) {
    try {
      await fbPut(JSON.stringify(db));
      console.log("[FIREBASE] sync ข้อมูลเริ่มต้นสำเร็จ");
    } catch (e) {
      console.error("[FIREBASE PUT]", e.message);
    }
  }
  return db;
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
  /* กัน path traversal: ต้องอยู่ใน ROOT เท่านั้น */
  const rel = path.relative(ROOT, full);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel) || rel.includes("\0"))
    return send(res, 403, { error: "Forbidden" });

  /* ตรวจสอบทุก segment ใน path — ห้ามเข้าโฟลเดอร์ซ่อน (.git, data, scratch ฯลฯ) */
  const segments = rel.split(/[/\\]/);
  if (segments.some((s) => s.startsWith(".") || s.toLowerCase() === "data" || s.toLowerCase() === "scratch"))
    return send(res, 403, { error: "Forbidden" });

  /* Whitelist นามสกุลไฟล์ที่อนุญาตให้เปิดเผยทางเว็บ */
  const ext = path.extname(full).toLowerCase();
  const ALLOWED_EXTS = new Set([".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".jpeg", ".ico", ".webp"]);
  if (!ALLOWED_EXTS.has(ext)) return send(res, 403, { error: "Forbidden" });

  /* บล็อกไฟล์สำคัญ โค้ด backend และสคริปต์รันระบบ */
  const base = path.basename(full).toLowerCase();
  if (base === "server.js" || base === "render.yaml" || base === "start.bat" || base === "pss.txt" ||
      base.endsWith(".env") || base.endsWith(".md") || base.endsWith(".bat") || base.endsWith(".ps1") ||
      base.endsWith(".sh") || full === DB_PATH)
    return send(res, 403, { error: "Forbidden" });

  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return send(res, 404, { error: "Not Found" });
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "Content-Type": MIME[ext] || "application/octet-stream",
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
    let tooLarge = false;
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1e5) {
        tooLarge = true;
        req.destroy(new Error("Payload Too Large"));
      }
    });
    req.on("end", () => {
      if (tooLarge) return reject(new Error("ขนาดข้อมูลเกินกำหนด (สูงสุด 100KB)"));
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("JSON ไม่ถูกต้อง"));
      }
    });
    req.on("error", (err) => {
      if (tooLarge) return reject(new Error("ขนาดข้อมูลเกินกำหนด (สูงสุด 100KB)"));
      reject(err);
    });
  });
}
/* เทียบรหัสแบบ timing-safe กัน timing attack */
function isAdminKey(req) {
  const given = Buffer.from(String(req.headers["x-admin-key"] || ""));
  const want = Buffer.from(ADMIN_KEY);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}
function isAdmin(req) {
  /* [v1.2.0] ยอมรับ 2 ช่องทาง:
     1) x-session — admin session token (จาก POST /api/admin/login) มีอายุ
     2) x-admin-key — คีย์ตรง (สำหรับ curl/automation เดิม) */
  const db = req._db;
  const tok = String(req.headers["x-session"] || "");
  if (tok && db && Array.isArray(db.sessions)) {
    const now = Date.now();
    const s = db.sessions.find((x) => x.token === tok && x.kind === "admin"
      && new Date(x.expiresAt).getTime() > now);
    if (s) return true;
  }
  return isAdminKey(req);
}

/* ================= AUTH: MEMBERS + SESSIONS (v1.2.0) =================
   - รหัสผ่านเก็บแบบ scrypt + salt สุ่มต่อ user (ไม่เก็บ plaintext)
   - session token สุ่ม crypto 32 ไบต์ เก็บใน db.sessions (รอด redeploy เมื่อใช้ Upstash)
   - TTL: member 7 วัน / admin 8 ชม. / admin remember-me 30 วัน */
const MEMBER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const ADMIN_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString("hex");
}
function verifyPassword(password, user) {
  const test = Buffer.from(hashPassword(password, user.salt));
  const stored = Buffer.from(String(user.passHash || ""));
  return test.length === stored.length && crypto.timingSafeEqual(test, stored);
}
function publicSelf(user) {
  return { id: user.id, name: user.name, phone: user.phone };
}
function createSession(db, kind, userId, ttlMs) {
  const s = {
    token: crypto.randomBytes(32).toString("hex"),
    kind,
    userId: userId || null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };
  db.sessions.push(s);
  return s;
}
function getSessionUser(req) {
  const db = req._db;
  const tok = String(req.headers["x-session"] || "");
  if (!db || !tok || !Array.isArray(db.sessions)) return null;
  const now = Date.now();
  const s = db.sessions.find((x) => x.token === tok && x.kind === "member"
    && new Date(x.expiresAt).getTime() > now);
  if (!s) return null;
  const u = db.users.find((x) => x.id === s.userId);
  return u ? { session: s, user: u } : null;
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
  /* [v1.4.1 PERF FIX] /api/version ไม่ใช้ฐานข้อมูล — เดิม loadDB() รันก่อนดู endpoint
     ทำให้ทุก poll ของ update notifier (ทุกแท็บทุก 60 วิ) ดึง db ทั้งก้อนจาก Firebase
     เปลือง quota ฟรี tier มหาศาล ตอนนี้ตอบก่อนโดยไม่แตะ db */
  if (p === "/api/version" && req.method === "GET") {
    return send(res, 200, {
      version: APP_VERSION,
      semver: APP_SEMVER,
      short: APP_VERSION_SHORT,
      started: APP_STARTED_AT,
      source: process.env.RENDER_GIT_COMMIT ? "render" : "local",
    });
  }

  const db = await loadDB(); // อ่านใหม่ทุก request → ข้อมูลสดเสมอ
  req._db = db; // [v1.2.0] ให้ isAdmin/getSessionUser เข้าถึง sessions ของ request นี้
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
      /* [v1.4.3 FIX] เดิม PUT ไม่เช็คซ้ำ (มีแต่ POST) → แก้เที่ยวรถไปชนเส้นทาง+เวลา
         เดียวกับเที่ยวอื่นได้เงียบๆ — ตอนนี้เช็คโดยไม่นับตัวเอง */
      if (db.buses.some((x) => x.id !== id && x.from === b.from && x.to === b.to && x.depart === b.depart))
        return send(res, 409, { error: "มีเที่ยวรถเส้นทางและเวลานี้อยู่แล้ว" });
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
    /* [v1.2.0] mine=1 — ตั๋วของผู้ใช้ที่ล็อกอิน (ผูก userId ตอนจอง) พร้อม PII เต็มเฉพาะตัวเอง */
    const uq = new URL(req.url, "http://x");
    if (uq.searchParams.get("mine") === "1") {
      const su = getSessionUser(req);
      if (!su) return send(res, 401, { error: "กรุณาเข้าสู่ระบบก่อน" });
      const mine = db.bookings.filter((b) => b.userId === su.user.id)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      return send(res, 200, mine);
    }
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
        checkedInAt: b.checkedInAt,
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
      checkedInAt: hit.checkedInAt,
      total: hit.total,
      createdAt: hit.createdAt,
    });
  }

  if (p === "/api/bookings" && m === "POST") {
    const body = await readBody(req);
    const bus = db.buses.find((x) => x.id === body.busId);
    if (!bus) return send(res, 400, { error: "ไม่พบเที่ยวรถที่เลือก" });

    // ตรวจสอบความถูกต้องของวันที่ (ต้องเป็นวันที่จริง ไม่ใช่อดีต และไม่เกิน 180 วัน)
    const dateStr = String(body.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return send(res, 400, { error: "รูปแบบวันที่ไม่ถูกต้อง" });
    const targetDate = new Date(dateStr + "T00:00:00Z");
    if (isNaN(targetDate.getTime()) || targetDate.toISOString().slice(0, 10) !== dateStr)
      return send(res, 400, { error: "วันที่ไม่ถูกต้องตามปฏิทิน" });
    const today = new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1); // เผื่อ timezone เล็กน้อย
    const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 180); // ล่วงหน้าสูงสุด 6 เดือน
    if (targetDate < minDate) return send(res, 400, { error: "ไม่สามารถจองรอบรถในอดีตได้" });
    if (targetDate > maxDate) return send(res, 400, { error: "สามารถจองล่วงหน้าได้ไม่เกิน 180 วัน" });

    const seats = Array.isArray(body.seats) ? [...new Set(body.seats.map(Number))] : [];
    const totalSeats = bus.seats || TYPE_INFO[bus.type].seats;
    if (!seats.length) return send(res, 400, { error: "กรุณาเลือกที่นั่งอย่างน้อย 1 ที่" });
    if (seats.length > 10) return send(res, 400, { error: "สามารถเลือกจองได้สูงสุด 10 ที่นั่งต่อครั้ง" });
    if (seats.some((s) => !Number.isInteger(s) || s < 1 || s > totalSeats))
      return send(res, 400, { error: `หมายเลขที่นั่งต้องอยู่ระหว่าง 1-${totalSeats}` });

    const name = String(body.name || "").trim().slice(0, 80);
    const phone = String(body.phone || "").replace(/[-\s]/g, "");
    if (name.length < 3) return send(res, 400, { error: "กรุณากรอกชื่อ–นามสกุล (3-80 ตัวอักษร)" });
    if (!/^0\d{8,9}$/.test(phone)) return send(res, 400, { error: "เบอร์โทรศัพท์ไม่ถูกต้อง" });

    // ตรวจที่นั่งซ้ำกับการจองที่ยัง active หรือ checked_in
    const taken = new Set(
      db.bookings.filter((k) => k.busId === bus.id && k.date === dateStr && (k.status === "active" || k.status === "checked_in"))
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

    /* [v1.4.1 FIX] รหัสตั๋วสุ่ม 6 hex — เดิมไม่เช็คซ้ำกับ db เลย (โอกาสชน ~1/16.7M ต่อการจอง
       แต่ถ้าชน = ตั๋วสองใบใช้รหัสเดียวกัน ค้น/ยกเลิกผิดฝั่ง) — ตอนนี้สุ่มซ้ำจะสุ่มใหม่สูงสุด 5 ครั้ง */
    let code = "";
    for (let tries = 0; tries < 5; tries++) {
      code = "BG-" + crypto.randomBytes(3).toString("hex").toUpperCase();
      if (!db.bookings.some((x) => x.code === code)) break;
    }

    const booking = {
      code,
      busId: bus.id,
      date: dateStr,
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
    const su = getSessionUser(req);
    if (su) booking.userId = su.user.id; // [v1.2.0] ผูกการจองกับบัญชีสมาชิก (ถ้าล็อกอินอยู่)
    db.bookings.push(booking);
    await saveDB(db);
    return send(res, 201, { booking });
  }

  let mb;
  if ((mb = p.match(/^\/api\/bookings\/([^/]+)(\/cancel|\/checkin|\/uncheckin)?$/))) {
    const code = decodeURIComponent(mb[1]).trim().toUpperCase();
    if (!/^BG-[0-9A-F]{6,12}$/.test(code)) return send(res, 400, { error: "รูปแบบรหัสตั๋วไม่ถูกต้อง" });
    const bk = db.bookings.find((x) => x.code === code);
    if (!bk) return send(res, 404, { error: "ไม่พบรายการจองนี้" });
    const action = mb[2];

    /* [v1.1.0] ระบบสแกนเช็คอินขึ้นรถ (Phase 1) */
    if (action === "/checkin" && m === "PATCH") {
      if (!isAdmin(req)) return send(res, 401, { error: "ต้องการสิทธิ์ผู้ดูแล" });
      if (bk.status === "cancelled") return send(res, 400, { error: "ตั๋วนี้ถูกยกเลิกไปแล้ว ไม่สามารถเช็คอินได้" });
      if (bk.status === "checked_in") return send(res, 409, { error: `ตั๋วนี้เช็คอินขึ้นรถไปแล้วเมื่อ ${bk.checkedInAt ? new Date(bk.checkedInAt).toLocaleTimeString("th-TH") : ""}`, booking: bk });
      bk.status = "checked_in";
      bk.checkedInAt = new Date().toISOString();
      await saveDB(db);
      return send(res, 200, { booking: bk, message: "เช็คอินขึ้นรถสำเร็จ" });
    }

    if (action === "/uncheckin" && m === "PATCH") {
      if (!isAdmin(req)) return send(res, 401, { error: "ต้องการสิทธิ์ผู้ดูแล" });
      if (bk.status !== "checked_in") return send(res, 400, { error: "ตั๋วนี้ยังไม่ได้เช็คอิน" });
      bk.status = "active";
      delete bk.checkedInAt;
      await saveDB(db);
      return send(res, 200, { booking: bk, message: "ยกเลิกสถานะเช็คอินแล้ว" });
    }

    if (action === "/cancel" && m === "PATCH") {
      if (bk.status === "cancelled") return send(res, 409, { error: "รายการนี้ถูกยกเลิกไปแล้ว" });
      if (bk.status === "checked_in") return send(res, 409, { error: "ตั๋วนี้เช็คอินขึ้นรถแล้ว ไม่สามารถยกเลิกได้" });
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
    if (!action && m === "DELETE") {
      if (!isAdmin(req)) return send(res, 401, { error: "ต้องการสิทธิ์ผู้ดูแล" });
      db.bookings = db.bookings.filter((x) => x.code !== code);
      await saveDB(db);
      return send(res, 200, { deleted: code });
    }
  }

  /* ---------- AUTH (v1.2.0): สมาชิก + admin session ---------- */
  if (p === "/api/auth/register" && m === "POST") {
    const body = await readBody(req);
    const name = String(body.name || "").trim().slice(0, 80);
    const password = String(body.password || "");
    const phone = String(body.phone || "").replace(/[-\s]/g, "");
    if (name.length < 3) return send(res, 400, { error: "กรุณากรอกชื่อ–นามสกุล (3-80 ตัวอักษร)" });
    if (password.length < 8 || password.length > 128) return send(res, 400, { error: "รหัสผ่านต้องมีความยาว 8-128 ตัวอักษร" });
    if (!/^0\d{8,9}$/.test(phone)) return send(res, 400, { error: "เบอร์โทรศัพท์ไม่ถูกต้อง" });
    /* [v1.2.1] ใช้ชื่อเป็นตัวระบุบัญชี (ไม่ใช่อีเมล) — เก็บ nameLower กันซ้ำแบบไม่สนตัวพิมพ์ */
    const nameLower = name.toLowerCase();
    if (db.users.some((x) => x.nameLower === nameLower)) return send(res, 409, { error: "ชื่อนี้ถูกใช้สมัครแล้ว — ลองเข้าสู่ระบบ หรือใช้ชื่ออื่น" });
    const salt = crypto.randomBytes(16).toString("hex");
    const user = {
      id: "U" + crypto.randomBytes(4).toString("hex").toUpperCase(),
      name, nameLower, phone,
      salt,
      passHash: hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    const sess = createSession(db, "member", user.id, MEMBER_SESSION_MS);
    await saveDB(db);
    return send(res, 201, { token: sess.token, expiresAt: sess.expiresAt, user: publicSelf(user) });
  }

  if (p === "/api/auth/login" && m === "POST") {
    const body = await readBody(req).catch(() => ({}));
    const nameLower = String(body.name || "").trim().toLowerCase();
    const password = String(body.password || "");
    const u = db.users.find((x) => x.nameLower === nameLower);
    /* ข้อความเดียวกันทั้งกรณีไม่พบชื่อ/รหัสผ่านผิด — กัน enumeration */
    if (!u || !verifyPassword(password, u)) return send(res, 401, { ok: false, error: "ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง" });
    const sess = createSession(db, "member", u.id, MEMBER_SESSION_MS);
    await saveDB(db);
    return send(res, 200, { token: sess.token, expiresAt: sess.expiresAt, user: publicSelf(u) });
  }

  if (p === "/api/auth/logout" && m === "POST") {
    const tok = String(req.headers["x-session"] || "");
    if (tok && Array.isArray(db.sessions)) {
      const idx = db.sessions.findIndex((s) => s.token === tok);
      if (idx !== -1) {
        db.sessions.splice(idx, 1);
        await saveDB(db);
        return send(res, 200, { ok: true });
      }
    }
    return send(res, 200, { ok: true }); // logout ของ session ที่ไม่มีอยู่ก็ถือว่าสำเร็จ
  }

  if (p === "/api/auth/me" && m === "GET") {
    const su = getSessionUser(req);
    if (!su) return send(res, 401, { error: "ไม่ได้เข้าสู่ระบบ" });
    return send(res, 200, { user: publicSelf(su.user), expiresAt: su.session.expiresAt });
  }

  if (p === "/api/admin/login" && m === "POST") {
    const ip = clientIp(req);
    const lock = adminLockInfo(ip);
    if (lock.locked) return send(res, 429, { ok: false, error: `ล็อกอินผิดพลาดหลายครั้ง — ลองใหม่ในอีก ${lock.minsLeft} นาที` });
    let body = {};
    try { body = await readBody(req); } catch {}
    /* [FIX v1.2.0] เทียบรหัสที่ส่งมาใน body.key (ไม่ใช่ header) แบบ timing-safe */
    const given = Buffer.from(String(body.key || ""));
    const want = Buffer.from(ADMIN_KEY);
    if (!(given.length === want.length && crypto.timingSafeEqual(given, want))) {
      adminRecordFail(ip);
      const left = ADMIN_MAX_FAILS - (adminFails.get(ip)?.count || 0);
      return send(res, 401, { ok: false, error: "รหัสผ่านไม่ถูกต้อง", remaining: Math.max(left, 0) });
    }
    adminFails.delete(ip);
    const sess = createSession(db, "admin", null, body.remember ? ADMIN_REMEMBER_MS : ADMIN_SESSION_MS);
    await saveDB(db);
    return send(res, 200, { ok: true, token: sess.token, expiresAt: sess.expiresAt });
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

  /* ---------- VERSION (update notifier) — ย้ายไปตอนต้น handleApi ก่อน loadDB (v1.4.1) ---------- */

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
      // [v1.2.0] register/login/admin-login: 10 ครั้ง/5 นาที ต่อ IP (กัน brute force รหัสผ่าน)
      if ((p === "/api/auth/register" || p === "/api/auth/login" || p === "/api/admin/login") && m !== "GET"
        && !rateLimit(req, res, "auth:" + ip, 10, 5 * 60 * 1000)) return;
      // ค้นหาตั๋วข้ามเครื่อง: 10 ครั้ง/5 นาที ต่อ IP (กัน brute force เบอร์โทร)
      /* [v1.4.1 FIX] เดิมใช้ isAdmin(req) ซึ่งต้องอ่าน db.sessions (ยังไม่โหลด ณ จุดนี้)
         → admin ที่ล็อกอินด้วย session ถูกจำกัด rate limit เหมือนคนทั่วไป
         ตอนนี้เช็คเฉพาะ x-admin-key (timing-safe ไม่ต้องใช้ db) สำหรับ automation เท่านั้น */
      if (p === "/api/bookings/search" && !isAdminKey(req) && !rateLimit(req, res, "search:" + ip, 10, 5 * 60 * 1000)) return;
      // เช็ครหัส admin: 10 ครั้ง/5 นาที (กัน brute force)
      if (p === "/api/admin/check" && !rateLimit(req, res, "auth:" + ip, 10, 5 * 60 * 1000)) return;
      /* [v1.0.2] ยกเลิกการจอง: 8 ครั้ง/15 นาที ต่อ IP — โค้ดตั๋วโชว์สาธารณะบนผังที่นั่ง
         คนร้ายจึงลองเดาเบอร์โทรเพื่อ PATCH /cancel ได้ ต้องมี limit เฉพาะ
         [v1.4.1] ยกเป็น 8 ครั้ง (เดิม 5) เผื่อ admin ใช้ session จัดการหลายรายการติดกัน */
      if (m === "PATCH" && /^\/api\/bookings\/[^/]+\/cancel$/.test(p) && !isAdminKey(req)
        && !rateLimit(req, res, "cancel:" + ip, 8, 15 * 60 * 1000)) return;
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



