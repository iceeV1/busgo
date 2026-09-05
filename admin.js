"use strict";

/* ================= HELPERS ================= */
const $ = (id) => document.getElementById(id);
const esc = (t) => (t == null ? "" : String(t)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPE_INFO = { vip: { label: "VIP", seats: 32, cls: "badge-vip" }, air: { label: "ปรับอากาศ", seats: 44, cls: "badge-air" }, eco: { label: "ธรรมดา", seats: 48, cls: "badge-eco" } };

function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast" + (isError ? " error" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 2800);
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/* ================= CUSTOM 24H TIME PICKER ================= */
/* แทน <input type="time"> เดิม เพราะเบราว์เซอร์แสดง AM/PM ตาม locale ของเครื่อง
   ค่าจริงรูปแบบ "HH:MM" เก็บใน hidden input ตาม id ที่ระบุใน data-time */
function pad2(n) { return String(n).padStart(2, "0"); }
function initTimeFields() {
  document.querySelectorAll(".time-field").forEach((tf) => {
    const hiddenId = tf.dataset.time;
    const hSel = tf.querySelector(".tf-hour");
    const mSel = tf.querySelector(".tf-min");
    for (let h = 0; h < 24; h++) hSel.add(new Option(pad2(h), pad2(h)));
    /* [v1.1.3] นาทีเลือกได้ทุกนาที (เดิม step 5 นาที ทำให้เวลาที่ไม่ใช่เศษ 5
       เช่น 08:03 ถูกปัดเป็น 08:00 เงียบๆ เมื่อแก้ไขแล้ว save) */
    for (let m = 0; m < 60; m++) mSel.add(new Option(pad2(m), pad2(m)));
    const sync = () => { $(hiddenId).value = hSel.value + ":" + mSel.value; updateDuration(); };
    hSel.addEventListener("change", sync);
    mSel.addEventListener("change", sync);
  });
}
function setTimeValue(hiddenId, val) {
  const tf = document.querySelector(`.time-field[data-time="${hiddenId}"]`);
  if (!tf) return;
  const [hh, mm] = String(val || "08:00").split(":");
  tf.querySelector(".tf-hour").value = pad2(Number(hh) || 0);
  tf.querySelector(".tf-min").value = mm && Number(mm) >= 0 && Number(mm) <= 59 ? pad2(Number(mm)) : "00";
  $(hiddenId).value = tf.querySelector(".tf-hour").value + ":" + tf.querySelector(".tf-min").value;
  updateDuration();
}

/* คำนวณระยะเวลาจากเวลาออก/เวลาถึง (ถึงก่อนออก = ข้ามวัน) */
function updateDuration() {
  const dep = $("fDepart").value, arr = $("fArrive").value;
  if (!dep || !arr || !dep.includes(":") || !arr.includes(":")) return;
  const [dh, dm] = dep.split(":").map(Number);
  const [ah, am] = arr.split(":").map(Number);
  let mins = (ah * 60 + am) - (dh * 60 + dm);
  if (mins <= 0) mins += 1440; /* เวลาถึงไม่หลังเวลาออก → นับเป็นวันถัดไป */
  const h = Math.floor(mins / 60), m = mins % 60;
  $("fDuration").value = h > 0 ? `${h} ชม.${m ? ` ${m} นาที` : ""}` : `${m} นาที`;
}

initTimeFields();
setTimeValue("fDepart", "08:00");
setTimeValue("fArrive", "12:00");

/* ================= STATE / API ================= */
/* [v1.2.0] KEY ตอนนี้เก็บ admin session token (จาก POST /api/admin/login)
   remember me -> localStorage (30 วัน) ปกติ -> sessionStorage (8 ชม.) */
let KEY = sessionStorage.getItem("bg_admin_session") || localStorage.getItem("bg_admin_session") || "";
try { sessionStorage.removeItem("bg_admin_key"); } catch {}
try { localStorage.removeItem("bg_admin_key"); } catch {}
let buses = [];
let bookings = [];
let promos = [];
let editingBusId = null;
let activeInspectedCode = null;

async function api(path, opts = {}) {
  const r = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", "x-session": KEY },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let d = {};
  try { d = await r.json(); } catch {}
  if (r.status === 401) {
    /* session หมดอายุ/ไม่ถูกต้อง — ล้างแล้วให้ล็อกอินใหม่ */
    KEY = "";
    try { sessionStorage.removeItem("bg_admin_session"); localStorage.removeItem("bg_admin_session"); } catch {}
    showLogin(true);
    throw new Error(d.error || "ไม่ได้รับอนุญาต");
  }
  if (!r.ok) throw new Error(d.error || "เกิดข้อผิดพลาด");
  return d;
}

/* ================= LOGIN ================= */
/* ================= LOGIN ================= */
function setLoginError(msg) {
  const el = $("loginError");
  if (!el) return;
  if (!msg) {
    el.classList.add("hidden");
    el.textContent = "";
  } else {
    el.classList.remove("hidden");
    el.textContent = msg;
  }
}

function showLogin(show) {
  const ov = $("loginOverlay");
  if (ov) ov.style.display = show ? "flex" : "none";
  if (show) {
    setLoginError("");
    setTimeout(() => $("adminPass")?.focus(), 80);
  }
}

const passToggle = $("toggleAdminPassBtn");
const passInput = $("adminPass");
if (passToggle && passInput) {
  passToggle.addEventListener("click", () => {
    const isPass = passInput.type === "password";
    passInput.type = isPass ? "text" : "password";
    passToggle.style.color = isPass ? "var(--primary)" : "var(--muted)";
  });
}
if (passInput) {
  passInput.addEventListener("input", () => setLoginError(""));
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pass = $("adminPass").value.trim();
  const remember = $("rememberMe") && $("rememberMe").checked;
  const btn = $("adminLoginBtn");
  const originalBtnHtml = btn ? btn.innerHTML : "";

  if (!pass) {
    setLoginError("กรุณากรอกรหัสผ่านผู้ดูแลระบบ (สำหรับเครื่อง Local คือ admin1234)");
    toast("กรุณากรอกรหัสผ่านผู้ดูแลระบบ", true);
    $("adminPass")?.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>กำลังเข้าสู่ระบบ...</span>`;
  }

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: pass, remember }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "รหัสผ่านไม่ถูกต้อง");
    KEY = d.token;
    sessionStorage.setItem("bg_admin_session", KEY);
    if (remember) localStorage.setItem("bg_admin_session", KEY);
    else localStorage.removeItem("bg_admin_session");
    $("adminPass").value = "";
    setLoginError("");
    showLogin(false);
    toast("เข้าสู่ระบบสำเร็จ");
  } catch (err) {
    setLoginError(err.message || "รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
    toast(err.message || "เข้าสู่ระบบไม่สำเร็จ", true);
    $("adminPass")?.focus();
    return;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml;
    }
  }
  /* โหลดข้อมูลหลังบ้านแยกออกจาก login — ถ้า refresh ล้มเหลวจะไม่กระทบสถานะ login */
  try { await refresh(); } catch { toast("โหลดข้อมูลล้มเหลว กดรีเฟรชอีกครั้ง", true); }
});
$("logoutBtn").addEventListener("click", async () => {
  if (KEY) {
    try { await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", "x-session": KEY }, body: "{}" }); } catch {}
  }
  KEY = "";
  try {
    sessionStorage.removeItem("bg_admin_session");
    localStorage.removeItem("bg_admin_session");
  } catch {}
  showLogin(true);
});

/* ================= TABS ================= */
document.querySelectorAll(".admin-tabs .nav-link").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tabs .nav-link").forEach((b) =>
      b.classList.toggle("active", b === btn));
    ["dash", "checkin", "bookings", "buses", "promos"].forEach((id) =>
      $("tab-" + id).classList.toggle("hidden", id !== btn.dataset.tab));
    if (btn.dataset.tab === "checkin") {
      renderCheckinLogs();
      const inp = $("ciInput");
      if (inp) inp.focus();
    }
  })
);

/* [v1.4.1] วันที่วันนี้ตามเวลาเครื่อง (ไทย) — เดิมใช้ toISOString().slice(0,10) ซึ่งเป็น UTC
   ทำให้สถิติ "วันนี้" ผิดช่วงเวลาไทย 00:00-06:59 น. (นับเป็นวันเมื่อวาน) */
function localToday() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* ================= DASHBOARD ================= */
function renderDash() {
  const activeOrChecked = bookings.filter((b) => b.status === "active" || b.status === "checked_in");
  const checkedIn = bookings.filter((b) => b.status === "checked_in");
  const revenue = activeOrChecked.reduce((s, b) => s + b.total, 0);
  const today = localToday();
  const todayBookings = bookings.filter((b) => b.date === today && (b.status === "active" || b.status === "checked_in"));
  const todayChecked = bookings.filter((b) => b.date === today && b.status === "checked_in");

  $("statCards").innerHTML = `
    <div class="stat-card hl">
      <div class="sc-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <div class="sc-value">${bookings.length}</div>
      <div class="sc-label">การจองทั้งหมด</div>
    </div>
    <div class="stat-card green">
      <div class="sc-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <div class="sc-value">${activeOrChecked.length}</div>
      <div class="sc-label">ตั๋วที่ใช้งานได้ (ยืนยัน/ขึ้นรถ)</div>
    </div>
    <div class="stat-card purple">
      <div class="sc-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
      </div>
      <div class="sc-value">${checkedIn.length}</div>
      <div class="sc-label">เช็คอินขึ้นรถแล้ว</div>
    </div>
    <div class="stat-card gold">
      <div class="sc-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg>
      </div>
      <div class="sc-value">฿${revenue.toLocaleString()}</div>
      <div class="sc-label">รายได้รวม</div>
    </div>
    <div class="stat-card">
      <div class="sc-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="15" rx="3"/><path d="M3 10h18M7 19v2M17 19v2M7 15h.01M17 15h.01"/></svg>
      </div>
      <div class="sc-value">${buses.length}</div>
      <div class="sc-label">เที่ยวรถในระบบ</div>
    </div>
    <div class="stat-card">
      <div class="sc-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="sc-value">${todayChecked.length}/${todayBookings.length}</div>
      <div class="sc-label">เช็คอินวันนี้ / ตั๋ววันนี้</div>
    </div>`;

  // เส้นทางยอดนิยม
  const byRoute = {};
  activeOrChecked.forEach((b) => {
    const bus = buses.find((x) => x.id === b.busId);
    const key = bus ? `${bus.from} → ${bus.to}` : "(ไม่พบเส้นทาง)";
    byRoute[key] = (byRoute[key] || 0) + b.seats.length;
  });
  const rows = Object.entries(byRoute).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = rows.length ? rows[0][1] : 1;
  $("routeBars").innerHTML = rows.length
    ? rows.map(([route, n]) => `
      <div class="route-bar">
        <div class="rb-head"><span>${esc(route)}</span><span><b>${n}</b> ตั๋ว</span></div>
        <div class="rb-track"><div class="rb-fill" style="width:${Math.round((n / max) * 100)}%"></div></div>
      </div>`).join("")
    : `<p class="muted">ยังไม่มีข้อมูลการจอง</p>`;
}

/* ================= CHECK-IN / SCANNER ================= */
function inspectTicket(code) {
  const q = String(code || "").trim().toUpperCase();
  if (!q) return;
  activeInspectedCode = q;

  const bk = bookings.find((b) => b.code === q);
  const card = $("ciResultCard");
  if (!card) return;

  if (!bk) {
    card.classList.remove("hidden");
    card.innerHTML = `
      <div class="ci-empty">
        <div class="ci-status-badge status-cancelled">ไม่พบรหัสตั๋ว ${esc(q)}</div>
        <p class="muted small" style="margin:10px 0 0">กรุณาตรวจสอบความถูกต้องของรหัสตั๋ว หรือเช็คในแท็บ "การจอง"</p>
      </div>`;
    return;
  }

  const bus = buses.find((b) => b.id === bk.busId);
  const route = bus ? `${bus.from} → ${bus.to}` : "(ไม่พบเส้นทาง)";
  const depart = bus ? bus.depart : "—";
  const statusCls = bk.status === "checked_in" ? "status-checkedin" : bk.status === "active" ? "status-active" : "status-cancelled";
  const statusLabel = bk.status === "checked_in" ? "ขึ้นรถแล้ว (เช็คอินแล้ว)" : bk.status === "active" ? "พร้อมเช็คอิน (ยังไม่ขึ้นรถ)" : "ยกเลิกแล้ว";

  card.classList.remove("hidden");
  card.innerHTML = `
    <div class="ci-card-inner">
      <div class="ci-card-head">
        <div>
          <span class="ci-code">${esc(bk.code)}</span>
          <span class="status-pill ${statusCls}" style="margin-left:10px">${statusLabel}</span>
        </div>
        ${bk.checkedInAt ? `<span class="muted small">เวลาเช็คอิน: <b>${new Date(bk.checkedInAt).toLocaleTimeString("th-TH")}</b> (${fmtDate(bk.checkedInAt.slice(0, 10))})</span>` : ""}
      </div>
      <div class="ci-grid">
        <div><small class="muted">ผู้โดยสาร</small><br /><b>${esc(bk.name)}</b> (โทร ${esc(bk.phone)})</div>
        <div><small class="muted">เส้นทาง / รอบรถ</small><br /><b>${esc(route)}</b> (${bus ? TYPE_INFO[bus.type]?.label || bus.type : "—"})</div>
        <div><small class="muted">วันที่ / เวลาออก</small><br /><b>${fmtDate(bk.date)}</b> · ออก <b>${depart}</b></div>
        <div><small class="muted">ที่นั่ง</small><br /><b class="ci-seats">${bk.seats.join(", ")}</b> (${bk.seats.length} ที่นั่ง)</div>
        <div><small class="muted">ยอดชำระ</small><br /><b>฿${Number(bk.total).toLocaleString()}</b> (${bk.payMethod || "—"})</div>
        ${bk.note ? `<div><small class="muted">หมายเหตุ</small><br />${esc(bk.note)}</div>` : "<div></div>"}
      </div>
      <div class="ci-actions">
        ${bk.status === "active"
          ? `<button class="btn btn-primary ci-main-btn" data-do-checkin="${esc(bk.code)}">ยืนยันเช็คอินขึ้นรถ</button>`
          : bk.status === "checked_in"
          ? `<button class="btn btn-ghost ci-undo-btn" data-undo-checkin="${esc(bk.code)}">ยกเลิกสถานะเช็คอิน (Undo)</button>`
          : `<span class="muted small">ตั๋วถูกยกเลิก ไม่สามารถเช็คอินได้</span>`
        }
      </div>
    </div>`;

  const doBtn = card.querySelector("[data-do-checkin]");
  if (doBtn) {
    doBtn.addEventListener("click", () => handleCheckin(bk.code));
  }
  const undoBtn = card.querySelector("[data-undo-checkin]");
  if (undoBtn) {
    undoBtn.addEventListener("click", () => handleUndoCheckin(bk.code));
  }
}

async function handleCheckin(code) {
  try {
    const res = await api(`/api/bookings/${encodeURIComponent(code)}/checkin`, { method: "PATCH" });
    toast(`เช็คอินตั๋ว ${code} สำเร็จ`);
    await refresh();
    inspectTicket(code);
    const inp = $("ciInput");
    if (inp) { inp.value = ""; inp.focus(); }
  } catch (e) {
    toast(e.message || "เช็คอินไม่สำเร็จ", true);
  }
}

async function handleUndoCheckin(code) {
  if (!confirm(`ต้องการยกเลิกสถานะเช็คอินของตั๋ว ${code} ใช่หรือไม่?`)) return;
  try {
    const res = await api(`/api/bookings/${encodeURIComponent(code)}/uncheckin`, { method: "PATCH" });
    toast(`ยกเลิกสถานะเช็คอิน ${code} แล้ว`);
    await refresh();
    inspectTicket(code);
  } catch (e) {
    toast(e.message || "ไม่สามารถยกเลิกสถานะได้", true);
  }
}

function renderCheckinLogs() {
  const today = localToday();
  const checkedInList = bookings
    .filter((b) => b.status === "checked_in")
    .sort((a, b) => (b.checkedInAt || "").localeCompare(a.checkedInAt || ""));

  const todayChecked = checkedInList.filter((b) => b.date === today);
  const todayTotalActive = bookings.filter((b) => b.date === today && (b.status === "active" || b.status === "checked_in"));

  const statsEl = $("ciStatsToday");
  if (statsEl) {
    const pct = todayTotalActive.length ? Math.round((todayChecked.length / todayTotalActive.length) * 100) : 0;
    statsEl.textContent = `เช็คอินวันนี้แล้ว ${todayChecked.length} / ${todayTotalActive.length} ตั๋ว (${pct}%)`;
  }

  const table = $("ciLogTable");
  if (!table) return;

  table.innerHTML = `
    <thead><tr>
      <th>เวลาเช็คอิน</th><th>รหัสตั๋ว</th><th>เส้นทาง</th><th>รอบรถ</th>
      <th>ผู้โดยสาร</th><th>ที่นั่ง</th><th>สถานะ</th><th>จัดการ</th>
    </tr></thead>
    <tbody>${checkedInList.length ? checkedInList.slice(0, 20).map((bk) => {
      const bus = buses.find((x) => x.id === bk.busId);
      const route = bus ? `${bus.from} → ${bus.to}` : "(ไม่พบเส้นทาง)";
      const timeStr = bk.checkedInAt ? new Date(bk.checkedInAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
      return `<tr>
        <td><b>${timeStr}</b><br /><span class="muted small">${fmtDate(bk.date)}</span></td>
        <td class="cell-code"><button type="button" class="link-btn" data-view-code="${esc(bk.code)}">${esc(bk.code)}</button></td>
        <td>${esc(route)}</td>
        <td>${bus ? bus.depart : "—"}</td>
        <td>${esc(bk.name)}<br /><span class="muted small">${esc(bk.phone)}</span></td>
        <td>${bk.seats.join(", ")}</td>
        <td><span class="status-pill status-checkedin">ขึ้นรถแล้ว</span></td>
        <td>
          <button class="btn-sm btn-ghosty" data-log-undo="${esc(bk.code)}">ยกเลิกเช็คอิน</button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="8" style="text-align:center;padding:34px;color:var(--muted)">ยังไม่มีประวัติการเช็คอิน</td></tr>`}</tbody>`;

  table.querySelectorAll("[data-log-undo]").forEach((btn) =>
    btn.addEventListener("click", () => handleUndoCheckin(btn.dataset.logUndo)));

  table.querySelectorAll("[data-view-code]").forEach((btn) =>
    btn.addEventListener("click", () => {
      $("ciInput").value = btn.dataset.viewCode;
      inspectTicket(btn.dataset.viewCode);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }));
}

const ciForm = $("checkinForm");
if (ciForm) {
  ciForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = $("ciInput").value.trim();
    if (val) inspectTicket(val);
  });
}

/* ================= BOOKINGS TABLE ================= */
function getFilteredBookings() {
  const q = $("bkSearch").value.trim().toLowerCase();
  const date = $("bkDate").value;
  const status = $("bkStatus").value;
  return bookings.filter((b) => {
    if (date && b.date !== date) return false;
    if (status && b.status !== status) return false;
    if (q && ![b.code, b.name, b.phone].some((v) => String(v).toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderBookings() {
  const list = getFilteredBookings();
  $("bkTable").innerHTML = `
    <thead><tr>
      <th>รหัสตั๋ว</th><th>เส้นทาง</th><th>วันที่</th><th>เวลา</th>
      <th>ผู้โดยสาร</th><th>ที่นั่ง</th><th>ยอดเงิน</th><th>สถานะ</th><th>จัดการ</th>
    </tr></thead>
    <tbody>${list.length ? list.map((bk) => {
      const bus = buses.find((x) => x.id === bk.busId);
      const route = bus ? `${bus.from} → ${bus.to}` : "(ไม่พบเส้นทาง)";
      const isCancelled = bk.status === "cancelled";
      const isCheckedIn = bk.status === "checked_in";
      const isActive = bk.status === "active";
      const statusCls = isCheckedIn ? "status-checkedin" : isActive ? "status-active" : "status-cancelled";
      const statusText = isCheckedIn ? "ขึ้นรถแล้ว" : isActive ? "ยืนยันแล้ว" : "ยกเลิก";

      return `<tr class="${isCancelled ? "cancelled-row" : ""}">
        <td class="cell-code">${esc(bk.code)}</td>
        <td>${esc(route)}</td>
        <td>${fmtDate(bk.date)}</td>
        <td>${bus ? bus.depart : "—"}</td>
        <td>${esc(bk.name)}<br /><span class="muted small">${esc(bk.phone)}</span></td>
        <td>${bk.seats.join(", ")}</td>
        <td><b>฿${bk.total.toLocaleString()}</b></td>
        <td><span class="status-pill ${statusCls}">${statusText}</span></td>
        <td><div class="actions">
          ${isActive ? `<button class="btn-sm btn-primary" data-ci="${esc(bk.code)}">เช็คอิน</button>` : ""}
          ${isCheckedIn ? `<button class="btn-sm btn-ghosty" data-unci="${esc(bk.code)}">ยกเลิกเช็คอิน</button>` : ""}
          ${isActive ? `<button class="btn-sm btn-warn" data-cancel="${esc(bk.code)}">ยกเลิก</button>` : ""}
          <button class="btn-sm btn-danger" data-del="${esc(bk.code)}">ลบ</button>
        </div></td>
      </tr>`;
    }).join("") : `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">ไม่พบรายการจอง</td></tr>`}</tbody>`;

  $("bkTable").querySelectorAll("[data-ci]").forEach((b) =>
    b.addEventListener("click", () => handleCheckin(b.dataset.ci)));
  $("bkTable").querySelectorAll("[data-unci]").forEach((b) =>
    b.addEventListener("click", () => handleUndoCheckin(b.dataset.unci)));
  $("bkTable").querySelectorAll("[data-cancel]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(`ยืนยันการยกเลิกตั๋ว ${b.dataset.cancel}?`)) return;
      try { await api(`/api/bookings/${encodeURIComponent(b.dataset.cancel)}/cancel`, { method: "PATCH" }); toast("ยกเลิกตั๋วแล้ว"); refresh(); }
      catch (e) { toast(e.message, true); }
    }));
  $("bkTable").querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(`ลบตั๋ว ${b.dataset.del} ถาวรออกจากระบบ?`)) return;
      try { await api(`/api/bookings/${encodeURIComponent(b.dataset.del)}`, { method: "DELETE" }); toast("ลบรายการแล้ว"); refresh(); }
      catch (e) { toast(e.message, true); }
    }));
}
["bkSearch", "bkDate", "bkStatus"].forEach((id) => $(id).addEventListener("input", renderBookings));
$("bkRefresh").addEventListener("click", () => { refresh(); toast("รีเฟรชข้อมูลแล้ว"); });

$("csvBtn").addEventListener("click", () => {
  const head = ["รหัสตั๋ว", "ต้นทาง", "ปลายทาง", "วันเดินทาง", "เวลาออก", "ชื่อผู้โดยสาร", "เบอร์โทร", "ที่นั่ง", "ยอดเงิน (บาท)", "สถานะ", "เวลาเช็คอิน"];
  const lines = [head.join(",")];
  /* [v1.4.1 SEC FIX] กัน CSV/Excel Formula Injection — ชื่อผู้จองเป็นข้อมูลที่คนแปลกหน้ากรอกเองได้ */
  const safeCell = (v) => /^[=+\-@\t\r]/.test(String(v)) ? "'" + v : v;
  getFilteredBookings().forEach((bk) => {
    const bus = buses.find((x) => x.id === bk.busId) || {};
    const statusText = bk.status === "checked_in" ? "ขึ้นรถแล้ว" : bk.status === "active" ? "ยืนยันแล้ว" : "ยกเลิกแล้ว";
    lines.push([
      safeCell(bk.code),
      safeCell(bus.from || ""),
      safeCell(bus.to || ""),
      bk.date,
      bus.depart || "",
      `"${safeCell((bk.name || "").replace(/"/g, '""'))}"`,
      safeCell(bk.phone || ""),
      `"${bk.seats.join(" ")}"`,
      bk.total,
      statusText,
      bk.checkedInAt ? new Date(bk.checkedInAt).toLocaleString("th-TH") : ""
    ].join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `busgo_passenger_manifest_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("ส่งออกรายชื่อผู้โดยสาร (CSV) เรียบร้อยแล้ว");
});

const salesBtn = $("salesSummaryCsvBtn");
if (salesBtn) {
  salesBtn.addEventListener("click", () => {
    const head = ["รหัสเที่ยวรถ", "เส้นทาง", "เวลาออกเดินทาง", "ประเภทรถ", "ราคาตั๋ว", "จำนวนที่นั่งที่ขายได้", "ยอดขายรวม (บาท)", "ขึ้นรถแล้ว (คน)", "ยกเลิก (คน)"];
    const lines = [head.join(",")];

    buses.forEach((bus) => {
      const bks = bookings.filter((b) => b.busId === bus.id);
      const activeBks = bks.filter((b) => b.status === "active" || b.status === "checked_in");
      const checkedInBks = bks.filter((b) => b.status === "checked_in");
      const cancelBks = bks.filter((b) => b.status === "cancelled");

      const seatsSold = activeBks.reduce((s, b) => s + (b.seats ? b.seats.length : 0), 0);
      const totalRev = activeBks.reduce((s, b) => s + (b.total || 0), 0);

      lines.push([
        bus.id,
        `"${bus.from} - ${bus.to}"`,
        bus.depart,
        bus.type,
        bus.price,
        seatsSold,
        totalRev,
        checkedInBks.length,
        cancelBks.length
      ].join(","));
    });

    const totalRevenueAll = bookings
      .filter((b) => b.status === "active" || b.status === "checked_in")
      .reduce((s, b) => s + (b.total || 0), 0);
    lines.push([]);
    lines.push(["", "", "", "", "ยอดรวมทั้งระบบ", "", totalRevenueAll, "", ""].join(","));

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `busgo_sales_summary_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("ส่งออกรายงานสรุปยอดขาย (CSV) เรียบร้อยแล้ว");
  });
}

