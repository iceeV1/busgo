"use strict";

/* ================= DATA ================= */
const PROVINCES = [
  "กรุงเทพฯ", "เชียงใหม่", "ภูเก็ต", "ขอนแก่น", "นครราชสีมา",
  "หาดใหญ่", "พัทยา", "สุราษฎร์ธานี", "อุดรธานี", "แม่ฮ่องสอน",
];

const TYPE_INFO = {
  vip: { label: "VIP", seats: 32, cls: "badge-vip" },
  air: { label: "ปรับอากาศ", seats: 44, cls: "badge-air" },
  eco: { label: "ธรรมดา", seats: 48, cls: "badge-eco" },
};

let BUSES = [ // ค่าเริ่มต้น (ใช้ทันที / เป็น fallback ถ้าไม่มีเซิร์ฟเวอร์)
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

/* ================= STATE / STORAGE ================= */
const LS_MIRROR = "busgo_local_bookings"; // สำรองไว้ใช้ตอนออฟไลน์
const LS_MY = "busgo_my_codes";           // รหัสตั๋วที่จองจากเบราว์เซอร์นี้
const LS_SESSION = "busgo_member_token";  // [v1.2.0] member session token
let bookings = [];
let serverOnline = false;
let currentUser = null; // [v1.2.0] { id, name, phone } เมื่อล็อกอิน (v1.2.1 ตัด email ออก)
let state = {
  date: localToday(), // [v1.4.1] วันที่แบบ timezone ไทย — เดิมใช้ toISOString (UTC) ทำให้ 00:00-06:59 น. ได้วันเมื่อวาน
  returnDate: "",
  tripType: "oneway",
  pax: 1,
  mode: "bus",
  from: "", to: "", type: "",
  currentBusId: null,
  currentDate: null,
  appliedPromo: null,
  custName: "", custPhone: "", custNote: "",
  selectedSeats: new Set(),
};

/* [v1.4.1] วันที่วันนี้ตามเวลาเครื่องผู้ใช้ (ไม่ใช่ UTC) */
function localToday() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function myCodes() {
  try { return JSON.parse(localStorage.getItem(LS_MY) || "[]"); } catch { return []; }
}
function addMyCode(code) {
  const s = myCodes();
  if (s.includes(code)) return; // [v1.4.3 FIX] กันโค้ดซ้ำสะสมใน localStorage
  s.unshift(code);
  localStorage.setItem(LS_MY, JSON.stringify(s.slice(0, 50)));
}

/* ============ AUTH: MEMBER SESSION (v1.2.0) ============ */
function getSessionToken() { return localStorage.getItem(LS_SESSION) || ""; }
function setSessionToken(tok) {
  if (tok) localStorage.setItem(LS_SESSION, tok);
  else localStorage.removeItem(LS_SESSION);
}
async function apiAuth(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const tok = getSessionToken();
  if (tok) headers["x-session"] = tok;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}
function updateAuthUI() {
  const btn = $("authBtn");
  const box = $("userBox");
  if (!btn || !box) return;
  if (currentUser) {
    btn.classList.add("hidden");
    box.classList.remove("hidden");
    $("userName").textContent = currentUser.name;
  } else {
    btn.classList.remove("hidden");
    box.classList.add("hidden");
    $("userName").textContent = "";
  }
}
/* ดึงตั๋วที่ผูกกับบัญชี (mine=1) — เติมเข้า myCodes เพื่อใช้ render pipeline เดิม */
async function syncMineTickets() {
  if (!currentUser || !serverOnline) return;
  try {
    const mine = await apiAuth("GET", "/api/bookings?mine=1");
    for (const bk of mine) {
      const idx = bookings.findIndex((b) => b.code === bk.code);
      if (idx !== -1) bookings[idx] = { ...bookings[idx], ...bk };
      else bookings.unshift(bk);
      if (!myCodes().includes(bk.code)) addMyCode(bk.code);
    }
    updateBadge();
    if (!$("tab-tickets").classList.contains("hidden")) renderTickets();
  } catch {}
}
async function initAuth() {
  const tok = getSessionToken();
  if (!tok) { updateAuthUI(); return; }
  try {
    const d = await apiAuth("GET", "/api/auth/me");
    currentUser = d.user;
  } catch {
    setSessionToken("");
    currentUser = null;
  }
  updateAuthUI();
}
function openAuthModal(mode) {
  $("authModal").classList.remove("hidden");
  switchAuthTab(mode === "register" ? "register" : "login");
  document.body.style.overflow = "hidden";
}
function closeAuthModal() {
  $("authModal").classList.add("hidden");
  document.body.style.overflow = "";
}
function switchAuthTab(tab) {
  $("authTabLogin").classList.toggle("active", tab === "login");
  $("authTabRegister").classList.toggle("active", tab === "register");
  $("authLoginForm").classList.toggle("hidden", tab !== "login");
  $("authRegisterForm").classList.toggle("hidden", tab !== "register");
}
function loadMirror() {
  try { return JSON.parse(localStorage.getItem(LS_MIRROR) || "[]"); } catch { return []; }
}
/* Server ส่งรายการจองมาแบบไม่มี PII (ชื่อ/เบอร์/หมายเหตุ) กันข้อมูลรั่ว
   ตั๋วของเราเติมข้อมูลส่วนตัวกลับจาก localStorage ของเครื่องตัวเองได้ */
function withPii(bk) {
  if (bk.name !== undefined) return bk;
  const o = loadMirror().find((x) => x.code === bk.code);
  return o ? { ...o, ...bk } : bk;
}
function saveMirror() {
  try {
    const old = loadMirror();
    /* ถ้า record จาก server ถูกซ่อน PII ให้ผสมข้อมูลส่วนตัวเดิมกลับเข้าไปด้วย */
    const merged = bookings.map((bk) =>
      bk.name === undefined ? { ...(old.find((x) => x.code === bk.code) || {}), ...bk } : bk
    );
    for (const o of old) if (!merged.some((x) => x.code === o.code)) merged.push(o);
    localStorage.setItem(LS_MIRROR, JSON.stringify(merged));
  } catch {}
}

/* โหลดข้อมูลจากหลังบ้าน (server.js) — fallback เป็น localStorage ถ้าออฟไลน์ */
async function loadData() {
  try {
    const [busRes, bkRes] = await Promise.all([fetch("/api/buses"), fetch("/api/bookings")]);
    if (!busRes.ok || !bkRes.ok) throw new Error("offline");
    BUSES = await busRes.json();
    bookings = await bkRes.json();
    serverOnline = true;
  } catch {
    serverOnline = false;
    try { bookings = JSON.parse(localStorage.getItem(LS_MIRROR) || "[]"); } catch { bookings = []; }
  }
}

/* ย้ายข้อมูลเวอร์ชันเก่า (localStorage) เข้าระบบใหม่ครั้งแรกครั้งเดียว */
(function migrateOldBookings() {
  try {
    const old = JSON.parse(localStorage.getItem("busgo_bookings") || "[]");
    if (old.length) {
      const mirror = JSON.parse(localStorage.getItem(LS_MIRROR) || "[]");
      const merged = [...mirror, ...old.filter((o) => !mirror.some((m) => m.code === o.code))];
      localStorage.setItem(LS_MIRROR, JSON.stringify(merged));
      old.forEach((o) => addMyCode(o.code));
      localStorage.removeItem("busgo_bookings");
    }
  } catch {}
})();

/* Deterministic pseudo-random occupied seats per bus+date */
/* [v1.1.3] ตัดระบบ "ที่นั่งถูกจองปลอม" ออก — เดิมสุ่มที่นั่ง occupied ฝั่ง client
   ทำให้ผังที่นั่ง/% ว่างไม่ตรงกับความจริงที่เซิร์ฟเวอร์รู้ (server ไม่รู้จักที่นั่งพวกนี้)
   ตอนนี้แสดงเฉพาะที่นั่งที่ถูกจองจริงจาก /api/bookings เท่านั้น */
function getOccupied(busId, date, total) {
  return new Set();
}
function getUserTaken(busId, date) {
  const set = new Set();
  bookings.forEach((b) => {
    if (b.busId === busId && b.date === date && (b.status === "active" || b.status === "checked_in")) {
      b.seats.forEach((s) => set.add(s));
    }
  });
  return set;
}
function seatsLeftOf(bus, date) {
  const total = TYPE_INFO[bus.type].seats;
  const occ = getOccupied(bus.id, date, total);
  const user = getUserTaken(bus.id, date);
  user.forEach((s) => occ.add(s));
  return total - occ.size;
}

/* ================= HELPERS ================= */
const $ = (id) => document.getElementById(id);
const esc = (t) => (t == null ? "" : String(t)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} (วัน${days[d.getDay()]})`;
}
function showToast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast" + (isError ? " error" : "");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add("hidden"), 2800);
}
function genCode() {
  /* [v1.1.2 FIX] ใช้เฉพาะโหมดออฟไลน์ — ต้องอยู่ฟอร์แมตเดียวกับฝั่งเซิร์ฟเวอร์
     (^BG-[0-9A-F]{6,12}) มิฉะนั้น PATCH /cancel กับ GET /search จะโดน 400
     "รูปแบบรหัสตั๋วไม่ถูกต้อง" เมื่อเอาตั๋ว offline ไปใช้กับ API */
  const buf = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(buf);
  else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  const hex = Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return "BG-" + hex;
}
function findBus(id) { return BUSES.find((b) => b.id === id); }

/* ================= TABS ================= */
function switchTab(name) {
  document.querySelectorAll(".nav-link").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name));
  $("tab-schedules").classList.toggle("hidden", name !== "schedules");
  $("tab-tickets").classList.toggle("hidden", name !== "tickets");
  if (name === "tickets") renderTickets();
}
document.querySelectorAll(".nav-link").forEach((btn) =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

/* ================= SEARCH / FILTERS ================= */
const LS_RECENT = "busgo_recent_searches";
function initFilters() {
  const fromSel = $("fromSelect"), toSel = $("toSelect");
  PROVINCES.forEach((p) => {
    fromSel.insertAdjacentHTML("beforeend", `<option value="${esc(p)}">${esc(p)}</option>`);
    toSel.insertAdjacentHTML("beforeend", `<option value="${esc(p)}">${esc(p)}</option>`);
  });
  const paxSel = $("paxSelect");
  [1, 2, 3, 4, 5, 6].forEach((n) =>
    paxSel.insertAdjacentHTML("beforeend", `<option value="${n}">${n} คน</option>`));

  $("dateInput").value = state.date;
  $("dateInput").min = localToday(); // [v1.4.1] ใช้เวลาท้องถิ่น ไม่ใช่ UTC
  $("returnDateInput").min = state.date;

  // เที่ยวเดียว / ไป-กลับ
  document.querySelectorAll('input[name="tripType"]').forEach((r) =>
    r.addEventListener("change", () => {
      state.tripType = document.querySelector('input[name="tripType"]:checked').value;
      $("returnField").classList.toggle("hidden", state.tripType !== "roundtrip");
      if (state.tripType === "roundtrip") {
        const rd = $("returnDateInput");
        rd.min = $("dateInput").value || state.date;
        if (!rd.value) rd.value = rd.min;
        state.returnDate = rd.value;
      }
      renderBuses();
    }));
  $("returnDateInput").addEventListener("change", () => { state.returnDate = $("returnDateInput").value; });

  $("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.from = fromSel.value;
    state.to = toSel.value;
    state.type = $("typeSelect").value;
    state.pax = parseInt($("paxSelect").value, 10) || 1;
    const d = $("dateInput").value;
    if (!d) { showToast("กรุณาเลือกวันที่เดินทาง", true); return; }
    if (state.from && state.to && state.from === state.to) {
      showToast("ต้นทางและปลายทางต้องไม่ซ้ำกัน", true); return;
    }
    state.date = d;
    if (state.tripType === "roundtrip") {
      state.returnDate = $("returnDateInput").value;
      if (!state.returnDate) { showToast("กรุณาเลือกวันที่เดินทางกลับ", true); return; }
      if (state.returnDate < state.date) { showToast("วันที่กลับต้องไม่ก่อนวันไป", true); return; }
    }
    saveRecentSearch();
    renderBuses();
  });

  $("swapBtn").addEventListener("click", () => {
    const tmp = fromSel.value;
    fromSel.value = toSel.value;
    toSel.value = tmp;
  });

  renderRecent();
}

/* ---------- Recent Search ---------- */
function saveRecentSearch() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_RECENT) || "[]");
    arr.unshift({
      from: state.from, to: state.to, date: state.date,
      ret: state.returnDate, type: state.type, mode: state.mode,
      pax: state.pax, tripType: state.tripType,
    });
    localStorage.setItem(LS_RECENT, JSON.stringify(arr.slice(0, 3)));
  } catch {}
  renderRecent();
}
function renderRecent() {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(LS_RECENT) || "[]"); } catch {}
  const row = $("recentRow");
  if (!arr.length) { row.classList.add("hidden"); return; }
  row.classList.remove("hidden");
  row.innerHTML =
    `<span class="muted small">ค้นหาล่าสุด:</span> ` +
    arr.map((r, i) =>
      `<button class="chip" data-recent="${i}">${esc(r.from || "ทุกต้นทาง")} → ${esc(r.to || "ทุกปลายทาง")}</button>`
    ).join("");
  row.querySelectorAll("[data-recent]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const r = arr[+btn.dataset.recent];
      $("fromSelect").value = r.from || "";
      $("toSelect").value = r.to || "";
      $("dateInput").value = r.date;
      $("typeSelect").value = r.type || "";
      $("paxSelect").value = String(r.pax || 1);
      state.tripType = r.tripType || "oneway";
      const radio = document.querySelector(`input[name="tripType"][value="${state.tripType}"]`);
      if (radio) radio.checked = true;
      $("returnField").classList.toggle("hidden", state.tripType !== "roundtrip");
      if (r.ret) $("returnDateInput").value = r.ret;
      $("searchForm").requestSubmit();
    }));
}

/* ---------- Popular Routes ---------- */
function renderPopular() {
  const counts = {};
  BUSES.forEach((b) => {
    if ((b.mode || "bus") !== state.mode) return;
    const k = b.from + "|" + b.to;
    counts[k] = counts[k] || { from: b.from, to: b.to, n: 0 };
    counts[k].n++;
  });
  window._topRoutes = Object.values(counts).sort((a, b) => b.n - a.n).slice(0, 8);
  const wrap = $("popularRoutes");
  wrap.innerHTML = window._topRoutes.length
    ? window._topRoutes.map((r) =>
        `<button class="route-chip">${esc(r.from)} → ${esc(r.to)}<small>${r.n} เที่ยว/วัน</small></button>`).join("")
    : '<span class="muted">ไม่มีข้อมูลเส้นทาง</span>';
  wrap.querySelectorAll(".route-chip").forEach((ch, i) =>
    ch.addEventListener("click", () => {
      const r = window._topRoutes[i];
      $("fromSelect").value = r.from;
      $("toSelect").value = r.to;
      $("searchForm").requestSubmit();
    }));
}

/* ---------- Promo strip ---------- */
async function loadPromoStrip() {
  try {
    const res = await fetch("/api/promos");
    const promos = await res.json();
    if (!promos.length) { $("promoStrip").classList.add("hidden"); return; }
    $("promoStrip").innerHTML = promos.map((p) =>
      `<span class="promo-chip">โค้ด <b>${esc(p.code)}</b> ลด ${p.percent}%</span>`).join("") +
      `<span class="muted small">ใส่โค้ดได้ตอนกรอกข้อมูลผู้โดยสาร</span>`;
    $("promoStrip").classList.remove("hidden");
  } catch { $("promoStrip").classList.add("hidden"); }
}

/* ================= RENDER BUS LIST ================= */
function getFilteredBuses() {
  return BUSES.filter((b) =>
    (!state.mode || (b.mode || "bus") === state.mode) &&
    (!state.from || b.from === state.from) &&
    (!state.to || b.to === state.to) &&
    (!state.type || b.type === state.type)
  );
}
function busesFor(fromCity, toCity) {
  return BUSES.filter((b) =>
    (!state.mode || (b.mode || "bus") === state.mode) &&
    (!state.type || b.type === state.type) &&
    (!fromCity || b.from === fromCity) &&
    (!toCity || b.to === toCity)
  );
}

function busCardsHTML(list, date) {
  return list.map((bus, i) => {
    const info = TYPE_INFO[bus.type];
    const left = seatsLeftOf(bus, date);
    const totalSeats = bus.seats || info.seats;
    const pct = Math.round((left / totalSeats) * 100);
    return `
    <article class="bus-card" style="animation-delay:${i * 0.06}s">
      <div class="bus-card-top">
        <span class="route-name">${esc(bus.from)} → ${esc(bus.to)}</span>
        <span class="badge ${info.cls}">${info.label}</span>
      </div>
      <div class="time-row">
        <span class="time">${bus.depart}</span>
        <span class="arrow-line">${esc(bus.duration)}</span>
        <span class="time">${bus.arrive}</span>
      </div>
      <div class="muted small">รหัสเที่ยวรถ ${bus.id} · ${totalSeats} ที่นั่ง</div>
      <div class="seat-progress">
        <div class="bar"><div class="fill ${pct < 25 ? "low" : ""}" style="width:${pct}%"></div></div>
        <div class="seat-text">
          <span>ว่าง ${left} จาก ${totalSeats} ที่</span>
          <span>${pct}% ว่าง</span>
        </div>
      </div>
      <div class="bus-card-bottom">
        <div class="price">฿${bus.price.toLocaleString()} <small>/ ที่นั่ง</small></div>
        <button class="btn btn-primary" data-book="${bus.id}" data-date="${date}" ${left === 0 ? "disabled" : ""}>
          ${left === 0 ? "เต็มแล้ว" : "จองคิว"}
        </button>
      </div>
    </article>`;
  }).join("");
}

function renderBuses() {
  const wrap = $("busList");
  const roundTrip = state.tripType === "roundtrip" && !!state.returnDate;

  const outbound = busesFor(state.from, state.to);
  const back = roundTrip ? busesFor(state.to, state.from) : [];
  const totalFound = outbound.length + back.length;

  $("emptyState").classList.toggle("hidden", totalFound > 0);
  $("resultsCount").textContent = roundTrip
    ? `พบ ${outbound.length} เที่ยวขาไป · ${back.length} เที่ยวขากลับ`
    : `พบ ${outbound.length} เที่ยวรถ · ${fmtDate(state.date)}`;
  $("resultsTitle").textContent =
    state.from || state.to
      ? `${state.from || "ทุกต้นทาง"} → ${state.to || "ทุกปลายทาง"}${roundTrip ? " (ไป–กลับ)" : ""}`
      : `ทุกเส้นทาง (รถบัส)`;

  let html = "";
  if (roundTrip) {
    html += `<div class="leg-title">ขาไป · ${fmtDate(state.date)}</div><div class="bus-grid">${
      outbound.length ? busCardsHTML(outbound, state.date) : '<p class="muted leg-empty">ไม่พบเที่ยวขาไป</p>'
    }</div>`;
    html += `<div class="leg-title">ขากลับ · ${fmtDate(state.returnDate)}</div><div class="bus-grid">${
      back.length ? busCardsHTML(back, state.returnDate) : '<p class="muted leg-empty">ไม่พบเที่ยวขากลับ — ลองเลือกวันอื่น</p>'
    }</div>`;
    wrap.classList.add("wide");
  } else {
    html = busCardsHTML(outbound, state.date);
    wrap.classList.remove("wide");
  }
  wrap.innerHTML = html;

  wrap.querySelectorAll("[data-book]").forEach((btn) =>
    btn.addEventListener("click", () => openBooking(btn.dataset.book, btn.dataset.date)));

  renderStats(getFilteredBuses());
}

function renderStats(list) {
  const totalLeft = list.reduce((s, b) => s + Math.max(0, seatsLeftOf(b, state.date)), 0);
  const routes = new Set(BUSES.map((b) => `${b.from}|${b.to}`)).size;
  /* [v1.4.1 FIX] "คิวของคุณ" เดิมนับตั๋ว active ทั้งระบบ (ทุกคน) — ตอนนี้นับเฉพาะตั๋วของเครื่องนี้/บัญชีนี้ */
  const myActive = bookings.filter((b) => myCodes().includes(b.code) && b.status === "active").length;
  $("statsRow").innerHTML = `
    <span class="stat-chip"><b>${list.length}</b>เที่ยวรถที่พบ</span>
    <span class="stat-chip"><b>${totalLeft}</b>ที่นั่งว่าง</span>
    <span class="stat-chip"><b>${routes}</b>เส้นทางทั่วไทย</span>
    <span class="stat-chip"><b>${myActive}</b>คิวของคุณ</span>`;
}

/* ================= BOOKING MODAL ================= */
function openBooking(busId, date) {
  const bus = findBus(busId);
  if (!bus) return;
  state.currentBusId = busId;
  state.currentDate = date || state.date;
  state.selectedSeats.clear();
  state.appliedPromo = null;
  $("promoCode").value = "";

  const info = TYPE_INFO[bus.type];
  $("modalRoute").textContent = `${bus.from} → ${bus.to}`;
  $("modalMeta").textContent =
    `${fmtDate(state.currentDate)} · ออก ${bus.depart} ถึง ${bus.arrive} · ${info.label} (${info.seats} ที่นั่ง)`;

  showStep("stepSeats");
  renderSeatMap();
  $("bookingModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("bookingModal").classList.add("hidden");
  document.body.style.overflow = "";
}

function showStep(stepId) {
  ["stepSeats", "stepInfo", "stepPay", "stepDone"].forEach((id) =>
    $(id).classList.toggle("hidden", id !== stepId));
}

function renderSeatMap() {
  const bus = findBus(state.currentBusId);
  const total = TYPE_INFO[bus.type].seats;
  const occ = getOccupied(bus.id, state.currentDate, total);
  getUserTaken(bus.id, state.currentDate).forEach((s) => occ.add(s));
  const map = $("seatMap");

  // layout: แถวละ [ที่นั่ง, ที่นั่ง, ทางเดิน, ที่นั่ง, ที่นั่ง] = grid 5 คอลัมน์ (2 + ทางเดิน + 2)
  // [v1.4.3 FIX] เดิมใส่ทางเดินหลังที่นั่งที่ 4 ทุกครั้ง → grid กลายเป็น [1][2][3][4][aisle]
  // ทุกแถว (ทางเดินหลุดไปคอลัมน์ขวาสุด ไม่ใช่กลางแถว) — ตอนนี้ใส่หลังที่นั่งที่ 2 ของแต่ละแถว
  let html = "";
  for (let n = 1; n <= total; n++) {
    html += `<button type="button" class="seat ${occ.has(n) ? "taken" : ""}" data-seat="${n}"
      ${occ.has(n) ? "disabled" : ""} aria-label="ที่นั่ง ${n}">${n}</button>`;
    if (n % 2 === 0 && n % 4 !== 0 && n < total) html += `<span class="seat-aisle"></span>`;
  }
  map.innerHTML = html;

  map.querySelectorAll(".seat:not(.taken)").forEach((btn) =>
    btn.addEventListener("click", () => toggleSeat(+btn.dataset.seat)));
  updateSummary();
}

function toggleSeat(n) {
  if (state.selectedSeats.has(n)) {
    state.selectedSeats.delete(n);
  } else {
    if (state.selectedSeats.size >= state.pax) {
      showToast(`จำนวนผู้โดยสาร ${state.pax} คน — เลือกได้ ${state.pax} ที่นั่ง (เปลี่ยนได้ที่ช่อง Pax หน้าค้นหา)`, true);
      return;
    }
    state.selectedSeats.add(n);
  }
  const btn = document.querySelector(`.seat[data-seat="${n}"]`);
  if (btn) btn.classList.toggle("selected", state.selectedSeats.has(n));
  updateSummary();
}

function updateSummary() {
  const bus = findBus(state.currentBusId);
  const seats = [...state.selectedSeats].sort((a, b) => a - b);
  $("selCount").textContent = `${seats.length}`;
  $("selPaxTotal").textContent = state.pax;
  $("selSeats").textContent = seats.length ? seats.join(", ") : "–";
  $("selTotal").textContent = (seats.length * bus.price).toLocaleString();
  $("toInfoBtn").disabled = seats.length === 0;

  const hint = $("paxHint");
  if (seats.length === state.pax) {
    hint.textContent = "เลือกครบแล้ว กดถัดไปได้เลย";
    hint.className = "pax-hint ok";
  } else if (seats.length < state.pax) {
    hint.textContent = `ต้องเลือกให้ครบ ${state.pax} ที่นั่ง — เหลืออีก ${state.pax - seats.length} ที่`;
    hint.className = "pax-hint warn";
  } else {
    hint.textContent = `เกินจำนวนผู้โดยสาร (${state.pax} คน) — ยกเลิกที่นั่งส่วนเกิน หรือเปลี่ยน Pax หน้าค้นหา`;
    hint.className = "pax-hint warn";
  }
}

function computeTotals() {
  const bus = findBus(state.currentBusId);
  const seats = [...state.selectedSeats].sort((a, b) => a - b);
  const gross = seats.length * bus.price;
  const pct = state.appliedPromo ? state.appliedPromo.percent : 0;
  const discount = Math.round((gross * pct) / 100);
  return { bus, seats, gross, pct, discount, net: gross - discount };
}

function refreshSummaries() {
  const t = computeTotals();
  $("sumRoute").textContent = `${t.bus.from} → ${t.bus.to}`;
  $("sumDetail").textContent =
    `${fmtDate(state.currentDate)} · ${t.bus.depart} · ที่นั่ง ${t.seats.join(", ")}`;
  $("sumTotal").textContent = t.net.toLocaleString();
  $("discountLine").classList.toggle("hidden", t.discount === 0);
  if (t.discount > 0) {
    $("discountPct").textContent = `${state.appliedPromo.code} -${t.pct}%`;
    $("discountAmt").textContent = t.discount.toLocaleString();
  }
  $("payAmount").textContent = t.net.toLocaleString();
}

$("toInfoBtn").addEventListener("click", () => {
  if (state.selectedSeats.size !== state.pax) {
    showToast(`เลือกได้ ${state.selectedSeats.size}/${state.pax} ที่นั่ง — ต้องครบตามจำนวนผู้โดยสาร (เปลี่ยนได้ที่ช่อง Pax หน้าค้นหา)`, true);
    return;
  }
  refreshSummaries();
  /* [v1.2.0] prefill ชื่อ-เบอร์จากบัญชีสมาชิก (ถ้าล็อกอินและช่องยังว่าง) */
  if (currentUser) {
    if (!$("custName").value.trim()) $("custName").value = currentUser.name;
    if (!$("custPhone").value.trim()) $("custPhone").value = currentUser.phone;
  }
  showStep("stepInfo");
});

/* ---------- Promo code ---------- */
$("applyPromoBtn").addEventListener("click", async () => {
  const code = $("promoCode").value.trim().toUpperCase();
  if (!code) {
    state.appliedPromo = null;
    refreshSummaries();
    showToast("ล้างโค้ดส่วนลดแล้ว");
    return;
  }
  try {
    const res = await fetch("/api/promos");
    const promos = await res.json();
    const found = promos.find((p) => p.code === code);
    if (!found) {
      state.appliedPromo = null;
      showToast("ไม่พบโค้ดนี้ หรือโค้ดหมดอายุ", true);
    } else {
      state.appliedPromo = found;
      showToast(`ใช้โค้ด ${found.code} ลด ${found.percent}% แล้ว`);
    }
  } catch {
    showToast("ตรวจสอบโค้ดไม่ได้ (โหมดออฟไลน์)", true);
  }
  refreshSummaries();
});

$("backToSeats").addEventListener("click", () => showStep("stepSeats"));

/* ช่องเบอร์โทร: กรอกได้เฉพาะตัวเลข สูงสุด 10 หลัก */
$("custPhone").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
});

$("confirmBtn").addEventListener("click", () => {
  const name = $("custName").value.trim();
  const phone = $("custPhone").value.trim();
  if (name.length < 3) { showToast("กรุณากรอกชื่อ–นามสกุลให้ครบถ้วน", true); return; }
  if (!/^0\d{8,9}$/.test(phone.replace(/[-\s]/g, ""))) {
    showToast("เบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)", true); return;
  }
  state.custName = name;
  state.custPhone = phone;
  state.custNote = $("custNote").value.trim();
  refreshSummaries();
  updatePayUI();
  showStep("stepPay");
});

/* ================= PROMPTPAY QR (มาตรฐาน Thai QR / EMVCo) ================= */
const PROMPTPAY_ID = "0996932881";            // เบอร์พร้อมเพย์ของเจ้าของระบบ (ถอดจาก QR กรุงไทย)
const PROMPTPAY_NAME = "นายอัฐวุฒิ มาตรสมบัติ"; // ชื่อบัญชีที่แสดงใต้ QR ให้ผู้จ่ายตรวจสอบ

function crc16ccitt(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function tlv(id, value) {
  return id + String(value.length).padStart(2, "0") + value;
}
function buildPromptPayPayload(id, amount, ref) {
  let target = null;
  if (/^\d{13}$/.test(id)) {
    target = tlv("02", id); // เลขบัตรประชาชน
  } else if (/^0\d{9,10}$/.test(id)) {
    target = tlv("01", "0066" + id.replace(/^0/, "")); // เบอร์โทร (+66)
  } else if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(id)) {
    target = tlv("03", id); // E-wallet ID
  } else {
    return null;
  }
  const merchantAccount = tlv("00", "A000000677010111") + target;
  let p = "";
  p += tlv("00", "01");                 // Payload Format Indicator
  p += tlv("01", "12");                 // Dynamic QR (มีจำนวนเงิน)
  p += tlv("29", merchantAccount);      // Merchant Account - PromptPay
  p += tlv("53", "764");                // สกุลเงิน THB
  if (amount > 0) p += tlv("54", amount.toFixed(2));
  p += tlv("58", "TH");                 // Country
  p += tlv("62", tlv("01", String(ref || "BUSGO").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "BUSGO"));   // Reference
  p += "6304";
  return p + crc16ccitt(p);
}
function renderPromptPayQR() {
  const box = $("qrImage");
  if (!box) return;
  box.innerHTML = "";
  const t = computeTotals();
  const amount = t.net;
  $("qrAmount").textContent = amount.toLocaleString();
  $("qrMerchant").textContent = PROMPTPAY_NAME;
  /* [v1.1.3] Reference field (TLV 62) = รหัสเที่ยวรถ + YYMMDD ของวันเดินทาง
     เพื่อให้ตรวจสอบรายการเงินเข้ากลับมาที่การจองได้ (จำกัด A-Z a-z 0-9, สูงสุด 25 ตัว) */
  const ref = `${t.bus.id}${String(state.currentDate || "").replace(/-/g, "").slice(2)}`;
  const payload = buildPromptPayPayload(PROMPTPAY_ID, amount, ref);
  if (!payload || typeof QRCode === "undefined") {
    box.innerHTML = '<span class="muted small">QR ไม่พร้อมใช้งาน (โหลดไลบรารีไม่สำเร็จ)</span>';
    return;
  }
  new QRCode(box, { text: payload, width: 168, height: 168, correctLevel: QRCode.CorrectLevel.M });
}
function renderTicketQR(code) {
  const box = $("tkQr");
  if (!box) return;
  box.innerHTML = "";
  if (typeof QRCode === "undefined") { box.textContent = code; return; }
  new QRCode(box, { text: code, width: 96, height: 96, correctLevel: QRCode.CorrectLevel.L });
}

/* ================= PAYMENT ---------- */
const PAY_LABELS = { promptpay: "QR PromptPay", card: "บัตรเครดิต / เดบิต", wallet: "e-Wallet" };
function selectedPayMethod() {
  const el = document.querySelector('input[name="payMethod"]:checked');
  return el ? el.value : "promptpay";
}
function updatePayUI() {
  const isPromptpay = selectedPayMethod() === "promptpay";
  $("qrBox").classList.toggle("hidden", !isPromptpay);
  if (isPromptpay) renderPromptPayQR();
}
document.querySelectorAll('input[name="payMethod"]').forEach((r) =>
  r.addEventListener("change", updatePayUI));
$("backToInfo").addEventListener("click", () => showStep("stepInfo"));

$("payNowBtn").addEventListener("click", async () => {
  const bus = findBus(state.currentBusId);
  const seats = [...state.selectedSeats].sort((a, b) => a - b);
  const payMethod = selectedPayMethod();
  const btn = $("payNowBtn");
  btn.disabled = true;
  btn.textContent = "กำลังชำระเงิน...";
  await new Promise((r) => setTimeout(r, 1200)); // จำลองการชำระเงิน

  const t = computeTotals();
  const payload = {
    busId: bus.id,
    date: state.currentDate,
    seats,
    name: state.custName,
    phone: state.custPhone,
    note: state.custNote,
    promoCode: state.appliedPromo ? state.appliedPromo.code : null,
    payMethod,
  };

  let booking = null;
  let serverConfirmed = false; // [v1.1.3] แยกกรณี "จองสำเร็จบนเซิร์ฟเวอร์จริง" กับ "บันทึกออฟไลน์"
  if (serverOnline) {
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "ไม่สามารถจองได้", true);
        btn.disabled = false;
        btn.textContent = "ชำระเงินและยืนยันการจอง";
        return;
      }
      booking = data.booking;
      serverConfirmed = true;
      bookings.unshift(booking);
    } catch {
      showToast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", true);
    }
  }
  if (!booking) {
    /* [v1.1.3] โหมดออฟไลน์ — เตือนชัดว่านี่เป็นการบันทึกในเครื่องเท่านั้น
       เซิร์ฟเวอร์ยังไม่รู้จักตั๋วนี้ ที่นั่งยังไม่ถูกล็อก และการชำระเงินยังไม่ถูกบันทึก */
    booking = {
      code: genCode(),
      busId: bus.id,
      date: state.currentDate,
      seats,
      name: state.custName,
      phone: state.custPhone,
      note: state.custNote,
      promoCode: state.appliedPromo ? state.appliedPromo.code : null,
      discount: t.discount,
      total: t.net,
      payMethod,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    bookings.unshift(booking);
  }
  addMyCode(booking.code);
  saveMirror();
  updateBadge();

  $("tkCode").textContent = booking.code;
  $("tkName").textContent = booking.name;
  $("tkRoute").textContent = `${bus.from} → ${bus.to}`;
  $("tkDateTime").textContent = `${fmtDate(booking.date)} · ${bus.depart}`;
  $("tkSeats").textContent = booking.seats.join(", ");
  $("tkPay").textContent = PAY_LABELS[booking.payMethod] || "—";
  renderTicketQR(booking.code);
  showStep("stepDone");
  /* [v1.1.3] ข้อความต้องตรงความจริง: server-confirmed = "ชำระเงินสำเร็จ"
     ส่วน offline = เตือนว่าเซิร์ฟเวอร์ยังไม่รับการจอง (ไม่ปลอมข้อความสำเร็จ) */
  if (serverConfirmed) {
    showToast("ชำระเงินสำเร็จ! ขอบคุณที่ใช้บริการ BusGo");
  } else {
    showToast("บันทึกในเครื่องชั่วคราวเท่านั้น — เซิร์ฟเวอร์ยังไม่รับการจองนี้ กรุณากลับมาออนไลน์แล้วยืนยันอีกครั้ง", true);
  }
  btn.disabled = false;
  btn.textContent = "ชำระเงินและยืนยันการจอง";
});

$("closeModal").addEventListener("click", () => { closeModal(); renderBuses(); });
$("doneClose").addEventListener("click", () => { closeModal(); renderBuses(); });
$("viewTicketsBtn").addEventListener("click", () => { closeModal(); switchTab("tickets"); });
/* [v1.4.0] แถบเมนูล่าง (มือถือ): ปุ่มค้นตั๋ว → เปิดแท็บตั๋ว + เลื่อนไปฟอร์มค้นหาตั๋วข้ามเครื่อง */
const tabbarLookupBtn = document.getElementById("tabbarLookup");
if (tabbarLookupBtn) tabbarLookupBtn.addEventListener("click", () => {
  switchTab("tickets");
  const card = document.querySelector(".ticket-lookup-card");
  if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => { const el = $("lookupCode"); if (el) el.focus({ preventScroll: true }); }, 400);
});
$("bookingModal").addEventListener("click", (e) => {
  if (e.target === $("bookingModal")) { closeModal(); renderBuses(); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("bookingModal").classList.contains("hidden")) {
    closeModal(); renderBuses();
  }
});

/* ================= MY TICKETS ================= */
function updateBadge() {
  const n = bookings.filter((b) => myCodes().includes(b.code) && (b.status === "active" || b.status === "checked_in")).length;
  const badge = $("ticketBadge");
  badge.textContent = n;
  badge.classList.toggle("hidden", n === 0);
  // [v1.4.0] sync badge บนแถบเมนูล่าง (มือถือ) ทุกตำแหน่ง
  document.querySelectorAll(".js-tab-badge").forEach((el) => {
    el.textContent = n;
    el.classList.toggle("hidden", n === 0);
  });
}

function renderTickets() {
  const mine = bookings.filter((bk) => myCodes().includes(bk.code)).map(withPii);
  const wrap = $("ticketList");
  const has = mine.length > 0;

  // แต้มสะสม: 1 แต้มทุก 100 บาท (นับจากตั๋ว active/checked_in ของตั๋วที่เราจอง)
  const pts = mine
    .filter((b) => b.status === "active" || b.status === "checked_in")
    .reduce((s, b) => s + Math.floor((b.total || 0) / 100), 0);
  const pb = $("pointsBar");
  pb.classList.toggle("hidden", pts === 0);
  if (pts > 0) {
    pb.innerHTML = `คะแนนสะสมของคุณ: <b>${pts} แต้ม</b> <span class="muted">(สะสม 1 แต้มทุกการจอง 100 ฿ แลกส่วนลดได้ในการจองครั้งถัดไป)</span>`;
  }

  $("ticketEmpty").classList.toggle("hidden", has);
  wrap.innerHTML = mine.map((bk, i) => {
    const bus = findBus(bk.busId);
    const route = bus ? `${bus.from} → ${bus.to}` : "(เส้นทางไม่พบ)";
    const depart = bus ? bus.depart : "—";
    const isActive = bk.status === "active";
    const isCheckedIn = bk.status === "checked_in";
    const isCancelled = bk.status === "cancelled";
    const statusCls = isCheckedIn ? "status-checkedin" : isActive ? "status-active" : "status-cancelled";
    const statusText = isCheckedIn ? "ขึ้นรถแล้ว" : isActive ? "ยืนยันแล้ว" : "ยกเลิกแล้ว";

    const passengerInfo = bk.name
      ? `ผู้โดยสาร: <b>${esc(bk.name)}</b>${bk.phone ? ` · โทร ${esc(bk.phone)}` : ""}<br />`
      : bk.phone
      ? `เบอร์โทรผู้จอง: <b>${esc(bk.phone)}</b><br />`
      : "";

    return `
    <article class="my-ticket ${isCancelled ? "cancelled" : isCheckedIn ? "checkedin" : ""}" style="animation-delay:${i * 0.06}s">
      <div class="tk-route">${esc(route)}</div>
      <div class="tk-info">
        รหัสตั๋ว: <b>${esc(bk.code)}</b><br />
        ${passengerInfo}วันที่: <b>${fmtDate(bk.date)}</b> · ออกรถ <b>${depart}</b><br />
        ที่นั่ง: <b>${bk.seats.join(", ")}</b> · ยอดรวม <b>฿${bk.total.toLocaleString()}</b>
        ${bk.checkedInAt ? `<br />เวลาขึ้นรถ: <b style="color:var(--accent)">${new Date(bk.checkedInAt).toLocaleTimeString("th-TH")} น.</b>` : ""}
        ${bk.note ? `<br />หมายเหตุ: ${esc(bk.note)}` : ""}
      </div>
      <div class="my-ticket-foot">
        <span class="status-pill ${statusCls}">
          ${statusText}
        </span>
        ${isActive ? `<button class="cancel-link" data-cancel="${esc(bk.code)}">ยกเลิกการจอง</button>` : isCheckedIn ? `<span class="muted small">พร้อมออกเดินทาง</span>` : "<span></span>"}
      </div>
    </article>`;
  }).join("");

  wrap.querySelectorAll("[data-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => cancelBooking(btn.dataset.cancel)));
}

async function searchTicketCrossDevice(e) {
  if (e) e.preventDefault();
  const codeInput = $("lookupCode");
  const phoneInput = $("lookupPhone");
  const btn = $("lookupBtn");
  if (!codeInput || !phoneInput || !btn) return;

  const code = codeInput.value.trim().toUpperCase();
  const phone = phoneInput.value.replace(/[-\s]/g, "");

  if (!code) {
    showToast("กรุณากรอกรหัสตั๋ว (เช่น BG-A1B2C3)", true);
    codeInput.focus();
    return;
  }
  if (!/^BG-[0-9A-F]{6,12}$/i.test(code)) {
    showToast("รูปแบบรหัสตั๋วไม่ถูกต้อง (ต้องขึ้นต้นด้วย BG- ตามด้วยรหัสตั๋ว)", true);
    codeInput.focus();
    return;
  }
  if (!phone) {
    showToast("กรุณากรอกเบอร์โทรศัพท์ที่ใช้จอง", true);
    phoneInput.focus();
    return;
  }
  if (!/^0\d{8,9}$/.test(phone)) {
    showToast("รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)", true);
    phoneInput.focus();
    return;
  }

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "กำลังค้นหา...";

  try {
    const res = await fetch(`/api/bookings/search?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 404) {
        showToast("ไม่พบข้อมูลตั๋ว หรือเบอร์โทรศัพท์ไม่ตรงกับข้อมูลการจอง", true);
      } else {
        showToast(data.error || "ค้นหาตั๋วไม่สำเร็จ", true);
      }
      return;
    }

    const ticketWithPhone = { ...data, phone };

    if (!myCodes().includes(data.code)) {
      addMyCode(data.code);
    }

    const existingIdx = bookings.findIndex((b) => b.code === data.code);
    if (existingIdx !== -1) {
      bookings[existingIdx] = { ...bookings[existingIdx], ...ticketWithPhone };
    } else {
      bookings.unshift(ticketWithPhone);
    }

    const mirror = loadMirror();
    const mIdx = mirror.findIndex((b) => b.code === data.code);
    if (mIdx !== -1) {
      mirror[mIdx] = { ...mirror[mIdx], ...ticketWithPhone };
    } else {
      mirror.unshift(ticketWithPhone);
    }
    try { localStorage.setItem(LS_MIRROR, JSON.stringify(mirror)); } catch {}

    updateBadge();
    renderTickets();
    showToast(`พบตั๋ว ${data.code} และเพิ่มเข้ารายการตั๋วของฉันแล้ว`);
    codeInput.value = "";
    phoneInput.value = "";
  } catch {
    showToast("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อค้นหาตั๋วได้", true);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

const lookupForm = $("lookupForm");
if (lookupForm) {
  lookupForm.addEventListener("submit", searchTicketCrossDevice);
}

async function cancelBooking(code) {
  let bk = bookings.find((b) => b.code === code) || loadMirror().find((b) => b.code === code);
  if (!bk || bk.status !== "active") return;
  if (!confirm(`ยืนยันการยกเลิกคิว ${code}?\nที่นั่ง ${bk.seats.join(", ")} จะถูกปล่อยให้ผู้โดยสารท่านอื่น`)) return;

  /* Server กำหนดให้ยืนยันเบอร์โทรผู้จอง (กันคนแปลกหน้ายกเลิกตั๋วคนอื่น)
     ถ้าเครื่องนี้จองเองข้อมูลจะมีอยู่แล้ว — ถ้าไม่มีให้กรอกเบอร์ยืนยัน */
  let phone = withPii(bk).phone;
  if (!phone) {
    phone = (prompt("ยืนยันเบอร์โทรศัพท์ผู้จอง:") || "").replace(/[-\s]/g, "");
    if (!phone) return;
  }

  if (serverOnline) {
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(code)}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      /* [v1.1.2 FIX] เดิมจับเฉพาะ 403 แต่ error อื่น (429 rate limit, 500 ฯลฯ)
         หลุดไปโค้ดด้านล่างแล้ว set สถานะ cancelled ในเครื่อง ทั้งที่เซิร์ฟเวอร์
         ไม่ได้ยอมรับการยกเลิก — ตอนนี้ทุก response ที่ไม่ ok ให้หยุดทันที
         และโชว์สาเหตุจริงจากเซิร์ฟเวอร์ */
      let data = {};
      try { data = await res.json(); } catch {}
      if (res.status === 403) { showToast("เบอร์โทรไม่ตรงกับผู้จอง — ยกเลิกไม่สำเร็จ", true); return; }
      if (!res.ok) { showToast(data.error || "ยกเลิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", true); return; }
    } catch {
      showToast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — สถานะจริงยังไม่ถูกยกเลิก กรุณาลองใหม่เมื่อออนไลน์", true);
    }
  }
  bk.status = "cancelled";
  bk.cancelledAt = new Date().toISOString();
  saveMirror();
  updateBadge();
  renderTickets();
  renderBuses();
  /* [v1.4.1 FIX] เดิม offline ก็โชว์ "ยกเลิกเรียบร้อย" ทั้งที่เซิร์ฟเวอร์ยังไม่รู้ —
     ตอนนี้แยกข้อความตามความจริงเหมือน flow ชำระเงิน (v1.1.3) */
  if (serverOnline) showToast("ยกเลิกการจองเรียบร้อยแล้ว");
  else showToast("บันทึกการยกเลิกในเครื่องชั่วคราว — เซิร์ฟเวอร์ยังไม่รับการยกเลิก กรุณาทำซ้ำเมื่อออนไลน์", true);
}

