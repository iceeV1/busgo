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
let bookings = [];
let serverOnline = false;
let state = {
  date: new Date().toISOString().slice(0, 10),
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

function myCodes() {
  try { return JSON.parse(localStorage.getItem(LS_MY) || "[]"); } catch { return []; }
}
function addMyCode(code) {
  const s = myCodes();
  s.unshift(code);
  localStorage.setItem(LS_MY, JSON.stringify(s.slice(0, 50)));
}
function saveMirror() {
  localStorage.setItem(LS_MIRROR, JSON.stringify(bookings));
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
function hashStr(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function getOccupied(busId, date, total) {
  const rnd = seededRand(hashStr(busId + "|" + date));
  const count = Math.floor(total * (0.2 + rnd() * 0.45));
  const set = new Set();
  while (set.size < count) set.add(1 + Math.floor(rnd() * total));
  return set;
}
function getUserTaken(busId, date) {
  const set = new Set();
  bookings.forEach((b) => {
    if (b.busId === busId && b.date === date && b.status === "active") {
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
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
  return "BG-" + Date.now().toString(36).toUpperCase().slice(-4) + "-" + Math.floor(Math.random() * 900 + 100);
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
  $("dateInput").min = new Date().toISOString().slice(0, 10);
  $("returnDateInput").min = state.date;

  // แท็บชนิดการเดินทาง
  document.querySelectorAll("#modeTabs .mode-tab").forEach((tb) =>
    tb.addEventListener("click", () => {
      document.querySelectorAll("#modeTabs .mode-tab").forEach((x) =>
        x.classList.toggle("active", x === tb));
      state.mode = tb.dataset.mode;
      renderBuses();
      renderPopular();
    }));

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
      : `ทุกเส้นทาง (${state.mode === "train" ? "รถไฟ" : state.mode === "ferry" ? "เรือเฟอร์รี่" : "รถบัส"})`;

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
  const activeTickets = bookings.filter((b) => b.status === "active").length;
  $("statsRow").innerHTML = `
    <span class="stat-chip"><b>${list.length}</b>เที่ยวรถที่พบ</span>
    <span class="stat-chip"><b>${totalLeft}</b>ที่นั่งว่าง</span>
    <span class="stat-chip"><b>${routes}</b>เส้นทางทั่วไทย</span>
    <span class="stat-chip"><b>${activeTickets}</b>คิวของคุณ</span>`;
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

  // layout: rows of [seat, seat, aisle, seat, seat] -> grid 5 cols
  let html = "";
  for (let n = 1; n <= total; n++) {
    html += `<button type="button" class="seat ${occ.has(n) ? "taken" : ""}" data-seat="${n}"
      ${occ.has(n) ? "disabled" : ""} aria-label="ที่นั่ง ${n}">${n}</button>`;
    if (n % 4 === 0 && n < total) html += `<span class="seat-aisle"></span>`;
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
const PROMPTPAY_ID = "0812345678";      // <-- เปลี่ยนเป็นเบอร์พร้อมเพย์ / เลขบัตรประชาชน 13 หลัก ของบัญชีรับเงินจริง
const PROMPTPAY_NAME = "BusGo Booking"; // ชื่อร้าน/บัญชีที่แสดงใต้ QR

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
function buildPromptPayPayload(id, amount) {
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
  p += tlv("62", tlv("01", "BUSGO"));   // Reference
  p += "6304";
  return p + crc16ccitt(p);
}
function renderPromptPayQR() {
  const box = $("qrImage");
  if (!box) return;
  box.innerHTML = "";
  const amount = computeTotals().net;
  $("qrAmount").textContent = amount.toLocaleString();
  $("qrMerchant").textContent = PROMPTPAY_NAME;
  const payload = buildPromptPayPayload(PROMPTPAY_ID, amount);
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
      bookings.unshift(booking);
    } catch {
      showToast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — บันทึกแบบออฟไลน์", true);
    }
  }
  if (!booking) {
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
  showToast("ชำระเงินสำเร็จ! ขอบคุณที่ใช้บริการ BusGo");
  btn.disabled = false;
  btn.textContent = "ชำระเงินและยืนยันการจอง";
});

$("closeModal").addEventListener("click", () => { closeModal(); renderBuses(); });
$("doneClose").addEventListener("click", () => { closeModal(); renderBuses(); });
$("viewTicketsBtn").addEventListener("click", () => { closeModal(); switchTab("tickets"); });
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
  const n = bookings.filter((b) => b.status === "active").length;
  const badge = $("ticketBadge");
  badge.textContent = n;
  badge.classList.toggle("hidden", n === 0);
}

function renderTickets() {
  const mine = bookings.filter((bk) => myCodes().includes(bk.code));
  const wrap = $("ticketList");
  const has = mine.length > 0;

  // แต้มสะสม: 1 แต้มทุก 100 บาท (นับจากตั๋ว active ของเบอร์โทรเดียวกัน)
  const phones = [...new Set(mine.map((b) => b.phone))];
  const pts = bookings
    .filter((b) => b.status === "active" && phones.includes(b.phone))
    .reduce((s, b) => s + Math.floor(b.total / 100), 0);
  const pb = $("pointsBar");
  pb.classList.toggle("hidden", pts === 0);
  if (pts > 0) {
    pb.innerHTML = `คะแนนสะสมของคุณ: <b>${pts} แต้ม</b> <span class="muted">(สะสม 1 แต้มทุกทุกการจอง 100 ฿ แลกส่วนลดได้ในการจองครั้งถัดไป)</span>`;
  }

  $("ticketEmpty").classList.toggle("hidden", has);
  wrap.innerHTML = mine.map((bk, i) => {
    const bus = findBus(bk.busId);
    const route = bus ? `${bus.from} → ${bus.to}` : "(เส้นทางไม่พบ)";
    const depart = bus ? bus.depart : "—";
    const active = bk.status === "active";
    return `
    <article class="my-ticket ${active ? "" : "cancelled"}" style="animation-delay:${i * 0.06}s">
      <div class="tk-route">${esc(route)}</div>
      <div class="tk-info">
        รหัสตั๋ว: <b>${esc(bk.code)}</b><br />
        ผู้โดยสาร: <b>${esc(bk.name)}</b> · โทร ${esc(bk.phone)}<br />
        วันที่: <b>${fmtDate(bk.date)}</b> · ออกรถ <b>${depart}</b><br />
        ที่นั่ง: <b>${bk.seats.join(", ")}</b> · ยอดรวม <b>฿${bk.total.toLocaleString()}</b>
        ${bk.note ? `<br />หมายเหตุ: ${esc(bk.note)}` : ""}
      </div>
      <div class="my-ticket-foot">
        <span class="status-pill ${active ? "status-active" : "status-cancelled"}">
          ${active ? "ยืนยันแล้ว" : "ยกเลิกแล้ว"}
        </span>
        ${active ? `<button class="cancel-link" data-cancel="${esc(bk.code)}">ยกเลิกการจอง</button>` : "<span></span>"}
      </div>
    </article>`;
  }).join("");

  wrap.querySelectorAll("[data-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => cancelBooking(btn.dataset.cancel)));
}

async function cancelBooking(code) {
  const bk = bookings.find((b) => b.code === code);
  if (!bk || bk.status !== "active") return;
  if (!confirm(`ยืนยันการยกเลิกคิว ${code}?\nที่นั่ง ${bk.seats.join(", ")} จะถูกปล่อยให้ผู้โดยสารท่านอื่น`)) return;

  bk.status = "cancelled";
  bk.cancelledAt = new Date().toISOString();

  if (serverOnline) {
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(code)}/cancel`, { method: "PATCH" });
      if (!res.ok) throw new Error();
    } catch {
      showToast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ยกเลิกในเครื่องชั่วคราว", true);
    }
  }
  saveMirror();
  updateBadge();
  renderTickets();
  renderBuses();
  showToast("ยกเลิกการจองเรียบร้อยแล้ว");
}

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

/* ================= INIT ================= */
initFilters();
loadData().then(() => {
  renderBuses();
  updateBadge();
  renderPopular();
  loadPromoStrip();
});
checkForUpdate(true);