/* ================= BUSES MANAGEMENT ================= */
function renderBuses() {
  $("busTable").innerHTML = `
    <thead><tr>
      <th>รหัส</th><th>เส้นทาง</th><th>ออก–ถึง</th><th>ระยะเวลา</th>
      <th>ประเภท</th><th>ราคา</th><th>จัดการ</th>
    </tr></thead>
    <tbody>${buses.length ? buses.map((bus) => {
      const info = TYPE_INFO[bus.type] || {};
      const seats = bus.seats || info.seats || 0;
      return `<tr>
        <td class="cell-code">${esc(bus.id)}</td>
        <td>${esc(bus.from)} → ${esc(bus.to)}</td>
        <td>${bus.depart} – ${bus.arrive}</td>
        <td>${esc(bus.duration)}</td>
        <td><span class="badge ${info.cls || ""}">${info.label || bus.type}</span> <span class="muted small">${seats} ที่</span></td>
        <td><b>฿${Number(bus.price).toLocaleString()}</b></td>
        <td><div class="actions">
          <button class="btn-sm btn-ghosty" data-edit="${esc(bus.id)}">แก้ไข</button>
          <button class="btn-sm btn-danger" data-dbus="${esc(bus.id)}">ลบ</button>
        </div></td>
      </tr>`;
    }).join("") : `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted)">ไม่มีเที่ยวรถ</td></tr>`}</tbody>`;

  $("busTable").querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openBusForm(b.dataset.edit)));
  $("busTable").querySelectorAll("[data-dbus]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(`ลบเที่ยวรถ ${b.dataset.dbus}? (การจองเก่าจะยังคงอยู่)`)) return;
      try { await api(`/api/buses/${encodeURIComponent(b.dataset.dbus)}`, { method: "DELETE" }); toast("ลบเที่ยวรถแล้ว"); refresh(); }
      catch (e) { toast(e.message, true); }
    }));
}

