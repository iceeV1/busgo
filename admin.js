"use strict";

/* ================= HELPERS ================= */
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

/* ================= STATE / API ================= */
let KEY = sessionStorage.getItem("bg_admin_key") || "";
let buses = [];
let bookings = [];
let promos = [];
let editingBusId = null;

async function api(path, opts = {}) {
  const r = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", "x-admin-key": KEY },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let d = {};
  try { d = await r.json(); } catch {}
  if (r.status === 401) { showLogin(true); throw new Error(d.error || "ไม่ได้รับอนุญาต"); }
  if (!r.ok) throw new Error(d.error || "เกิดข้อผิดพลาด");
  return d;
}

/* ================= LOGIN ================= */
function showLogin(show) {
  $("loginOverlay").style.display = show ? "flex" : "none";
}
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  KEY = $("adminPass").value.trim();
  try {
    const res = await fetch("/api/admin/check", { headers: { "x-admin-key": KEY } });
    if (!res.ok) throw new Error("รหัสผ่านไม่ถูกต้อง");
    sessionStorage.setItem("bg_admin_key", KEY);
    showLogin(false);
    toast("เข้าสู่ระบบสำเร็จ");
    refresh();
  } catch (err) {
    toast(err.message || "เข้าสู่ระบบไม่สำเร็จ", true);
  }
});
$("logoutBtn").addEventListener("click", () => {
  KEY = "";
  sessionStorage.removeItem("bg_admin_key");
  showLogin(true);
});

/* ================= TABS ================= */
document.querySelectorAll(".admin-tabs .nav-link").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tabs .nav-link").forEach((b) =>
      b.classList.toggle("active", b === btn));
    ["dash", "bookings", "buses", "promos"].forEach((id) =>
      $("tab-" + id).classList.toggle("hidden", id !== btn.dataset.tab));
  })
);

/* ================= DASHBOARD ================= */
function renderDash() {
  const active = bookings.filter((b) => b.status === "active");
  const revenue = active.reduce((s, b) => s + b.total, 0);
  const today = new Date().toISOString().slice(0, 10);

  $("statCards").innerHTML = `
    <div class="stat-card hl"><div class="sc-icon"></div><div class="sc-value">${bookings.length}</div><div class="sc-label">การจองทั้งหมด</div></div>
    <div class="stat-card green"><div class="sc-icon"></div><div class="sc-value">${active.length}</div><div class="sc-label">ตั๋วที่ยืนยันแล้ว</div></div>
    <div class="stat-card gold"><div class="sc-icon"></div><div class="sc-value">฿${revenue.toLocaleString()}</div><div class="sc-label">รายได้รวม</div></div>
    <div class="stat-card"><div class="sc-icon"></div><div class="sc-value">${buses.length}</div><div class="sc-label">เที่ยวรถในระบบ</div></div>
    <div class="stat-card"><div class="sc-icon"></div><div class="sc-value">${bookings.filter((b) => b.date === today && b.status === "active").length}</div><div class="sc-label">ตั๋ววันนี้</div></div>`;

  // เส้นทางยอดนิยม
  const byRoute = {};
  active.forEach((b) => {
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
      const active = bk.status === "active";
      return `<tr class="${active ? "" : "cancelled-row"}">
        <td class="cell-code">${esc(bk.code)}</td>
        <td>${esc(route)}</td>
        <td>${fmtDate(bk.date)}</td>
        <td>${bus ? bus.depart : "—"}</td>
        <td>${esc(bk.name)}<br /><span class="muted small">${esc(bk.phone)}</span></td>
        <td>${bk.seats.join(", ")}</td>
        <td><b>฿${bk.total.toLocaleString()}</b></td>
        <td><span class="status-pill ${active ? "status-active" : "status-cancelled"}">${active ? "ยืนยันแล้ว" : "ยกเลิก"}</span></td>
        <td><div class="actions">
          ${active ? `<button class="btn-sm btn-warn" data-cancel="${esc(bk.code)}">ยกเลิก</button>` : ""}
          <button class="btn-sm btn-danger" data-del="${esc(bk.code)}">ลบ</button>
        </div></td>
      </tr>`;
    }).join("") : `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">ไม่พบรายการจอง</td></tr>`}</tbody>`;

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
  const head = ["code", "route_from", "route_to", "date", "depart", "name", "phone", "seats", "total", "status"];
  const lines = [head.join(",")];
  getFilteredBookings().forEach((bk) => {
    const bus = buses.find((x) => x.id === bk.busId) || {};
    lines.push([bk.code, bus.from || "", bus.to || "", bk.date, bus.depart || "",
      `"${(bk.name || "").replace(/"/g, '""')}"`, bk.phone,
      `"${bk.seats.join(" ")}"`, bk.total, bk.status].join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "busgo_bookings.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

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
    $("fDepart").value = bus.depart; $("fArrive").value = bus.arrive;
    $("fDuration").value = bus.duration; $("fType").value = bus.type;
    $("fMode").value = bus.mode || "bus";
    $("fPrice").value = bus.price;
  } else {
    $("busForm").reset();
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
    mode: $("fMode").value,
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
      toast("มีเวอร์ชันใหม่ของระบบ — แนะนำให้รีเฟรชหน้าเว็บ (F5)");
    }
  } catch {}
}
setInterval(checkForUpdate, 60000);
checkForUpdate(true);

(async function init() {
  showLogin(true);
  if (KEY) {
    try {
      const res = await fetch("/api/admin/check", { headers: { "x-admin-key": KEY } });
      if (res.ok) { showLogin(false); refresh(); return; }
    } catch {}
    KEY = "";
    sessionStorage.removeItem("bg_admin_key");
  }
})();