/* ================= AUTH UI WIRING (v1.2.0) ================= */
$("authBtn").addEventListener("click", () => openAuthModal("login"));
$("authClose").addEventListener("click", closeAuthModal);
$("authModal").addEventListener("click", (e) => {
  if (e.target === $("authModal")) closeAuthModal();
});
$("authTabLogin").addEventListener("click", () => switchAuthTab("login"));
$("authTabRegister").addEventListener("click", () => switchAuthTab("register"));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("authModal").classList.contains("hidden")) closeAuthModal();
});

$("authLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("loginSubmitBtn");
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ...";
  try {
    const d = await apiAuth("POST", "/api/auth/login", {
      name: $("liName").value.trim(),
      password: $("liPass").value,
    });
    setSessionToken(d.token);
    currentUser = d.user;
    closeAuthModal();
    $("liPass").value = "";
    updateAuthUI();
    await syncMineTickets();
    showToast(`ยินดีต้อนรับ ${d.user.name}`);
  } catch (err) {
    showToast(err.message || "เข้าสู่ระบบไม่สำเร็จ", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "เข้าสู่ระบบ";
  }
});

$("authRegisterForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = $("rgPhone").value.replace(/[-\s]/g, "");
  if (!/^0\d{8,9}$/.test(phone)) { showToast("เบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)", true); return; }
  const btn = $("registerSubmitBtn");
  btn.disabled = true;
  btn.textContent = "กำลังสมัครสมาชิก...";
  try {
    const d = await apiAuth("POST", "/api/auth/register", {
      name: $("rgName").value.trim(),
      password: $("rgPass").value,
      phone,
    });
    setSessionToken(d.token);
    currentUser = d.user;
    closeAuthModal();
    $("rgPass").value = "";
    updateAuthUI();
    await syncMineTickets();
    showToast(`สมัครสมาชิกสำเร็จ ยินดีต้อนรับ ${d.user.name}`);
  } catch (err) {
    showToast(err.message || "สมัครสมาชิกไม่สำเร็จ", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "สมัครสมาชิก";
  }
});