function openBusForm(editId) {
  editingBusId = editId || null;
  $("busFormTitle").textContent = editId ? `แก้ไขเที่ยวรถ ${editId}` : "เพิ่มเที่ยวรถ";
  if (editId) {
    const bus = buses.find((x) => x.id === editId);
    if (!bus) return;
    $("fFrom").value = bus.from; $("fTo").value = bus.to;
    setTimeValue("fDepart", bus.depart); setTimeValue("fArrive", bus.arrive);
    $("fDuration").value = bus.duration; $("fType").value = bus.type;
    $("fPrice").value = bus.price;
  } else {
    $("busForm").reset();
    setTimeValue("fDepart", "08:00"); setTimeValue("fArrive", "12:00");
  }
  $("busModal").classList.remove("hidden");
}

$("addBusBtn").addEventListener("click", () => openBusForm(null));
$("busClose").addEventListener("click", () => $("busModal").classList.add("hidden"));
$("busModal").addEventListener("click", (e) => {
  if (e.target === $("busModal")) $("busModal").classList.add("hidden");
});

$("busSave").addEventListener("click", async () => {
  const body = {
    from: $("fFrom").value, to: $("fTo").value,
    depart: $("fDepart").value, arrive: $("fArrive").value,
    duration: $("fDuration").value, type: $("fType").value,
    mode: "bus",
    price: Number($("fPrice").value),
  };
  try {
    if (editingBusId) await api(`/api/buses/${encodeURIComponent(editingBusId)}`, { method: "PUT", body });
    else await api("/api/buses", { method: "POST", body });
    toast(editingBusId ? "บันทึกการแก้ไขแล้ว" : "เพิ่มเที่ยวรถใหม่แล้ว");
    $("busModal").classList.add("hidden");
    refresh();
  } catch (e) {
    toast(e.message, true);
  }
});

