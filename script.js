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
  from: "", to: "", type: "",
  currentBusId: null,
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
function initFilters() {
  const fromSel = $("fromSelect"), toSel = $("toSelect");
  PROVINCES.forEach((p) => {
    fromSel.insertAdjacentHTML("beforeend", `<option value="${esc(p)}">${esc(p)}</option>`);
    toSel.insertAdjacentHTML("beforeend", `<option value="${esc(p)}">${esc(p)}</option>`);
  });
  $("dateInput").value = state.date;
  $("dateInput").min = new Date().toISOString().slice(0, 10);

  $("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.from = fromSel.value;
    state.to = toSel.value;
    state.type = $("typeSelect").value;
    const d = $("dateInput").value;
    if (!d) { showToast("กรุณาเลือกวันที่เดินทาง", true); return; }
    if (state.from && state.to && state.from === state.to) {
      showToast("ต้นทางและปลายทางต้องไม่ซ้ำกัน", true); return;
    }
    state.date = d;
    renderBuses();
  });

  $("swapBtn").addEventListener("click", () => {
    const tmp = fromSel.value;
    fromSel.value = toSel.value;
    toSel.value = tmp;
  });
}

/* ================= RENDER BUS LIST ================= */
function getFilteredBuses() {
  return BUSES.filter((b) =>
    (!state.from || b.from === state.from) &&
    (!state.to || b.to === state.to) &&
    (!state.type || b.type === state.type)
  );
}

function renderBuses() {
  const list = getFilteredBuses();
  const wrap = $("busList");
  $("emptyState").classList.toggle("hidden", list.length > 0);
  $("resultsCount").textContent = `พบ ${list.length} เที่ยวรถ · ${fmtDate(state.date)}`;
  $("resultsTitle").textContent =
    state.from || state.to
      ? `${state.from || "ทุกต้นทาง"} → ${state.to || "ทุกปลายทาง"}`
      : "ทุกเส้นทาง";

  wrap.innerHTML = list.map((bus, i) => {
    const info = TYPE_INFO[bus.type];
    const left = seatsLeftOf(bus, state.date);
    const total = info.seats;
    const pct = Math.round((left / total) * 100);
    return `
    <article class="bus-card" style="animation-delay:${i * 0.06}s">
      <div class="bus-card-top">
        <span class="route-name">${esc(bus.from)} → ${esc(bus.to)}</span>
        <span class="badge ${info.cls}">${info.label}</span>
      </div>
      <div class="time-row">
        <span class="time">${bus.depart}</span>
        <span class="arrow-line">${bus.duration}</span>
        <span class="time">${bus.arrive}</span>
      </div>
      <div class="muted small">รหัสเที่ยวรถ ${bus.id} · ${total} ที่นั่ง</div>
      <div class="seat-progress">
        <div class="bar"><div class="fill ${pct < 25 ? "low" : ""}" style="width:${pct}%"></div></div>
        <div class="seat-text">
          <span>ว่าง ${left} จาก ${total} ที่</span>
          <span>${pct}% ว่าง</span>
        </div>
      </div>
      <div class="bus-card-bottom">
        <div class="price">฿${bus.price.toLocaleString()} <small>/ ที่นั่ง</small></div>
        <button class="btn btn-primary" data-book="${bus.id}" ${left === 0 ? "disabled" : ""}>
          ${left === 0 ? "เต็มแล้ว" : "จองคิว"}
        </button>
      </div>
    </article>`;
  }).join("");

  wrap.querySelectorAll("[data-book]").forEach((btn) =>
    btn.addEventListener("click", () => openBooking(btn.dataset.book)));

  renderStats(list);
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
function openBooking(busId) {
  const bus = findBus(busId);
  if (!bus) return;
  state.currentBusId = busId;
  state.selectedSeats.clear();

  const info = TYPE_INFO[bus.type];
  $("modalRoute").textContent = `${bus.from} → ${bus.to}`;
  $("modalMeta").textContent =
    `${fmtDate(state.date)} · ออก ${bus.depart} ถึง ${bus.arrive} · ${info.label} (${info.seats} ที่นั่ง)`;

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
  ["stepSeats", "stepInfo", "stepDone"].forEach((id) =>
    $(id).classList.toggle("hidden", id !== stepId));
}

function renderSeatMap() {
  const bus = findBus(state.currentBusId);
  const total = TYPE_INFO[bus.type].seats;
  const occ = getOccupied(bus.id, state.date, total);
  getUserTaken(bus.id, state.date).forEach((s) => occ.add(s));
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
  if (state.selectedSeats.has(n)) state.selectedSeats.delete(n);
  else state.selectedSeats.add(n);
  const btn = document.querySelector(`.seat[data-seat="${n}"]`);
  if (btn) btn.classList.toggle("selected", state.selectedSeats.has(n));
  updateSummary();
}

function updateSummary() {
  const bus = findBus(state.currentBusId);
  const seats = [...state.selectedSeats].sort((a, b) => a - b);
  $("selCount").textContent = seats.length;
  $("selSeats").textContent = seats.length ? seats.join(", ") : "–";
  $("selTotal").textContent = (seats.length * bus.price).toLocaleString();
  $("toInfoBtn").disabled = seats.length === 0;
}

$("toInfoBtn").addEventListener("click", () => {
  const bus = findBus(state.currentBusId);
  const seats = [...state.selectedSeats].sort((a, b) => a - b);
  $("sumRoute").textContent = `${bus.from} → ${bus.to}`;
  $("sumDetail").textContent =
    `${fmtDate(state.date)} · ${bus.depart} · ที่นั่ง ${seats.join(", ")}`;
  $("sumTotal").textContent = (seats.length * bus.price).toLocaleString();
  showStep("stepInfo");
});

$("backToSeats").addEventListener("click", () => showStep("stepSeats"));

$("confirmBtn").addEventListener("click", async () => {
  const name = $("custName").value.trim();
  const phone = $("custPhone").value.trim();
  const note = $("custNote").value.trim();

  if (name.length < 3) { showToast("กรุณากรอกชื่อ–นามสกุลให้ครบถ้วน", true); return; }
  if (!/^0\d{8,9}$/.test(phone.replace(/[-\s]/g, ""))) {
    showToast("เบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)", true); return;
  }

  const bus = findBus(state.currentBusId);
  const payload = {
    busId: bus.id,
    date: state.date,
    seats: [...state.selectedSeats].sort((a, b) => a - b),
    name,
    phone,
    note,
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
      if (!res.ok) { showToast(data.error || "ไม่สามารถจองได้", true); return; }
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
      date: state.date,
      seats: payload.seats,
      name, phone, note,
      total: payload.seats.length * bus.price,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    bookings.unshift(booking);
  }
  addMyCode(booking.code);
  saveMirror();
  updateBadge();

  $("tkCode").textContent = booking.code;
  $("tkName").textContent = name;
  $("tkRoute").textContent = `${bus.from} → ${bus.to}`;
  $("tkDateTime").textContent = `${fmtDate(booking.date)} · ${bus.depart}`;
  $("tkSeats").textContent = booking.seats.join(", ");
  showStep("stepDone");
  showToast("จองคิวสำเร็จ! ขอบคุณที่ใช้บริการ BusGo");
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

/* ================= INIT ================= */
initFilters();
loadData().then(() => {
  renderBuses();
  updateBadge();
});




