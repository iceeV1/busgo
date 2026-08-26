"use strict";
/* ============================================================
   BusGo Backend — Node.js ล้วน ไม่ต้อง npm install
   ฐานข้อมูล: data/db.json | API: /api/buses, /api/bookings
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const ADMIN_KEY = process.env.ADMIN_KEY || "admin1234";
const APP_SEMVER = "1.0.0"; // เวอร์ชันระบบ — อัปเกรดครั้งใหญ่ขึ้นเลขนี้ (เช่น 1.1.0, 2.0.0)
const APP_VERSION = process.env.RENDER_GIT_COMMIT || String(fs.statSync(__filename).mtimeMs);
const APP_VERSION_SHORT = APP_VERSION.slice(0, 7);
const APP_STARTED_AT = new Date().toISOString();

const TYPE_INFO = {
  vip: { seats: 32 },
  air: { seats: 44 },
  eco: { seats: 48 },
};
const MODES = ["bus", "train", "ferry"];
const PAY_METHODS = ["promptpay", "card", "wallet"];

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
const SAMPLE_EXTRA = [
  { id: "TR01", from: "กรุงเทพฯ", to: "เชียงใหม่", depart: "18:10", arrive: "07:15", duration: "13 ชม. 05 นาที", type: "air", mode: "train", price: 881, seats: 40 },
  { id: "TR02", from: "กรุงเทพฯ", to: "หาดใหญ่", depart: "17:30", arrive: "09:20", duration: "15 ชม. 50 นาที", type: "eco", mode: "train", price: 474, seats: 48 },
  { id: "FR01", from: "กระบี่", to: "เกาะพีพี", depart: "09:00", arrive: "10:30", duration: "1 ชม. 30 นาที", type: "air", mode: "ferry", price: 450, seats: 44 },
  { id: "FR02", from: "ดอนสัก", to: "เกาะสมุย", depart: "08:00", arrive: "11:00", duration: "3 ชม.", type: "eco", mode: "ferry", price: 200, seats: 48 },
];

const DEFAULT_PROMOS = [{ code: "WELCOME10", percent: 10, active: true }];

function normalize(db) {
  let changed = false;
  (db.buses || []).forEach((b) => { if (!b.mode) { b.mode = "bus"; changed = true; } });
  if (!Array.isArray(db.promos)) { db.promos = JSON.parse(JSON.stringify(DEFAULT_PROMOS)); changed = true; }
  if (!db.seededExtra) {
    const have = new Set((db.buses || []).map((b) => b.id));
    SAMPLE_EXTRA.forEach((s) => { if (!have.has(s.id)) db.buses.push({ ...s }); });
    db.seededExtra = true;
    changed = true;
  }
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
      buses: DEFAULT_BUSES.map((b) => ({ ...b, mode: "bus" })).concat(SAMPLE_EXTRA.map((s) => ({ ...s }))),
      bookings: [],
      promos: JSON.parse(JSON.stringify(DEFAULT_PROMOS)),
      seededExtra: true,
      seq: 1,
    };
    await saveDB(db);
    return db;
  }
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
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function sendFile(res, filePath) {
  const full = path.normalize(filePath);
  if (!full.startsWith(ROOT)) return send(res, 403, { error: "Forbidden" });
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return send(res, 404, { error: "Not Found" });
  res.writeHead(200, {
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
    req.on("data", (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(new Error("JSON ไม่ถูกต้อง")); } });
    req.on("error", reject);
  });
}
function isAdmin(req) { return req.headers["x-admin-key"] === ADMIN_KEY; }

function validateBus(b) {
  if (!b || typeof b !== "object") return "ข้อมูลไม่ถูกต้อง";
  if (!String(b.from || "").trim()) return "กรุณาระบุต้นทาง";
  if (!String(b.to || "").trim()) return "กรุณาระบุปลายทาง";
  if (!/^\d{2}:\d{2}$/.test(b.depart || "")) return "เวลาออกไม่ถูกต้อง";
  if (!/^\d{2}:\d{2}$/.test(b.arrive || "")) return "เวลาถึงไม่ถูกต้อง";
  if (!String(b.duration || "").trim()) return "กรุณาระบุระยะเวลาเดินทาง";
  if (!TYPE_INFO[b.type]) return "ประเภทรถต้องเป็น vip / air / eco";
  if (b.mode && !MODES.includes(b.mode)) return "ชนิดการเดินทางต้องเป็น bus / train / ferry";
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
      mode: MODES.includes(b.mode) ? b.mode : "bus",
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
    return send(res, 200, list);
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
      code: "BG-" + Date.now().toString(36).toUpperCase().slice(-4) + "-" + String(db.seq++ % 1000).padStart(3, "0"),
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

  /* ---------- ADMIN AUTH CHECK ---------- */
  if (p === "/api/admin/check" && m === "GET") {
    return send(res, isAdmin(req) ? 200 : 401, { ok: isAdmin(req) });
  }

  return send(res, 404, { error: "API ไม่พบ: " + p });
}

/* ================= SERVER ================= */
const server = http.createServer(async (req, res) => {
  let p = new URL(req.url, "http://x").pathname;
  try {
    if (p.startsWith("/api/")) return await handleApi(req, res, p);
    if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "") || "/"; // รองรับ /admin/
    let file = p === "/" ? "/index.html" : p === "/admin" ? "/admin.html" : p;
    return sendFile(res, path.join(ROOT, file));
  } catch (e) {
    console.error("[ERROR]", e.message);
    try { send(res, 500, { error: "Internal Server Error" }); } catch {}
  }
});

// กัน process ล่มบน cloud (สำคัญมากสำหรับ free tier)
process.on("uncaughtException", (e) => console.error("[UNCAUGHT]", e.message));
process.on("unhandledRejection", (e) => console.error("[REJECTION]", e && e.message ? e.message : e));

server.listen(PORT, () => {
  console.log("=========================================");
  console.log("  BusGo Server กำลังทำงาน");
  console.log(`  หน้าเว็บหลัก : http://localhost:${PORT}`);
  console.log(`  หลังบ้าน     : http://localhost:${PORT}/admin`);
  console.log(`  Admin Key    : ${ADMIN_KEY}`);
  console.log(`  ฐานข้อมูล    : ${DB_PATH}`);
  console.log("=========================================");
});