/* ================= INIT / REFRESH ================= */
async function refresh() {
  [buses, bookings, promos] = await Promise.all([
    api("/api/buses"),
    api("/api/bookings"),
    api("/api/promos"),
  ]);
  renderDash();
  renderCheckinLogs();
  if (activeInspectedCode) inspectTicket(activeInspectedCode);
  renderBookings();
  renderBuses();
  renderPromos();
}

/* ================= PROMOTIONS ================= */
function renderPromos() {
  $("promoTable").innerHTML = `
    <thead><tr><th>โค้ด</th><th>ส่วนลด</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
    <tbody>${promos.length ? promos.map((p) => `
      <tr>
        <td class="cell-code">${esc(p.code)}</td>
        <td>ลด ${p.percent}%</td>
        <td><span class="status-pill ${p.active ? "status-active" : "status-cancelled"}">${p.active ? "ใช้งาน" : "ปิดใช้งาน"}</span></td>
        <td><div class="actions">
          <button class="btn-sm btn-warn" data-ptoggle="${esc(p.code)}">${p.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button>
          <button class="btn-sm btn-danger" data-pdel="${esc(p.code)}">ลบ</button>
        </div></td>
      </tr>`).join("") : `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--muted)">ยังไม่มีโค้ดโปรโมชั่น</td></tr>`}</tbody>`;

  $("promoTable").querySelectorAll("[data-ptoggle]").forEach((b) =>
    b.addEventListener("click", async () => {
      try { await api(`/api/promos/${encodeURIComponent(b.dataset.ptoggle)}/toggle`, { method: "PATCH" }); toast("อัปเดตสถานะโค้ดแล้ว"); refresh(); }
      catch (e) { toast(e.message, true); }
    }));
  $("promoTable").querySelectorAll("[data-pdel]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(`ลบโค้ด ${b.dataset.pdel}?`)) return;
      try { await api(`/api/promos/${encodeURIComponent(b.dataset.pdel)}`, { method: "DELETE" }); toast("ลบโค้ดแล้ว"); refresh(); }
      catch (e) { toast(e.message, true); }
    }));
}

