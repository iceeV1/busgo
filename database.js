"use strict";

// Clean console guard: suppress benign ResizeObserver notices
window.addEventListener("error", (e) => {
  if (e.message && (e.message.includes("ResizeObserver") || e.message.includes("Script error"))) {
    e.stopImmediatePropagation();
  }
});

const $ = (id) => document.getElementById(id);
const esc = (t) => (t == null ? "" : String(t)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const DB_SCHEMAS = {
  buses: {
    title: "ตาราง: buses (ข้อมูลรอบรถ)",
    desc: "จัดเก็บข้อมูลเที่ยวรถ สถานีต้นทาง ปลายทาง เวลาออกเดินทาง ประเภทรถ และราคาค่าโดยสาร",
    cols: [
      { col: "id", type: "VARCHAR(20)", key: "PRIMARY KEY", desc: "รหัสเที่ยวรถ (e.g. B01, B02)" },
      { col: "fromCity", type: "VARCHAR(80)", key: "NOT NULL", desc: "สถานีต้นทาง (e.g. กรุงเทพฯ)" },
      { col: "toCity", type: "VARCHAR(80)", key: "NOT NULL", desc: "สถานีปลายทาง (e.g. เชียงใหม่)" },
      { col: "depart", type: "TIME", key: "NOT NULL", desc: "เวลาออกเดินทาง (HH:MM)" },
      { col: "arrive", type: "TIME", key: "NOT NULL", desc: "เวลาถึงปลายทาง (HH:MM)" },
      { col: "duration", type: "VARCHAR(30)", key: "NULLABLE", desc: "ระยะเวลาเดินทางโดยประมาณ" },
      { col: "type", type: "VARCHAR(10)", key: "NOT NULL", desc: "ประเภทรถ (vip / air / eco)" },
      { col: "seats", type: "INT", key: "NOT NULL", desc: "จำนวนที่นั่งทั้งหมด (32 / 44 / 48)" },
      { col: "price", type: "DECIMAL(10,2)", key: "NOT NULL", desc: "ราคาค่าโดยสารต่อที่นั่ง (บาท)" },
    ],
  },
  bookings: {
    title: "ตาราง: bookings (การจองตั๋วสด)",
    desc: "จัดเก็บประวัติการจองตั๋ว รหัสตั๋วโดยสาร เที่ยวรถ ผู้โดยสาร หมายเลขที่นั่ง และสถานะการชำระเงิน",
    cols: [
      { col: "code", type: "VARCHAR(20)", key: "PRIMARY KEY (UNIQUE)", desc: "รหัสตั๋วโดยสาร (e.g. BG-2205FB)" },
      { col: "busId", type: "VARCHAR(20)", key: "FOREIGN KEY -> buses(id)", desc: "รหัสเที่ยวรถที่จอง" },
      { col: "name", type: "VARCHAR(120)", key: "NOT NULL", desc: "ชื่อผู้โดยสาร (Masked เพื่อความเป็นส่วนตัว)" },
      { col: "seats", type: "VARCHAR(120)", key: "NOT NULL", desc: "หมายเลขที่นั่งที่เลือก (e.g. 1/2)" },
      { col: "total", type: "DECIMAL(10,2)", key: "NOT NULL", desc: "ยอดเงินรวมทั้งสิ้น (บาท)" },
      { col: "status", type: "VARCHAR(15)", key: "DEFAULT 'active'", desc: "สถานะตั๋ว (active, checked_in, cancelled)" },
      { col: "date", type: "DATE", key: "NOT NULL", desc: "วันที่เดินทาง" },
      { col: "createdAt", type: "DATETIME", key: "NOT NULL", desc: "วันเวลาที่ทำการจอง" },
    ],
  },
  users: {
    title: "ตาราง: users (ข้อมูลสมาชิก)",
    desc: "จัดเก็บข้อมูลผู้ใช้งานระบบ Smart Transit Pass พร้อมการเข้ารหัสความปลอดภัย",
    cols: [
      { col: "id", type: "VARCHAR(20)", key: "PRIMARY KEY", desc: "รหัสสมาชิก (e.g. U5FE25A45)" },
      { col: "name", type: "VARCHAR(120)", key: "NOT NULL", desc: "ชื่อสมาชิก" },
      { col: "phone", type: "VARCHAR(15)", key: "NULLABLE", desc: "เบอร์โทรศัพท์สมาชิก" },
      { col: "createdAt", type: "DATETIME", key: "NOT NULL", desc: "วันเวลาที่สมัครสมาชิก" },
    ],
  },
  promos: {
    title: "ตาราง: promos (โค้ดส่วนลด)",
    desc: "จัดเก็บโค้ดส่วนลดโปรโมชั่น มูลค่าส่วนลด และสถิติจำนวนครั้งที่ใช้งาน",
    cols: [
      { col: "code", type: "VARCHAR(30)", key: "PRIMARY KEY", desc: "โค้ดส่วนลด (e.g. WELCOME10)" },
      { col: "type", type: "VARCHAR(10)", key: "NOT NULL", desc: "ประเภทส่วนลด (percent / fixed)" },
      { col: "value", type: "DECIMAL(10,2)", key: "NOT NULL", desc: "มูลค่าส่วนลด (% หรือ บาท)" },
      { col: "active", type: "TINYINT(1)", key: "DEFAULT 1", desc: "สถานะการเปิดใช้งาน (1=เปิด, 0=ปิด)" },
    ],
  },
};

let activeTable = "buses";
let lastData = null;

function renderSchema(table) {
  const def = DB_SCHEMAS[table];
  if (!def) return;
  const titleEl = $("dbActiveTitle");
  if (titleEl) titleEl.textContent = def.title;
  const descEl = $("dbActiveDesc");
  if (descEl) descEl.textContent = def.desc;

  const tbody = $("dbSchemaBody");
  if (tbody) {
    tbody.innerHTML = def.cols
      .map(
        (c) => `
      <tr>
        <td><strong class="mono highlight-cyan">${esc(c.col)}</strong></td>
        <td><span class="mono">${esc(c.type)}</span></td>
        <td><span class="badge" style="font-size:11px">${esc(c.key)}</span></td>
        <td>${esc(c.desc)}</td>
      </tr>
    `
      )
      .join("");
  }
}

function renderGrid(table, records) {
  const thead = $("dbDataHead");
  const tbody = $("dbDataBody");
  const countEl = $("dbGridCount");
  if (countEl) countEl.textContent = `${records.length} เรคคอร์ดในตาราง`;

  if (!thead || !tbody) return;

  if (records.length === 0) {
    thead.innerHTML = `<tr><th>ข้อมูลในตาราง</th></tr>`;
    tbody.innerHTML = `<tr><td class="muted text-center" style="padding:32px">ยังไม่มีข้อมูลในตารางนี้</td></tr>`;
    return;
  }

  const cols = Object.keys(records[0]);
  thead.innerHTML = `<tr>${cols.map((c) => `<th class="mono" style="font-size:12px">${esc(c)}</th>`).join("")}</tr>`;
  tbody.innerHTML = records
    .map(
      (row) => `
    <tr>
      ${cols
        .map((c) => {
          let val = row[c];
          if (typeof val === "object" && val !== null) val = JSON.stringify(val);
          return `<td class="mono small">${esc(val != null ? String(val) : "NULL")}</td>`;
        })
        .join("")}
    </tr>
  `
    )
    .join("");
}

async function fetchRealtimeDatabase() {
  try {
    const res = await fetch("/api/database/overview");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    lastData = data;

    const c = data.counts || {};
    if ($("badgeBuses")) $("badgeBuses").textContent = c.buses || 0;
    if ($("badgeBookings")) $("badgeBookings").textContent = c.bookings || 0;
    if ($("badgeUsers")) $("badgeUsers").textContent = c.users || 0;
    if ($("badgePromos")) $("badgePromos").textContent = c.promos || 0;

    const totalRecs = (c.buses || 0) + (c.bookings || 0) + (c.users || 0) + (c.promos || 0);
    if ($("statTotalRecords")) $("statTotalRecords").textContent = `${totalRecs} รายการ`;
    if (data.storageMode && $("dbEngineSub")) $("dbEngineSub").textContent = data.storageMode;

    const curList = (data.tables && data.tables[activeTable]) || [];
    renderGrid(activeTable, curList);

    if ($("dbRawJson")) $("dbRawJson").textContent = JSON.stringify(data, null, 2);

    const now = new Date();
    if ($("dbSyncTime")) {
      $("dbSyncTime").textContent = `ซิงค์สดล่าสุด: ${now.toLocaleTimeString("th-TH")} น. (Real-Time Auto Sync)`;
    }
  } catch (e) {
    if ($("dbSyncTime")) {
      $("dbSyncTime").textContent = `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${e.message}`;
    }
  }
}

document.querySelectorAll(".db-tab-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".db-tab-pill").forEach((b) => b.classList.toggle("active", b === btn));
    activeTable = btn.dataset.table;
    renderSchema(activeTable);
    if (lastData && lastData.tables) {
      renderGrid(activeTable, lastData.tables[activeTable] || []);
    }
  });
});

const themeBtn = $("themeToggle");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("busgo_theme", next);
  });
}

renderSchema("buses");
fetchRealtimeDatabase();
setInterval(fetchRealtimeDatabase, 2000);