$("logoutBtn").addEventListener("click", async () => {
  const tok = getSessionToken();
  if (tok && serverOnline) {
    try { await apiAuth("POST", "/api/auth/logout"); } catch {}
  }
  setSessionToken("");
  currentUser = null;
  updateAuthUI();
  renderTickets();
  showToast("ออกจากระบบแล้ว");
});

/* ================= UPDATE NOTIFIER ================= */
const UPDATE_KEY = "busgo_loaded_version";
async function checkForUpdate(first = false) {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    const data = await res.json();

    // แสดงเลขเวอร์ชันล่าสุดที่ footer
    const tag = $("versionTag");
    if (tag) tag.textContent =
      `เวอร์ชัน V${data.semver} · build ${data.short} (${data.source === "render" ? "Render" : "Local"}) · ตรวจสอบล่าสุด ${new Date().toLocaleTimeString("th-TH")} · ล่าสุดแล้ว`;

    const loaded = sessionStorage.getItem(UPDATE_KEY);
    if (first) {
      sessionStorage.setItem(UPDATE_KEY, data.version);
      return;
    }
    if (loaded && loaded !== data.version) {
      $("updateFoot").textContent = `BUILD V${data.semver} (${data.short}) DETECTED ON SERVER`;
      $("updateOverlay").classList.remove("hidden");
    }
  } catch {
    const tag = $("versionTag");
    if (tag) tag.textContent = "ออฟไลน์ — ไม่สามารถตรวจสอบเวอร์ชันได้";
  }
}
$("updateReloadBtn").addEventListener("click", () => location.reload());
setInterval(checkForUpdate, 60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkForUpdate();
});

/* ================= THEME TOGGLE (v1.3.0) ================= */
const themeBtn = $("themeToggle");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("busgo_theme", next); } catch {}
  });
}

/* ================= INIT ================= */
initFilters();
initAuth().then(() => syncMineTickets());
loadData().then(() => {
  renderBuses();
  updateBadge();
  renderPopular();
  loadPromoStrip();
});
checkForUpdate(true);