$("prAdd").addEventListener("click", async () => {
  const code = $("prCode").value.trim();
  const percent = Number($("prPercent").value);
  if (!code || !percent) { toast("กรุณากรอกโค้ดและ % ส่วนลด", true); return; }
  try {
    await api("/api/promos", { method: "POST", body: { code, percent } });
    toast(`เพิ่มโค้ด ${code.toUpperCase()} แล้ว`);
    $("prCode").value = "";
    $("prPercent").value = "";
    refresh();
  } catch (e) {
    toast(e.message, true);
  }
});

/* ================= THEME TOGGLE (v1.3.0) ================= */
$("themeToggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("busgo_theme", next); } catch {}
});

/* ================= UPDATE NOTIFIER (admin) ================= */
const ADMIN_UPDATE_KEY = "busgo_admin_loaded_version";
async function checkForUpdate(first = false) {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    const data = await res.json();
    const loaded = sessionStorage.getItem(ADMIN_UPDATE_KEY);
    if (first) { sessionStorage.setItem(ADMIN_UPDATE_KEY, data.version); }
    const tag = $("adminVersion");
    if (tag) tag.textContent =
      `BusGo V${data.semver} · build ${data.short} (${data.source === "render" ? "Render" : "Local"}) · ตรวจสอบล่าสุด ${new Date().toLocaleTimeString("th-TH")}${loaded === data.version ? " · ล่าสุดแล้ว" : ""}`;
    if (loaded && loaded !== data.version && !checkForUpdate._shown) {
      checkForUpdate._shown = true;
      const foot = $("adminUpdateFoot");
      if (foot) foot.textContent = `BUILD V${data.semver} (${data.short}) DETECTED ON SERVER`;
      $("adminUpdateOverlay").classList.remove("hidden");
    }
  } catch {}
}
$("adminUpdateReloadBtn").addEventListener("click", () => location.reload());
setInterval(checkForUpdate, 60000);
checkForUpdate(true);

(async function init() {
  showLogin(true);
  if (KEY) {
    /* [v1.2.0] ตรวจ session จริงด้วยการยิง refresh() — 401 จะ showLogin(true) + เคลียร์ token เอง */
    try {
      await refresh();
      showLogin(false);
      return;
    } catch {}
    KEY = "";
    try {
      sessionStorage.removeItem("bg_admin_session");
      localStorage.removeItem("bg_admin_session");
    } catch {}
  }
})();

/* กัน form reload หน้า (เดิมใช้ onsubmit inline ซึ่งถูก CSP บล็อก) */
const _busFormEl = document.getElementById("busForm");
if (_busFormEl) _busFormEl.addEventListener("submit", (e) => e.preventDefault());

/* UI Helpers (Header scroll, Live Clock, Data-Jump shortcuts) */
const _topHeader = $("topHeader");
if (_topHeader) {
  const onScroll = () => _topHeader.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

const _liveClock = $("liveClock");
if (_liveClock) {
  const pad = (n) => String(n).padStart(2, "0");
  function tick() {
    const d = new Date();
    _liveClock.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  tick();
  setInterval(tick, 30000);
}

document.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => {
  const t = b.getAttribute("data-jump");
  document.querySelectorAll(".admin-tabs .nav-link").forEach((x) => x.classList.toggle("active", x.dataset.tab === t));
  ["dash", "checkin", "bookings", "buses", "promos"].forEach((id) => {
    const el = $("tab-" + id);
    if (el) el.classList.toggle("hidden", id !== t);
  });
  const panel = $("tab-" + t);
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}));

const busCancel = $("busCancel");
if (busCancel) busCancel.addEventListener("click", () => $("busModal")?.classList.add("hidden"));



