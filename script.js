"use strict";

/* ================= DATA & CONSTANTS ================= */
const PROVINCES = [
  "กรุงเทพฯ", "เชียงใหม่", "ภูเก็ต", "ขอนแก่น", "นครราชสีมา",
  "หาดใหญ่", "พัทยา", "สุราษฎร์ธานี", "อุดรธานี", "แม่ฮ่องสอน",
];

const TYPE_INFO = {
  vip: { label: "VIP Luxury", seats: 32, cls: "badge-vip", amenities: ["WiFi 5G", "เบาะนวดปรับเอน", "Type-C Fast Charge", "ห้องน้ำ", "ของว่าง"] },
  air: { label: "ปรับอากาศชั้น 1", seats: 44, cls: "badge-air", amenities: ["WiFi", "เบาะปรับเอน", "USB Charge", "ห้องน้ำ"] },
  eco: { label: "ธรรมดา Express", seats: 48, cls: "badge-eco", amenities: ["พัดลม/แอร์", "เบาะมาตรฐาน", "USB Charge"] },
};

const ROUTE_STATIONS = {
  "กรุงเทพฯ|เชียงใหม่": ["หมอชิต 2", "พระนครศรีอยุธยา", "นครสวรรค์", "พิษณุโลก", "ลำปาง", "อาเขต เชียงใหม่"],
  "เชียงใหม่|กรุงเทพฯ": ["อาเขต เชียงใหม่", "ลำปาง", "พิษณุโลก", "นครสวรรค์", "อยุธยา", "หมอชิต 2 กรุงเทพฯ"],
  "กรุงเทพฯ|ภูเก็ต": ["สายใต้ใหม่", "สมุทรสาคร", "เพชรบุรี", "ชุมพร", "สุราษฎร์ธานี", "บขส. ภูเก็ต 2"],
  "ภูเก็ต|กรุงเทพฯ": ["บขส. ภูเก็ต 2", "พังงา", "สุราษฎร์ธานี", "ชุมพร", "เพชรบุรี", "สายใต้ใหม่ กรุงเทพฯ"],
  "กรุงเทพฯ|ขอนแก่น": ["หมอชิต 2", "สระบุรี", "นครราชสีมา", "เมืองพล", "บขส. 3 ขอนแก่น"],
  "กรุงเทพฯ|นครราชสีมา": ["หมอชิต 2", "รังสิต", "สระบุรี", "ปากช่อง", "บขส. ใหม่ โคราช"],
  "กรุงเทพฯ|หาดใหญ่": ["สายใต้ใหม่", "เพชรบุรี", "ประจวบฯ", "ชุมพร", "สุราษฎร์ฯ", "พัทลุง", "บขส. หาดใหญ่"],
  "กรุงเทพฯ|พัทยา": ["เอกมัย", "ชลบุรี", "บางแสน", "ศรีราชา", "พัทยากลาง"],
  "กรุงเทพฯ|สุราษฎร์ธานี": ["สายใต้ใหม่", "เพชรบุรี", "ประจวบฯ", "ชุมพร", "บขส. สุราษฎร์ธานี"],
  "กรุงเทพฯ|อุดรธานี": ["หมอชิต 2", "สระบุรี", "นครราชสีมา", "ขอนแก่น", "บขส. อุดรธานี 1"],
  "เชียงใหม่|แม่ฮ่องสอน": ["อาเขต เชียงใหม่", "แม่ริม", "ปาย", "ปางมะผ้า", "บขส. แม่ฮ่องสอน"],
};

let BUSES = [
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

/* ================= STATE & STORAGE ================= */
const LS_MIRROR = "busgo_local_bookings";
const LS_MY = "busgo_my_codes";
const LS_SESSION = "busgo_member_token";
const LS_RECENT = "busgo_recent_searches";

let bookings = [];
let serverOnline = false;
let currentUser = null;
let activeTrackerFilter = "all";
let trackerSearchKeyword = "";

let state = {
  date: localToday(),
  returnDate: "",
  tripType: "oneway",
  pax: 1,
  mode: "bus",
  from: "", to: "", type: "",
  sortBy: "depart_asc",
  currentBusId: null,
  currentDate: null,
  appliedPromo: null,
  custName: "", custPhone: "", custNote: "",
  selectedSeats: new Set(),
};

/* ================= UTILS & HELPERS ================= */
const $ = (id) => document.getElementById(id);
const esc = (t) => (t == null ? "" : String(t)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function localToday() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} (วัน${days[d.getDay()]})`;
}

function showToast(msg, isError = false) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "toast" + (isError ? " error" : "");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add("hidden"), 2800);
}

function genCode() {
  const buf = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(buf);
  else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  return "BG-" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function findBus(id) { return BUSES.find((b) => b.id === id); }

function myCodes() {
  try { return JSON.parse(localStorage.getItem(LS_MY) || "[]"); } catch { return []; }
}
function addMyCode(code) {
  const s = myCodes();
  if (s.includes(code)) return;
  s.unshift(code);
  localStorage.setItem(LS_MY, JSON.stringify(s.slice(0, 50)));
}

function loadMirror() {
  try { return JSON.parse(localStorage.getItem(LS_MIRROR) || "[]"); } catch { return []; }
}
function withPii(bk) {
  if (bk.name !== undefined) return bk;
  const o = loadMirror().find((x) => x.code === bk.code);
  return o ? { ...o, ...bk } : bk;
}
function saveMirror() {
  try {
    const old = loadMirror();
    const merged = bookings.map((bk) =>
      bk.name === undefined ? { ...(old.find((x) => x.code === bk.code) || {}), ...bk } : bk
    );
    for (const o of old) if (!merged.some((x) => x.code === o.code)) merged.push(o);
    localStorage.setItem(LS_MIRROR, JSON.stringify(merged));
  } catch {}
}

/* ================= LIVE RADAR & TELEMETRY ENGINE ================= */
function getRouteWaypoints(from, to) {
  const key = `${from}|${to}`;
  if (ROUTE_STATIONS[key]) return ROUTE_STATIONS[key];
  const revKey = `${to}|${from}`;
  if (ROUTE_STATIONS[revKey]) return [...ROUTE_STATIONS[revKey]].reverse();
  return [from, "จุดพักรถระหว่างทาง 1", "จุดตรวจความเร็ว", "จุดพักรถระหว่างทาง 2", to];
}

function getBusLiveTelemetry(bus) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  const [dh, dm] = bus.depart.split(":").map(Number);
  const [ah, am] = bus.arrive.split(":").map(Number);

  const departMinutes = dh * 60 + dm;
  let arriveMinutes = ah * 60 + am;
  if (arriveMinutes <= departMinutes) arriveMinutes += 1440;

  let effNow = currentMinutes;
  if (arriveMinutes > 1440 && effNow < departMinutes && effNow + 1440 <= arriveMinutes) {
    effNow += 1440;
  }

  let status = "scheduled";
  let statusLabel = "รอออกเดินทาง";
  let progress = 0;
  let speed = 0;
  let etaText = "";

  if (effNow < departMinutes) {
    status = "scheduled";
    progress = 0;
    const diff = Math.round(departMinutes - effNow);
    const h = Math.floor(diff / 60), m = diff % 60;
    statusLabel = "รอออกเดินทาง";
    etaText = h > 0 ? `ออกเดินทางในอีก ${h} ชม. ${m} นาที` : `ออกเดินทางในอีก ${m} นาที`;
    speed = 0;
  } else if (effNow >= arriveMinutes) {
    status = "arrived";
    progress = 100;
    statusLabel = "ถึงปลายทางแล้ว";
    etaText = `ถึงปลายทางเรียบร้อย (${bus.arrive} น.)`;
    speed = 0;
  } else {
    status = "enroute";
    const totalDuration = arriveMinutes - departMinutes;
    progress = Math.min(99, Math.max(2, Math.round(((effNow - departMinutes) / totalDuration) * 100)));
    const remain = Math.round(arriveMinutes - effNow);
    const h = Math.floor(remain / 60), m = remain % 60;
    statusLabel = "กำลังวิ่งบนถนน";
    etaText = h > 0 ? `คาดว่าจะถึงในอีก ${h} ชม. ${m} นาที` : `คาดว่าจะถึงในอีก ${m} นาที`;
    speed = 76 + ((bus.id.charCodeAt(1) || 0) * 5 + now.getMinutes()) % 16;
  }

  const waypoints = getRouteWaypoints(bus.from, bus.to);
  const curIdx = Math.min(waypoints.length - 1, Math.floor((progress / 100) * waypoints.length));
  const currentLoc = waypoints[curIdx] || bus.from;
  const nextStop = waypoints[Math.min(waypoints.length - 1, curIdx + 1)] || bus.to;

  return {
    status,
    statusLabel,
    progress,
    speed,
    etaText,
    currentLoc,
    nextStop,
    waypoints,
    curIdx,
  };
}

function updateSystemClock() {
  const clock = $("systemClock");
  if (!clock) return;
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} น.`;
}
setInterval(updateSystemClock, 1000);
updateSystemClock();

/* ================= 24/7 LIVE GPS & SATELLITE RADAR MAP ================= */
const GPS_STATIONS = {
  "กรุงเทพฯ": [13.7563, 100.5018],
  "หมอชิต 2": [13.8131, 100.5487],
  "หมอชิต 2 กรุงเทพฯ": [13.8131, 100.5487],
  "สายใต้ใหม่": [13.7806, 100.4227],
  "สายใต้ใหม่ กรุงเทพฯ": [13.7806, 100.4227],
  "เอกมัย": [13.7196, 100.5833],
  "รังสิต": [13.9889, 100.6177],
  "พระนครศรีอยุธยา": [14.3532, 100.5684],
  "อยุธยา": [14.3532, 100.5684],
  "สระบุรี": [14.5289, 100.9108],
  "ปากช่อง": [14.7077, 101.4087],
  "นครราชสีมา": [14.9799, 102.0978],
  "บขส. ใหม่ โคราช": [14.9897, 102.1022],
  "เมืองพล": [15.8166, 102.5991],
  "ขอนแก่น": [16.4322, 102.8236],
  "บขส. 3 ขอนแก่น": [16.3986, 102.8091],
  "อุดรธานี": [17.4157, 102.7872],
  "บขส. อุดรธานี 1": [17.4042, 102.7981],
  "นครสวรรค์": [15.6930, 100.1226],
  "พิษณุโลก": [16.8211, 100.2659],
  "ลำปาง": [18.2888, 99.4928],
  "เชียงใหม่": [18.7883, 98.9853],
  "อาเขต เชียงใหม่": [18.7997, 99.0178],
  "แม่ริม": [18.9142, 98.9439],
  "ปาย": [19.3582, 98.4405],
  "ปางมะผ้า": [19.5218, 98.2464],
  "แม่ฮ่องสอน": [19.3020, 97.9654],
  "บขส. แม่ฮ่องสอน": [19.2985, 97.9682],
  "ชลบุรี": [13.3611, 100.9847],
  "บางแสน": [13.2842, 100.9152],
  "ศรีราชา": [13.1737, 100.9312],
  "พัทยา": [12.9276, 100.8771],
  "พัทยากลาง": [12.9348, 100.8924],
  "สมุทรสาคร": [13.5475, 100.2744],
  "เพชรบุรี": [13.1114, 99.9398],
  "ประจวบฯ": [11.8124, 99.7972],
  "ชุมพร": [10.4930, 99.1800],
  "สุราษฎร์ธานี": [9.1382, 99.3217],
  "สุราษฎร์ฯ": [9.1382, 99.3217],
  "บขส. สุราษฎร์ธานี": [9.1264, 99.3101],
  "พังงา": [8.4501, 98.5255],
  "ภูเก็ต": [7.8804, 98.3923],
  "บขส. ภูเก็ต 2": [7.9174, 98.3965],
  "พัทลุง": [7.6167, 100.0833],
  "หาดใหญ่": [7.0084, 100.4767],
  "บขส. หาดใหญ่": [6.9934, 100.4828],
};

function getStationCoord(name, fallbackFrom, fallbackTo) {
  if (GPS_STATIONS[name]) return GPS_STATIONS[name];
  for (const [k, v] of Object.entries(GPS_STATIONS)) {
    if (name.includes(k) || k.includes(name)) return v;
  }
  const f1 = GPS_STATIONS[fallbackFrom] || [13.7563, 100.5018];
  const f2 = GPS_STATIONS[fallbackTo] || [18.7883, 98.9853];
  return [(f1[0] + f2[0]) / 2, (f1[1] + f2[1]) / 2];
}

function getBusCoordinates(bus, tele) {
  const waypoints = tele.waypoints && tele.waypoints.length ? tele.waypoints : [bus.from, bus.to];
  const count = waypoints.length;
  if (count <= 1) {
    const pt = getStationCoord(bus.from);
    return { lat: pt[0], lng: pt[1], bearing: 0 };
  }

  const p = Math.max(0, Math.min(100, tele.progress)) / 100;
  const scaled = p * (count - 1);
  const idx = Math.min(count - 2, Math.floor(scaled));
  const fract = scaled - idx;

  const p1 = getStationCoord(waypoints[idx], bus.from, bus.to);
  const p2 = getStationCoord(waypoints[idx + 1], bus.from, bus.to);

  const lat = p1[0] + (p2[0] - p1[0]) * fract;
  const lng = p1[1] + (p2[1] - p1[1]) * fract;

  const dLat = p2[0] - p1[0];
  const dLng = p2[1] - p1[1];
  let bearing = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;

  return { lat, lng, bearing: Math.round(bearing) };
}

let liveMap = null;
let busMarkers = new Map();
let activeGpsFilter = "all";
let focusedBusId = null;
let darkTileLayer = null;
let lightTileLayer = null;

// 3D Perspective Camera State
let is3dMode = true;
let gpsPitch = 50;
let gpsBearing = -8;
let gpsScale = 1.22;
let isAutoOrbiting = false;
let autoOrbitInterval = null;
let autoOrbitDirection = 1;

function apply3dCamera() {
  document.documentElement.style.setProperty("--gps-pitch", `${gpsPitch}deg`);
  document.documentElement.style.setProperty("--gps-bearing", `${gpsBearing}deg`);
  document.documentElement.style.setProperty("--gps-scale", `${gpsScale}`);

  const pEl = $("lblPitch");
  if (pEl) pEl.textContent = `${gpsPitch}°`;
  const bEl = $("lblBearing");
  if (bEl) bEl.textContent = `${gpsBearing}°`;
  const gyroEl = $("g3hGyroVal");
  if (gyroEl) gyroEl.textContent = `P:${gpsPitch}° · B:${gpsBearing}°`;

  const sPitch = $("sliderPitch");
  if (sPitch && Number(sPitch.value) !== gpsPitch) sPitch.value = gpsPitch;
  const sBearing = $("sliderBearing");
  if (sBearing && Number(sBearing.value) !== gpsBearing) sBearing.value = gpsBearing;
}

function set3dMode(enable) {
  is3dMode = enable;
  const stage = $("gps3dStage");
  const btn = $("gps3dToggleBtn");
  const txt = $("gps3dBtnText");

  if (stage) stage.classList.toggle("is-3d", enable);
  if (btn) btn.classList.toggle("active", enable);
  if (txt) txt.textContent = enable ? "โหมด 3D โฮโลกราฟิก" : "โหมด 2D แผนที่";

  if (!enable && isAutoOrbiting) {
    toggleAutoOrbit(false);
  }

  if (liveMap) {
    setTimeout(() => {
      liveMap.invalidateSize();
    }, 350);
  }
}

function setCameraPreset(type) {
  document.querySelectorAll(".g3h-btn").forEach((b) => b.classList.toggle("active", b.dataset.cam === type));
  if (type === "iso") {
    set3dMode(true);
    gpsPitch = 50;
    gpsBearing = -8;
    gpsScale = 1.22;
  } else if (type === "cinematic") {
    set3dMode(true);
    gpsPitch = 60;
    gpsBearing = 16;
    gpsScale = 1.30;
  } else if (type === "top") {
    gpsPitch = 0;
    gpsBearing = 0;
    gpsScale = 1.0;
    set3dMode(false);
  }
  apply3dCamera();
}

function toggleAutoOrbit(forceState) {
  const next = typeof forceState === "boolean" ? forceState : !isAutoOrbiting;
  isAutoOrbiting = next;
  const btn = $("btnAutoOrbit");
  const lbl = $("lblAutoOrbit");
  if (btn) btn.classList.toggle("active", isAutoOrbiting);
  if (lbl) lbl.textContent = isAutoOrbiting ? "หยุดหมุน" : "หมุนอัตโนมัติ";

  if (autoOrbitInterval) {
    clearInterval(autoOrbitInterval);
    autoOrbitInterval = null;
  }

  if (isAutoOrbiting) {
    if (!is3dMode) set3dMode(true);
    autoOrbitInterval = setInterval(() => {
      gpsBearing += 0.35 * autoOrbitDirection;
      if (gpsBearing >= 22) {
        gpsBearing = 22;
        autoOrbitDirection = -1;
      } else if (gpsBearing <= -22) {
        gpsBearing = -22;
        autoOrbitDirection = 1;
      }
      gpsBearing = Math.round(gpsBearing * 10) / 10;
      apply3dCamera();
    }, 45);
  }
}

function createBusIcon(bus, tele, bearing) {
  const isEnroute = tele.status === "enroute";
  const statusCls = isEnroute ? "enroute" : tele.status === "scheduled" ? "scheduled" : "arrived";
  const pulseHtml = `<div class="bus-marker-pulse ${statusCls}"></div>`;
  const roadShadow = `<div class="bus-road-shadow"></div>`;
  const groundDisc = `<div class="bus-ground-disc ${statusCls}"></div>`;
  const headlights = isEnroute ? `<div class="bus-dual-headlights" style="transform: translate(-50%, -50%) rotate(${bearing}deg)"></div>` : "";
  const holoPillar = `<div class="bus-holo-pillar ${statusCls}"></div>`;
  const speedBadge = isEnroute ? `<span class="badge-speed">${tele.speed} กม./ชม.</span>` : "";

  const flankColor = isEnroute ? "#0284c7" : "#d97706";
  const frontColor = isEnroute ? "#0369a1" : "#b45309";
  const roofColor = isEnroute ? "#38bdf8" : "#fbbf24";
  const acBorder = isEnroute ? "#06b6d4" : "#f59e0b";

  return L.divIcon({
    className: "bus-div-icon",
    html: `
      <div class="bus-marker-wrap" data-bus-marker="${esc(bus.id)}">
        ${roadShadow}
        ${groundDisc}
        ${headlights}
        ${pulseHtml}
        ${holoPillar}
        <div class="bus-3d-avatar">
          <div class="bus-3d-badge ${statusCls}">
            <span class="badge-fleet">${esc(bus.id)}</span>
            ${speedBadge}
          </div>
          <svg viewBox="0 0 54 48" class="bus-isometric-svg" style="transform: rotate(${bearing}deg)">
            <!-- Chassis shadow -->
            <ellipse cx="27" cy="38" rx="19" ry="6.5" fill="rgba(0,0,0,0.5)" />
            <!-- Lower chassis -->
            <path d="M11 26 L27 34 L43 26 L43 20 L27 28 L11 20 Z" fill="#0f172a" stroke="#334155" stroke-width="0.8" />
            <!-- Wheels -->
            <ellipse cx="17" cy="31" rx="3.2" ry="1.8" fill="#090d16" stroke="#64748b" stroke-width="0.7"/>
            <ellipse cx="37" cy="31" rx="3.2" ry="1.8" fill="#090d16" stroke="#64748b" stroke-width="0.7"/>
            <!-- Side flank -->
            <path d="M11 20 L27 28 L27 17 L11 9 Z" fill="${flankColor}" />
            <!-- Tinted passenger windows -->
            <path d="M13 18 L25 24 L25 19 L13 13 Z" fill="#090d16" />
            <path d="M14 17 L18 19 L18 16 L14 14 Z" fill="#38bdf8" fill-opacity="0.85" />
            <path d="M19 20 L24 22.5 L24 19.5 L19 17 Z" fill="#38bdf8" fill-opacity="0.85" />
            <!-- Front cabin -->
            <path d="M27 28 L43 20 L43 9 L27 17 Z" fill="${frontColor}" />
            <!-- Panoramic glass windshield -->
            <path d="M29 24 L41 18 L41 12 L29 18 Z" fill="#bae6fd" fill-opacity="0.85" />
            <line x1="31" y1="22" x2="39" y2="14" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" stroke-opacity="0.9"/>
            <!-- Xenon LED Headlights -->
            <circle cx="31" cy="25.5" r="1.8" fill="#fef08a" />
            <circle cx="39.5" cy="21.5" r="1.8" fill="#fef08a" />
            <line x1="33" y1="26.5" x2="38" y2="24" stroke="#ffd700" stroke-width="1.2" stroke-linecap="round"/>
            <!-- 3D Roof -->
            <path d="M11 9 L27 17 L43 9 L27 1 Z" fill="${roofColor}" stroke="#ffffff" stroke-width="0.8" stroke-opacity="0.75" />
            <!-- Roof AC Pod -->
            <path d="M23 9 L27 11 L31 9 L27 7 Z" fill="#0f172a" stroke="${acBorder}" stroke-width="0.7" />
            <line x1="16" y1="6.5" x2="22" y2="9.5" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -32],
  });
}

function createBusPopupContent(bus, tele) {
  const info = TYPE_INFO[bus.type] || {};
  const statusText = tele.status === "enroute" ? "กำลังวิ่งบนถนน" : tele.status === "scheduled" ? "รอออกเดินทาง" : "ถึงปลายทางแล้ว";
  const statusColor = tele.status === "enroute" ? "#06b6d4" : tele.status === "scheduled" ? "#f59e0b" : "#10b981";

  return `
    <div class="gps-popup-card">
      <div class="gpc-head">
        <span class="gpc-fleet">FLEET #${esc(bus.id)}</span>
        <span class="gpc-type badge ${info.cls || ""}">${info.label || bus.type}</span>
      </div>
      <div class="gpc-route">${esc(bus.from)} → ${esc(bus.to)}</div>
      <div style="font-size:11px; margin-bottom:10px; color:${statusColor}; font-weight:700">
        ● ${statusText} ${tele.status === "enroute" ? `· ความเร็ว ${tele.speed} กม./ชม.` : ""}
      </div>
      <div class="gpc-grid">
        <div class="gpc-cell">
          <small>พิกัดล่าสุด</small>
          <b>${esc(tele.currentLoc)}</b>
        </div>
        <div class="gpc-cell">
          <small>สถานีถัดไป</small>
          <b>${esc(tele.nextStop)}</b>
        </div>
        <div class="gpc-cell gpc-speed">
          <small>เวลาออก–ถึง</small>
          <b>${bus.depart} – ${bus.arrive}</b>
        </div>
        <div class="gpc-cell">
          <small>ความคืบหน้า</small>
          <b>${tele.progress}% (${tele.etaText ? tele.etaText.replace("ออกเดินทางในอีก", "รอ").replace("คาดว่าจะถึงในอีก", "อีก") : "ปกติ"})</b>
        </div>
      </div>
      <button type="button" class="gpc-btn" data-gps-book="${esc(bus.id)}">
        <span>จองคิวรถคันนี้ (฿${bus.price.toLocaleString()})</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </div>
  `;
}

function initLiveGpsMap() {
  const mapEl = $("liveGpsMap");
  if (!mapEl || liveMap) return;
  if (typeof L === "undefined") {
    setTimeout(initLiveGpsMap, 300);
    return;
  }

  // Center of Thailand
  liveMap = L.map("liveGpsMap", {
    center: [14.8, 100.8],
    zoom: 6,
    zoomControl: true,
    scrollWheelZoom: true,
  });

  darkTileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    subdomains: "abcd",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  });
  lightTileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    subdomains: "abcd",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  });

  const isLight = document.documentElement.dataset.theme === "light";
  (isLight ? lightTileLayer : darkTileLayer).addTo(liveMap);

  // 3D Multi-Layer Highway Corridors
  Object.entries(ROUTE_STATIONS).forEach(([key, stList]) => {
    const latlngs = stList.map((st) => getStationCoord(st));
    // Layer 1: Dark Highway Roadbed
    L.polyline(latlngs, {
      color: "#031525",
      weight: 6,
      opacity: 0.85,
      lineCap: "round",
    }).addTo(liveMap);
    // Layer 2: Neon Cyan Smart Transit Track
    L.polyline(latlngs, {
      color: "#06b6d4",
      weight: 2.8,
      opacity: 0.8,
      dashArray: "6, 10",
      className: "highway-neon-track",
    }).addTo(liveMap);
    // Layer 3: Glowing Center Energy Tracer
    L.polyline(latlngs, {
      color: "#f0f9ff",
      weight: 1.2,
      opacity: 0.9,
      dashArray: "3, 16",
    }).addTo(liveMap);
  });

  // Station Terminal Markers (3D Holographic Waypoint Beacons)
  const uniqueStations = new Set();
  Object.values(ROUTE_STATIONS).forEach((stList) => stList.forEach((s) => uniqueStations.add(s)));
  uniqueStations.forEach((name) => {
    const coord = getStationCoord(name);
    const stationIcon = L.divIcon({
      className: "station-div-icon",
      html: `
        <div class="station-beacon-wrap" title="${esc(name)}">
          <div class="station-ground-ring"></div>
          <div class="station-beacon-core"></div>
          <div class="station-beacon-pillar"></div>
          <div class="station-beacon-name">${esc(name)}</div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker(coord, { icon: stationIcon })
      .bindTooltip(name, { permanent: false, direction: "top", className: "station-tooltip" })
      .addTo(liveMap);
  });

  // Mouse coords update
  liveMap.on("mousemove", (e) => {
    const el = $("gpsLiveCoords");
    if (el) el.textContent = `พิกัด: ${e.latlng.lat.toFixed(4)}° N, ${e.latlng.lng.toFixed(4)}° E`;
  });

  apply3dCamera();
  set3dMode(true);
  updateLiveGpsMap();
  setupGpsControls();
}

function updateLiveGpsMap() {
  if (!liveMap) return;

  let enrouteCount = 0;
  let scheduledCount = 0;
  let totalSpeed = 0;
  let speedCount = 0;
  const boundsCoords = [];

  BUSES.forEach((bus) => {
    const tele = getBusLiveTelemetry(bus);
    if (tele.status === "enroute") {
      enrouteCount++;
      totalSpeed += tele.speed;
      speedCount++;
    } else if (tele.status === "scheduled") {
      scheduledCount++;
    }

    const pos = getBusCoordinates(bus, tele);
    boundsCoords.push([pos.lat, pos.lng]);

    // Check filter
    const visible =
      activeGpsFilter === "all" ||
      (activeGpsFilter === "enroute" && tele.status === "enroute") ||
      (activeGpsFilter === "scheduled" && tele.status === "scheduled");

    let marker = busMarkers.get(bus.id);
    if (!marker) {
      marker = L.marker([pos.lat, pos.lng], {
        icon: createBusIcon(bus, tele, pos.bearing),
        title: `Bus ${bus.id}: ${bus.from} - ${bus.to}`,
      });
      marker.bindPopup(createBusPopupContent(bus, tele));
      marker.on("popupopen", () => {
        const btn = document.querySelector(`[data-gps-book="${bus.id}"]`);
        if (btn) btn.addEventListener("click", () => openBooking(bus.id, state.date));
      });
      marker.on("click", () => {
        focusedBusId = bus.id;
        highlightFleetItem(bus.id);
      });
      if (visible) marker.addTo(liveMap);
      busMarkers.set(bus.id, marker);
    } else {
      marker.setLatLng([pos.lat, pos.lng]);
      marker.setIcon(createBusIcon(bus, tele, pos.bearing));
      marker.setPopupContent(createBusPopupContent(bus, tele));
      if (visible && !liveMap.hasLayer(marker)) {
        marker.addTo(liveMap);
      } else if (!visible && liveMap.hasLayer(marker)) {
        liveMap.removeLayer(marker);
      }
    }
  });

  // Update HUD
  if ($("hudActiveBuses")) $("hudActiveBuses").textContent = `${enrouteCount} คัน`;
  if ($("hudAvgSpeed")) $("hudAvgSpeed").textContent = `${speedCount ? Math.round(totalSpeed / speedCount) : 80} กม./ชม.`;
  if ($("gpsCountAll")) $("gpsCountAll").textContent = BUSES.length;
  if ($("gpsCountEnroute")) $("gpsCountEnroute").textContent = enrouteCount;
  if ($("gpsCountScheduled")) $("gpsCountScheduled").textContent = scheduledCount;

  renderFleetDrawer();
}

function renderFleetDrawer() {
  const listEl = $("gpsFleetList");
  if (!listEl) return;

  const filtered = BUSES.filter((b) => {
    const tele = getBusLiveTelemetry(b);
    if (activeGpsFilter === "all") return true;
    return tele.status === activeGpsFilter;
  });

  if ($("gfdCountText")) $("gfdCountText").textContent = `${filtered.length} คัน`;

  listEl.innerHTML = filtered.map((b) => {
    const tele = getBusLiveTelemetry(b);
    const statusText = tele.status === "enroute" ? "กำลังวิ่ง" : tele.status === "scheduled" ? "รอออก" : "ถึงแล้ว";
    const statusCls = tele.status;
    const isFocused = focusedBusId === b.id ? "active" : "";

    return `
      <div class="gfd-bus-item ${isFocused}" data-gfd-id="${esc(b.id)}">
        <div class="gfd-item-head">
          <span class="gfd-bus-id">FLEET #${esc(b.id)}</span>
          <span class="gfd-status ${statusCls}">${statusText}</span>
        </div>
        <div class="gfd-route">${esc(b.from)} → ${esc(b.to)}</div>
        <div class="gfd-meta-row">
          <span>พิกัด: <b>${esc(tele.currentLoc)}</b></span>
          <span class="gfd-speed">${tele.status === "enroute" ? `${tele.speed} กม./ชม.` : `${b.depart} น.`}</span>
        </div>
        <div class="gfd-progress-track">
          <div class="gfd-progress-fill" style="width:${tele.progress}%"></div>
        </div>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll("[data-gfd-id]").forEach((el) => {
    el.addEventListener("click", () => focusBusOnMap(el.dataset.gfdId));
  });
}

function highlightFleetItem(busId) {
  document.querySelectorAll(".gfd-bus-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.gfdId === busId);
    if (el.dataset.gfdId === busId) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

function focusBusOnMap(busId) {
  const bus = findBus(busId);
  if (!bus || !liveMap) return;
  focusedBusId = busId;

  const sec = $("liveGpsSection");
  if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });

  const tele = getBusLiveTelemetry(bus);
  const pos = getBusCoordinates(bus, tele);

  liveMap.flyTo([pos.lat, pos.lng], 10, { duration: 1.2 });
  const marker = busMarkers.get(busId);
  if (marker) {
    if (!liveMap.hasLayer(marker)) marker.addTo(liveMap);
    setTimeout(() => {
      marker.openPopup();
      const btn = document.querySelector(`[data-gps-book="${bus.id}"]`);
      if (btn) btn.addEventListener("click", () => openBooking(bus.id, state.date));
    }, 700);
  }
  highlightFleetItem(busId);
}

function setupGpsControls() {
  document.querySelectorAll("[data-gps-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-gps-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeGpsFilter = btn.dataset.gpsFilter || "all";
      updateLiveGpsMap();
    });
  });

  const fitBtn = $("gpsFitBoundsBtn");
  if (fitBtn) {
    fitBtn.addEventListener("click", () => {
      if (!liveMap) return;
      const coords = BUSES.map((b) => {
        const tele = getBusLiveTelemetry(b);
        const pos = getBusCoordinates(b, tele);
        return [pos.lat, pos.lng];
      });
      if (coords.length) liveMap.fitBounds(coords, { padding: [40, 40] });
    });
  }

  const toggleDrawerBtn = $("gpsToggleDrawerBtn");
  if (toggleDrawerBtn) {
    toggleDrawerBtn.addEventListener("click", () => {
      const layout = $("gpsMapLayout");
      if (layout) {
        layout.classList.toggle("drawer-collapsed");
        const collapsed = layout.classList.contains("drawer-collapsed");
        $("gpsDrawerBtnText").textContent = collapsed ? "เปิดรายการรถ" : "ซ่อนรายการรถ";
        setTimeout(() => liveMap && liveMap.invalidateSize(), 250);
      }
    });
  }

  // 3D Mode Toggle
  const toggle3dBtn = $("gps3dToggleBtn");
  if (toggle3dBtn) {
    toggle3dBtn.addEventListener("click", () => {
      set3dMode(!is3dMode);
    });
  }

  // 3D Camera Presets
  document.querySelectorAll(".g3h-btn[data-cam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setCameraPreset(btn.dataset.cam);
    });
  });

  // 3D Interactive Sliders
  const sPitch = $("sliderPitch");
  if (sPitch) {
    sPitch.addEventListener("input", () => {
      gpsPitch = Number(sPitch.value);
      apply3dCamera();
    });
  }
  const sBearing = $("sliderBearing");
  if (sBearing) {
    sBearing.addEventListener("input", () => {
      gpsBearing = Number(sBearing.value);
      apply3dCamera();
    });
  }

  // Auto-Orbit Cinematic Sweep
  const orbitBtn = $("btnAutoOrbit");
  if (orbitBtn) {
    orbitBtn.addEventListener("click", () => {
      toggleAutoOrbit();
    });
  }

  // Interactive 3D Cursor Parallax
  const stage = $("gps3dStage");
  if (stage) {
    stage.addEventListener("mousemove", (e) => {
      if (!is3dMode || isAutoOrbiting) return;
      const rect = stage.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;
      const rx = normY * -8;
      const ry = normX * 10;
      document.documentElement.style.setProperty("--gps-mouse-rx", `${rx.toFixed(1)}deg`);
      document.documentElement.style.setProperty("--gps-mouse-ry", `${ry.toFixed(1)}deg`);
    });
    stage.addEventListener("mouseleave", () => {
      document.documentElement.style.setProperty("--gps-mouse-rx", "0deg");
      document.documentElement.style.setProperty("--gps-mouse-ry", "0deg");
    });
  }
}

setInterval(() => {
  if (liveMap) updateLiveGpsMap();
}, 2500);

/* ================= TABS SWITCHING ================= */
function switchTab(name) {
  document.querySelectorAll(".nav-link").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name));

  document.querySelectorAll(".tabbar-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name));

  const tabSchedules = $("tab-schedules");
  const tabTracker = $("tab-tracker");
  const tabTickets = $("tab-tickets");

  if (tabSchedules) tabSchedules.classList.toggle("hidden", name !== "schedules");
  if (tabTracker) tabTracker.classList.toggle("hidden", name !== "tracker");
  if (tabTickets) tabTickets.classList.toggle("hidden", name !== "tickets");

  if (name === "tracker") {
    renderTrackerBoard();
    if (liveMap) setTimeout(() => liveMap.invalidateSize(), 150);
  } else if (name === "schedules") {
    if (liveMap) setTimeout(() => liveMap.invalidateSize(), 150);
  } else if (name === "tickets") {
    renderTickets();
  }
}

document.querySelectorAll(".nav-link[data-tab]").forEach((btn) =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

document.querySelectorAll(".tabbar-btn[data-tab]").forEach((btn) =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

const tabbarLookup = $("tabbarLookup");
if (tabbarLookup) {
  tabbarLookup.addEventListener("click", () => {
    switchTab("tickets");
    const el = $("lookupCode");
    if (el) { el.scrollIntoView({ behavior: "smooth" }); el.focus(); }
  });
}

/* ================= SEARCH & FILTERS ================= */
function initFilters() {
  const fromSel = $("fromSelect"), toSel = $("toSelect");
  if (fromSel && toSel) {
    fromSel.innerHTML = '<option value="">ทุกต้นทาง</option>';
    toSel.innerHTML = '<option value="">ทุกปลายทาง</option>';
    PROVINCES.forEach((p) => {
      fromSel.insertAdjacentHTML("beforeend", `<option value="${esc(p)}">${esc(p)}</option>`);
      toSel.insertAdjacentHTML("beforeend", `<option value="${esc(p)}">${esc(p)}</option>`);
    });
  }

  const paxSel = $("paxSelect");
  if (paxSel) {
    paxSel.innerHTML = "";
    [1, 2, 3, 4, 5, 6].forEach((n) =>
      paxSel.insertAdjacentHTML("beforeend", `<option value="${n}">${n} คน</option>`));
  }

  const dInput = $("dateInput");
  if (dInput) {
    dInput.value = state.date;
    dInput.min = localToday();
  }

  // Quick Date Chips
  document.querySelectorAll(".qdate-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".qdate-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const offset = Number(chip.dataset.offset || 0);
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      state.date = iso;
      if (dInput) dInput.value = iso;
      renderBuses();
    });
  });

  // Trip Type (Oneway / Roundtrip)
  document.querySelectorAll('input[name="tripType"]').forEach((r) =>
    r.addEventListener("change", () => {
      state.tripType = document.querySelector('input[name="tripType"]:checked').value;
      const rf = $("returnField");
      if (rf) rf.classList.toggle("hidden", state.tripType !== "roundtrip");
      if (state.tripType === "roundtrip") {
        const rd = $("returnDateInput");
        if (rd) {
          rd.min = $("dateInput").value || state.date;
          if (!rd.value) rd.value = rd.min;
          state.returnDate = rd.value;
        }
      }
      renderBuses();
    }));

  const retInput = $("returnDateInput");
  if (retInput) retInput.addEventListener("change", () => { state.returnDate = retInput.value; });

  const sForm = $("searchForm");
  if (sForm) {
    sForm.addEventListener("submit", (e) => {
      e.preventDefault();
      state.from = fromSel ? fromSel.value : "";
      state.to = toSel ? toSel.value : "";
      state.type = $("typeSelect") ? $("typeSelect").value : "";
      state.pax = paxSel ? parseInt(paxSel.value, 10) || 1 : 1;
      const d = $("dateInput") ? $("dateInput").value : "";
      if (!d) { showToast("กรุณาเลือกวันที่เดินทาง", true); return; }
      if (state.from && state.to && state.from === state.to) {
        showToast("ต้นทางและปลายทางต้องไม่ซ้ำกัน", true); return;
      }
      state.date = d;
      saveRecentSearch();
      renderBuses();
    });
  }

  const swapBtn = $("swapBtn");
  if (swapBtn && fromSel && toSel) {
    swapBtn.addEventListener("click", () => {
      const tmp = fromSel.value;
      fromSel.value = toSel.value;
      toSel.value = tmp;
    });
  }

  const sortSel = $("sortSelect");
  if (sortSel) {
    sortSel.addEventListener("change", () => {
      state.sortBy = sortSel.value;
      renderBuses();
    });
  }

  const resetBtn = $("resetFiltersBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (fromSel) fromSel.value = "";
      if (toSel) toSel.value = "";
      if ($("typeSelect")) $("typeSelect").value = "";
      state.from = ""; state.to = ""; state.type = "";
      renderBuses();
    });
  }

  const viewAllRoutes = $("viewAllRoutesBtn");
  if (viewAllRoutes) {
    viewAllRoutes.addEventListener("click", () => {
      if (fromSel) fromSel.value = "";
      if (toSel) toSel.value = "";
      state.from = ""; state.to = "";
      renderBuses();
      $("tab-schedules").scrollIntoView({ behavior: "smooth" });
    });
  }

  renderRecent();
}

function saveRecentSearch() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_RECENT) || "[]");
    arr.unshift({
      from: state.from, to: state.to, date: state.date,
      type: state.type, pax: state.pax,
    });
    localStorage.setItem(LS_RECENT, JSON.stringify(arr.slice(0, 4)));
  } catch {}
  renderRecent();
}

function renderRecent() {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(LS_RECENT) || "[]"); } catch {}
  const row = $("recentRow");
  if (!row) return;
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
      if ($("fromSelect")) $("fromSelect").value = r.from || "";
      if ($("toSelect")) $("toSelect").value = r.to || "";
      if ($("dateInput")) $("dateInput").value = r.date;
      if ($("typeSelect")) $("typeSelect").value = r.type || "";
      if ($("searchForm")) $("searchForm").requestSubmit();
    }));
}

function renderPopular() {
  const counts = {};
  BUSES.forEach((b) => {
    const k = b.from + "|" + b.to;
    counts[k] = counts[k] || { from: b.from, to: b.to, n: 0 };
    counts[k].n++;
  });
  const top = Object.values(counts).sort((a, b) => b.n - a.n).slice(0, 6);
  const wrap = $("popularRoutes");
  if (!wrap) return;
  wrap.innerHTML = top.map((r) =>
    `<button class="route-chip">${esc(r.from)} → ${esc(r.to)} <small>${r.n} เที่ยว/วัน</small></button>`
  ).join("");
  wrap.querySelectorAll(".route-chip").forEach((ch, i) =>
    ch.addEventListener("click", () => {
      const r = top[i];
      if ($("fromSelect")) $("fromSelect").value = r.from;
      if ($("toSelect")) $("toSelect").value = r.to;
      if ($("searchForm")) $("searchForm").requestSubmit();
    }));
}

async function loadPromoStrip() {
  const strip = $("promoStrip");
  if (!strip) return;
  try {
    const res = await fetch("/api/promos");
    const promos = await res.json();
    if (!promos.length) { strip.classList.add("hidden"); return; }
    strip.innerHTML = promos.map((p) =>
      `<span class="promo-chip">โค้ด <b>${esc(p.code)}</b> ลด ${p.percent}%</span>`
    ).join("") + `<span class="muted small">· กรอกในขั้นตอนที่ 2 เพื่อรับสิทธิ์</span>`;
    strip.classList.remove("hidden");
  } catch { strip.classList.add("hidden"); }
}

/* ================= OCCUPANCY & CAPACITY ================= */
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
  const total = TYPE_INFO[bus.type]?.seats || 40;
  const occ = getUserTaken(bus.id, date);
  return total - occ.size;
}

/* ================= RENDER BUS SCHEDULE CARDS ================= */
function busesFor(fromCity, toCity) {
  return BUSES.filter((b) =>
    (!state.type || b.type === state.type) &&
    (!fromCity || b.from === fromCity) &&
    (!toCity || b.to === toCity)
  );
}

function sortBusList(list) {
  const clone = [...list];
  if (state.sortBy === "depart_asc") {
    clone.sort((a, b) => a.depart.localeCompare(b.depart));
  } else if (state.sortBy === "price_asc") {
    clone.sort((a, b) => a.price - b.price);
  } else if (state.sortBy === "price_desc") {
    clone.sort((a, b) => b.price - a.price);
  } else if (state.sortBy === "seats_desc") {
    clone.sort((a, b) => seatsLeftOf(b, state.date) - seatsLeftOf(a, state.date));
  }
  return clone;
}

function busCardsHTML(list, date) {
  return list.map((bus, i) => {
    const info = TYPE_INFO[bus.type] || TYPE_INFO.vip;
    const left = seatsLeftOf(bus, date);
    const totalSeats = info.seats;
    const pct = Math.round((left / totalSeats) * 100);
    const tele = getBusLiveTelemetry(bus);

    const amenityTags = info.amenities.map((a) => `<span class="amenity-chip">${esc(a)}</span>`).join("");

    return `
    <article class="bus-card" style="animation-delay:${i * 0.05}s">
      <div class="bus-card-top">
        <div>
          <span class="route-name">${esc(bus.from)} → ${esc(bus.to)}</span>
          <div class="muted small" style="margin-top:2px">รหัสเที่ยวรถ <b>${bus.id}</b> · ${totalSeats} ที่นั่ง</div>
        </div>
        <span class="badge ${info.cls}">${info.label}</span>
      </div>

      <div class="time-row">
        <div class="time-col">
          <span class="time">${bus.depart}</span>
          <span class="time-lbl">เวลาออก</span>
        </div>
        <div class="arrow-line-box">
          <span class="duration-tag">${esc(bus.duration)}</span>
          <div class="arrow-track"></div>
        </div>
        <div class="time-col" style="text-align:right">
          <span class="time">${bus.arrive}</span>
          <span class="time-lbl">เวลาถึง</span>
        </div>
      </div>

      <div class="amenities-row">
        ${amenityTags}
      </div>

      <div class="seat-progress">
        <div class="seat-text">
          <span>ความพร้อมที่นั่ง: <b>${left}</b> จาก ${totalSeats} ที่</span>
          <span class="${pct < 25 ? "highlight-amber" : ""}">${pct}% ว่าง</span>
        </div>
        <div class="bar"><div class="fill ${pct < 25 ? "low" : ""}" style="width:${pct}%"></div></div>
      </div>

      <div class="bus-card-bottom">
        <div class="price">฿${bus.price.toLocaleString()} <small>/ ที่นั่ง</small></div>
        <div class="card-actions">
          <button type="button" class="btn-radar-link" data-radar="${bus.id}" title="ดูพิกัดและความคืบหน้าการเดินทาง">
            <span class="radar-dot"></span> เรดาร์สด
          </button>
          <button class="btn btn-primary" data-book="${bus.id}" data-date="${date}" ${left === 0 ? "disabled" : ""}>
            ${left === 0 ? "เต็มแล้ว" : "จองคิวรถ"}
          </button>
        </div>
      </div>
    </article>`;
  }).join("");
}

function renderBuses() {
  const wrap = $("busList");
  if (!wrap) return;
  const roundTrip = state.tripType === "roundtrip" && !!state.returnDate;

  const outbound = sortBusList(busesFor(state.from, state.to));
  const back = roundTrip ? sortBusList(busesFor(state.to, state.from)) : [];
  const totalFound = outbound.length + back.length;

  const emptyState = $("emptyState");
  if (emptyState) emptyState.classList.toggle("hidden", totalFound > 0);

  const resultsCount = $("resultsCount");
  if (resultsCount) {
    resultsCount.textContent = roundTrip
      ? `พบ ${outbound.length} เที่ยวขาไป · ${back.length} เที่ยวขากลับ`
      : `พบ ${outbound.length} เที่ยวรถ · วันเดินทาง ${fmtDate(state.date)}`;
  }

  const resultsTitle = $("resultsTitle");
  if (resultsTitle) {
    resultsTitle.textContent = state.from || state.to
      ? `${state.from || "ทุกต้นทาง"} → ${state.to || "ทุกปลายทาง"}${roundTrip ? " (ไป–กลับ)" : ""}`
      : `รอบรถทั้งหมดทั่วไทย`;
  }

  let html = "";
  if (roundTrip) {
    html += `<div class="leg-title" style="margin:16px 0 10px; font-size:18px; font-weight:700">ขาไป · ${fmtDate(state.date)}</div>
             <div class="bus-grid">${outbound.length ? busCardsHTML(outbound, state.date) : '<p class="muted">ไม่พบเที่ยวขาไป</p>'}</div>`;
    html += `<div class="leg-title" style="margin:24px 0 10px; font-size:18px; font-weight:700">ขากลับ · ${fmtDate(state.returnDate)}</div>
             <div class="bus-grid">${back.length ? busCardsHTML(back, state.returnDate) : '<p class="muted">ไม่พบเที่ยวขากลับ</p>'}</div>`;
  } else {
    html = busCardsHTML(outbound, state.date);
  }
  wrap.innerHTML = html;

  wrap.querySelectorAll("[data-book]").forEach((btn) =>
    btn.addEventListener("click", () => openBooking(btn.dataset.book, btn.dataset.date)));

  wrap.querySelectorAll("[data-radar]").forEach((btn) =>
    btn.addEventListener("click", () => {
      focusBusOnMap(btn.dataset.radar);
    }));

  renderStats(outbound);
  updateTrackerCounts();
}

function renderStats(list) {
  const totalLeft = list.reduce((s, b) => s + Math.max(0, seatsLeftOf(b, state.date)), 0);
  const myActive = bookings.filter((b) => myCodes().includes(b.code) && b.status === "active").length;
  const statsRow = $("statsRow");
  if (statsRow) {
    statsRow.innerHTML = `
      <span class="stat-chip"><b>${list.length}</b> เที่ยวรถพร้อมให้บริการ</span>
      <span class="stat-chip"><b>${totalLeft}</b> ที่นั่งว่างสะสม</span>
      <span class="stat-chip"><b>${myActive}</b> คิวที่จองไว้ของคุณ</span>`;
  }
}

/* ================= LIVE RADAR & FIDS BOARD (TAB 2) ================= */
function updateTrackerCounts() {
  let enroute = 0, scheduled = 0, arrived = 0;
  BUSES.forEach((b) => {
    const tele = getBusLiveTelemetry(b);
    if (tele.status === "enroute") enroute++;
    else if (tele.status === "scheduled") scheduled++;
    else if (tele.status === "arrived") arrived++;
  });

  if ($("trackActiveCount")) $("trackActiveCount").textContent = enroute;
  if ($("trackUpcomingCount")) $("trackUpcomingCount").textContent = scheduled;
  if ($("trackArrivedCount")) $("trackArrivedCount").textContent = arrived;

  if ($("countAllBuses")) $("countAllBuses").textContent = BUSES.length;
  if ($("countEnrouteBuses")) $("countEnrouteBuses").textContent = enroute;
  if ($("countScheduledBuses")) $("countScheduledBuses").textContent = scheduled;
  if ($("countArrivedBuses")) $("countArrivedBuses").textContent = arrived;
  if ($("trackerLiveCount")) $("trackerLiveCount").textContent = `${enroute} คันสด`;
}

function renderTrackerBoard() {
  const board = $("trackerBoard");
  if (!board) return;

  updateTrackerCounts();

  let filtered = BUSES.filter((b) => {
    const tele = getBusLiveTelemetry(b);
    if (activeTrackerFilter !== "all" && tele.status !== activeTrackerFilter) return false;
    if (trackerSearchKeyword) {
      const q = trackerSearchKeyword.toLowerCase();
      const matchId = b.id.toLowerCase().includes(q);
      const matchFrom = b.from.toLowerCase().includes(q);
      const matchTo = b.to.toLowerCase().includes(q);
      const matchLoc = tele.currentLoc.toLowerCase().includes(q);
      if (!matchId && !matchFrom && !matchTo && !matchLoc) return false;
    }
    return true;
  });

  if (!filtered.length) {
    board.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding:40px; text-align:center">
      <h3>ไม่พบเที่ยวรถในหมวดหมู่นี้</h3>
      <p class="muted">ลองเปลี่ยนตัวกรอง หรือค้นหาด้วยชื่อเมืองหรือรหัสรถคันอื่น</p>
    </div>`;
    return;
  }

  board.innerHTML = filtered.map((b) => {
    const tele = getBusLiveTelemetry(b);
    const statusCls = tele.status === "enroute" ? "status-enroute" : tele.status === "scheduled" ? "status-scheduled" : "status-arrived";

    return `
    <article class="fids-card">
      <div class="fids-head">
        <div>
          <span class="fids-bus-num">FLEET #${b.id}</span>
          <div class="fids-route-title">${esc(b.from)} → ${esc(b.to)}</div>
        </div>
        <span class="fids-status-pill ${statusCls}">
          <span class="radar-dot"></span> ${tele.statusLabel}
        </span>
      </div>

      <div class="fids-progress-box">
        <div class="fpb-times">
          <span>ออกเดินทาง <b>${b.depart}</b></span>
          <span>ถึงปลายทาง <b>${b.arrive}</b></span>
        </div>
        <div class="fpb-bar-shell">
          <div class="fpb-bar-fill" style="width: ${tele.progress}%">
            <div class="fpb-bus-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
            </div>
          </div>
        </div>
        <div class="fpb-location-row">
          <span>พิกัดล่าสุด: <b class="highlight-cyan">${esc(tele.currentLoc)}</b></span>
          <span>ความคืบหน้า <b>${tele.progress}%</b></span>
        </div>
      </div>

      <div class="fids-foot">
        <span class="fids-speed-tag">
          ${tele.status === "enroute" ? `ความเร็ว <b>${tele.speed} กม./ชม.</b>` : tele.etaText}
        </span>
        <button type="button" class="btn btn-ghost btn-sm" data-track-modal="${b.id}">
          ดูไทม์ไลน์เส้นทาง →
        </button>
      </div>
    </article>`;
  }).join("");

  board.querySelectorAll("[data-track-modal]").forEach((btn) =>
    btn.addEventListener("click", () => openJourneyModal(btn.dataset.trackModal)));
}

// Tracker Tabs & Search Filter wiring
document.querySelectorAll(".tf-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tf-tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTrackerFilter = btn.dataset.filter || "all";
    renderTrackerBoard();
  });
});

const trackerSearchInput = $("trackerSearchInput");
if (trackerSearchInput) {
  trackerSearchInput.addEventListener("input", (e) => {
    trackerSearchKeyword = e.target.value.trim();
    renderTrackerBoard();
  });
}

// Auto-refresh live radar every 10 seconds
setInterval(() => {
  const tabTracker = $("tab-tracker");
  if (tabTracker && !tabTracker.classList.contains("hidden")) {
    renderTrackerBoard();
  }
}, 10000);

/* ================= JOURNEY TIMELINE MODAL ================= */
function openJourneyModal(busId) {
  const bus = findBus(busId);
  if (!bus) return;
  const modal = $("journeyModal");
  if (!modal) return;

  const tele = getBusLiveTelemetry(bus);

  if ($("journeyBusId")) $("journeyBusId").textContent = bus.id;
  if ($("journeyTitle")) $("journeyTitle").textContent = `${bus.from} → ${bus.to}`;
  if ($("journeySub")) $("journeySub").textContent = `ออก ${bus.depart} น. · ถึง ${bus.arrive} น. (${bus.duration}) · ${tele.etaText}`;

  if ($("jSpeed")) $("jSpeed").textContent = tele.status === "enroute" ? `${tele.speed} กม./ชม.` : "0 กม./ชม.";
  if ($("jCurrentLoc")) $("jCurrentLoc").textContent = tele.currentLoc;
  if ($("jNextStop")) $("jNextStop").textContent = tele.nextStop;
  if ($("jEta")) $("jEta").textContent = bus.arrive + " น.";

  if ($("jProgressPct")) $("jProgressPct").textContent = tele.progress + "%";
  if ($("jProgressBar")) $("jProgressBar").style.width = tele.progress + "%";
  if ($("jBusMarker")) $("jBusMarker").style.left = tele.progress + "%";

  // Render stops timeline
  const stopsList = $("journeyStopsList");
  if (stopsList) {
    stopsList.innerHTML = tele.waypoints.map((station, i) => {
      let stateCls = "upcoming";
      let statusNote = "ยังไม่ถึง";
      if (i < tele.curIdx) {
        stateCls = "passed";
        statusNote = "ผ่านเรียบร้อยแล้ว";
      } else if (i === tele.curIdx) {
        stateCls = "current";
        statusNote = tele.status === "enroute" ? "กำลังเดินทางผ่านจุดนี้" : tele.status === "arrived" ? "ถึงปลายทางแล้ว" : "จุดเริ่มต้น";
      }

      return `
      <div class="timeline-stop ${stateCls}">
        <div class="stop-node"></div>
        <div class="stop-content">
          <div class="stop-name">${esc(station)}</div>
          <div class="stop-eta">${statusNote}</div>
        </div>
      </div>`;
    }).join("");
  }

  // Book this bus button wiring
  const bookBtn = $("journeyBookThisBtn");
  if (bookBtn) {
    bookBtn.onclick = () => {
      closeJourneyModal();
      openBooking(bus.id, state.date);
    };
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeJourneyModal() {
  const modal = $("journeyModal");
  if (modal) modal.classList.add("hidden");
  document.body.style.overflow = "";
}

const closeJourneyModalBtn = $("closeJourneyModal");
if (closeJourneyModalBtn) closeJourneyModalBtn.addEventListener("click", closeJourneyModal);

const closeJourneyBtn = $("closeJourneyBtn");
if (closeJourneyBtn) closeJourneyBtn.addEventListener("click", closeJourneyModal);

/* ================= BOOKING MODAL (4 STEPS) ================= */
function openBooking(busId, date) {
  const bus = findBus(busId);
  if (!bus) return;
  state.currentBusId = busId;
  state.currentDate = date || state.date;
  state.selectedSeats.clear();
  state.appliedPromo = null;

  if ($("promoCode")) $("promoCode").value = "";

  const info = TYPE_INFO[bus.type] || TYPE_INFO.vip;
  if ($("modalBusCode")) $("modalBusCode").textContent = bus.id;
  if ($("modalRoute")) $("modalRoute").textContent = `${bus.from} → ${bus.to}`;
  if ($("modalMeta")) {
    $("modalMeta").textContent = `${fmtDate(state.currentDate)} · ออก ${bus.depart} ถึง ${bus.arrive} · ${info.label} (${info.seats} ที่นั่ง)`;
  }

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
  ["stepSeats", "stepInfo", "stepPay", "stepDone"].forEach((id) => {
    const el = $(id);
    if (el) el.classList.toggle("hidden", id !== stepId);
  });

  const stepMap = { stepSeats: 1, stepInfo: 2, stepPay: 3, stepDone: 4 };
  const curNum = stepMap[stepId] || 1;

  if ($("modalStepBadge")) $("modalStepBadge").textContent = `ขั้นตอน ${curNum} จาก 4`;

  [1, 2, 3, 4].forEach((n) => {
    const p = $("pstep" + n);
    if (p) p.classList.toggle("active", n === curNum);
  });
}

function renderSeatMap() {
  const bus = findBus(state.currentBusId);
  if (!bus) return;
  const total = TYPE_INFO[bus.type]?.seats || 40;
  const occ = getUserTaken(bus.id, state.currentDate);
  const map = $("seatMap");
  if (!map) return;

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
      showToast(`จำนวนผู้โดยสาร ${state.pax} คน — คุณสามารถเลือกได้ไม่เกิน ${state.pax} ที่นั่ง`, true);
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
  if (!bus) return;
  const seats = [...state.selectedSeats].sort((a, b) => a - b);
  if ($("selCount")) $("selCount").textContent = `${seats.length}`;
  if ($("selPaxTotal")) $("selPaxTotal").textContent = state.pax;
  if ($("selSeats")) $("selSeats").textContent = seats.length ? seats.join(", ") : "–";
  if ($("selTotal")) $("selTotal").textContent = (seats.length * bus.price).toLocaleString();
  if ($("toInfoBtn")) $("toInfoBtn").disabled = seats.length === 0;

  const hint = $("paxHint");
  if (hint) {
    if (seats.length === state.pax) {
      hint.textContent = "เลือกครบแล้ว กดดำเนินการต่อได้เลย";
      hint.className = "pax-hint ok";
    } else if (seats.length < state.pax) {
      hint.textContent = `กรุณาเลือกให้ครบ ${state.pax} ที่นั่ง (เหลืออีก ${state.pax - seats.length} ที่)`;
      hint.className = "pax-hint warn";
    } else {
      hint.textContent = `เกินจำนวนผู้โดยสาร (${state.pax} คน)`;
      hint.className = "pax-hint warn";
    }
  }
}

function computeTotals() {
  const bus = findBus(state.currentBusId);
  const seats = [...state.selectedSeats].sort((a, b) => a - b);
  const gross = seats.length * (bus ? bus.price : 0);
  const pct = state.appliedPromo ? state.appliedPromo.percent : 0;
  const discount = Math.round((gross * pct) / 100);
  return { bus, seats, gross, pct, discount, net: gross - discount };
}

function refreshSummaries() {
  const t = computeTotals();
  if (!t.bus) return;
  if ($("sumRoute")) $("sumRoute").textContent = `${t.bus.from} → ${t.bus.to}`;
  if ($("sumDetail")) $("sumDetail").textContent = `${fmtDate(state.currentDate)} · ${t.bus.depart} น. · ที่นั่ง ${t.seats.join(", ")}`;
  if ($("sumTotal")) $("sumTotal").textContent = t.net.toLocaleString();

  const discLine = $("discountLine");
  if (discLine) {
    discLine.classList.toggle("hidden", t.discount === 0);
    if (t.discount > 0) {
      if ($("discountPct")) $("discountPct").textContent = `${state.appliedPromo.code} -${t.pct}%`;
      if ($("discountAmt")) $("discountAmt").textContent = t.discount.toLocaleString();
    }
  }
  if ($("qrAmount")) $("qrAmount").textContent = t.net.toLocaleString();
  if ($("payAmount")) $("payAmount").textContent = t.net.toLocaleString();
}

$("toInfoBtn").addEventListener("click", () => {
  if (state.selectedSeats.size !== state.pax) {
    showToast(`กรุณาเลือกที่นั่งให้ครบ ${state.pax} ที่นั่งตามจำนวนผู้โดยสาร`, true);
    return;
  }
  refreshSummaries();
  if (currentUser) {
    if (!$("custName").value.trim()) $("custName").value = currentUser.name;
    if (!$("custPhone").value.trim()) $("custPhone").value = currentUser.phone;
  }
  showStep("stepInfo");
});

$("backToSeats").addEventListener("click", () => showStep("stepSeats"));

$("applyPromoBtn").addEventListener("click", async () => {
  const code = $("promoCode").value.trim().toUpperCase();
  if (!code) return;
  try {
    const res = await fetch("/api/promos");
    const promos = await res.json();
    const found = promos.find((p) => p.code === code);
    if (!found) { showToast("โค้ดโปรโมชั่นไม่ถูกต้องหรือหมดอายุ", true); return; }
    state.appliedPromo = found;
    refreshSummaries();
    showToast(`ใช้โค้ด ${found.code} ลดทันที ${found.percent}%`);
  } catch {
    showToast("ไม่สามารถตรวจสอบโค้ดได้ในขณะนี้", true);
  }
});

$("confirmBtn").addEventListener("click", () => {
  const name = $("custName").value.trim();
  const phone = $("custPhone").value.replace(/[-\s]/g, "");
  if (!name) { showToast("กรุณากรอกชื่อ–นามสกุล", true); $("custName").focus(); return; }
  if (!phone || !/^0\d{8,9}$/.test(phone)) {
    showToast("กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (เช่น 0812345678)", true);
    $("custPhone").focus();
    return;
  }
  state.custName = name;
  state.custPhone = phone;
  state.custNote = $("custNote").value.trim();

  refreshSummaries();
  showStep("stepPay");
  renderPromptPayQR();
});

$("backToInfo").addEventListener("click", () => showStep("stepInfo"));

/* PROMPTPAY QR GENERATOR */
function renderPromptPayQR() {
  const t = computeTotals();
  const qrEl = $("qrImage");
  if (!qrEl) return;
  qrEl.innerHTML = "";

  const payload = `00020101021229370016A000000677010111011300668123456785802TH5303764540${String(t.net.toFixed(2)).length}${t.net.toFixed(2)}6304`;

  if (typeof QRCode !== "undefined") {
    new QRCode(qrEl, {
      text: payload,
      width: 160,
      height: 160,
      colorDark: "#000000",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.M,
    });
  } else {
    qrEl.innerHTML = '<p class="muted small">กำลังสร้างรหัส QR...</p>';
  }

  if ($("qrMerchant")) $("qrMerchant").textContent = "บริษัท บัสโก ทรานสปอร์ต เซอร์วิส จำกัด";
}

/* PAY NOW & FINALIZE BOOKING */
$("payNowBtn").addEventListener("click", async () => {
  const btn = $("payNowBtn");
  btn.disabled = true;
  btn.textContent = "กำลังประมวลผลการจอง...";

  const t = computeTotals();
  const payMethod = document.querySelector('input[name="payMethod"]:checked')?.value || "promptpay";

  const bookingPayload = {
    busId: state.currentBusId,
    date: state.currentDate,
    seats: t.seats,
    name: state.custName,
    phone: state.custPhone,
    note: state.custNote,
    payMethod,
    promoCode: state.appliedPromo ? state.appliedPromo.code : "",
  };

  let createdTicket = null;

  if (serverOnline) {
    try {
      const tok = localStorage.getItem(LS_SESSION);
      const headers = { "Content-Type": "application/json" };
      if (tok) headers["x-session"] = tok;

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers,
        body: JSON.stringify(bookingPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ไม่สามารถทำการจองได้");
      createdTicket = data;
    } catch (err) {
      showToast(err.message || "เกิดข้อผิดพลาดในการจอง", true);
      btn.disabled = false;
      btn.textContent = "ยืนยันการชำระเงินทันที";
      return;
    }
  } else {
    // Offline local fallback
    createdTicket = {
      ...bookingPayload,
      code: genCode(),
      total: t.net,
      discount: t.discount,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    showToast("บันทึกการจองในเครื่องชั่วคราว (ออฟไลน์)", true);
  }

  addMyCode(createdTicket.code);
  bookings.unshift(createdTicket);
  saveMirror();

  // Populate Boarding Pass e-Ticket
  if ($("tkCode")) $("tkCode").textContent = createdTicket.code;
  if ($("tkName")) $("tkName").textContent = state.custName;
  if ($("tkRoute")) $("tkRoute").textContent = `${t.bus.from} → ${t.bus.to}`;
  if ($("tkDateTime")) $("tkDateTime").textContent = `${fmtDate(state.currentDate)} · เวลา ${t.bus.depart} น.`;
  if ($("tkSeats")) $("tkSeats").textContent = t.seats.join(", ");
  if ($("tkPay")) $("tkPay").textContent = `${payMethod.toUpperCase()} (฿${t.net.toLocaleString()})`;

  const info = TYPE_INFO[t.bus.type] || TYPE_INFO.vip;
  if ($("tkClassPill")) $("tkClassPill").textContent = `${info.label.toUpperCase()}`;

  const tkQr = $("tkQr");
  if (tkQr) {
    tkQr.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(tkQr, {
        text: createdTicket.code,
        width: 60,
        height: 60,
        colorDark: "#000000",
        colorLight: "#FFFFFF",
      });
    }
  }

  showStep("stepDone");
  btn.disabled = false;
  btn.textContent = "ยืนยันการชำระเงินทันที";
  updateBadge();
  renderBuses();
});

$("doneClose").addEventListener("click", () => { closeModal(); renderBuses(); });
$("closeModal").addEventListener("click", () => { closeModal(); renderBuses(); });
$("viewTicketsBtn").addEventListener("click", () => {
  closeModal();
  switchTab("tickets");
});

/* ================= MY TICKETS & SEARCH CROSS-DEVICE ================= */
function updateBadge() {
  const n = bookings.filter((b) => myCodes().includes(b.code) && (b.status === "active" || b.status === "checked_in")).length;
  const badge = $("ticketBadge");
  if (badge) {
    badge.textContent = n;
    badge.classList.toggle("hidden", n === 0);
  }
  document.querySelectorAll(".js-tab-badge").forEach((el) => {
    el.textContent = n;
    el.classList.toggle("hidden", n === 0);
  });
}

function renderTickets() {
  const mine = bookings.filter((bk) => myCodes().includes(bk.code)).map(withPii);
  const wrap = $("ticketList");
  if (!wrap) return;
  const has = mine.length > 0;

  const pts = mine
    .filter((b) => b.status === "active" || b.status === "checked_in")
    .reduce((s, b) => s + Math.floor((b.total || 0) / 100), 0);

  const pb = $("pointsBar");
  if (pb) {
    pb.classList.toggle("hidden", pts === 0);
    if (pts > 0) {
      pb.innerHTML = `คะแนนสะสมของคุณ: <b>${pts} แต้ม</b> <span class="muted">(สะสม 1 แต้มทุก 100 บาท แลกส่วนลดในเที่ยวถัดไป)</span>`;
    }
  }

  const tEmpty = $("ticketEmpty");
  if (tEmpty) tEmpty.classList.toggle("hidden", has);

  wrap.innerHTML = mine.map((bk, i) => {
    const bus = findBus(bk.busId);
    const route = bus ? `${bus.from} → ${bus.to}` : "(ไม่พบข้อมูลเส้นทาง)";
    const depart = bus ? bus.depart : "—";
    const isActive = bk.status === "active";
    const isCheckedIn = bk.status === "checked_in";
    const statusCls = isCheckedIn ? "status-checkedin" : isActive ? "status-active" : "status-cancelled";
    const statusText = isCheckedIn ? "ขึ้นรถแล้ว" : isActive ? "ยืนยันแล้ว" : "ยกเลิกแล้ว";

    return `
    <article class="my-ticket ${bk.status}" style="animation-delay:${i * 0.05}s">
      <div class="bus-card-top">
        <span class="tk-route">${esc(route)}</span>
        <span class="status-pill ${statusCls}">${statusText}</span>
      </div>
      <div class="tk-info">
        รหัสตั๋ว: <b class="highlight-gold">${esc(bk.code)}</b><br />
        ${bk.name ? `ผู้โดยสาร: <b>${esc(bk.name)}</b> (โทร ${esc(bk.phone || "—")})<br />` : ""}
        วันเดินทาง: <b>${fmtDate(bk.date)}</b> · ออกรถ <b>${depart} น.</b><br />
        ที่นั่ง: <b>${bk.seats.join(", ")}</b> · ยอดรวม <b>฿${Number(bk.total || 0).toLocaleString()}</b>
        ${bk.checkedInAt ? `<br />เวลาเช็คอินขึ้นรถ: <b class="highlight-cyan">${new Date(bk.checkedInAt).toLocaleTimeString("th-TH")} น.</b>` : ""}
        ${bk.note ? `<br />หมายเหตุ: ${esc(bk.note)}` : ""}
      </div>
      <div class="my-ticket-foot">
        ${bus ? `
        <button type="button" class="btn btn-ghost btn-sm" data-radar-ticket="${bus.id}">
          <span class="radar-dot"></span> ติดตามรถคันนี้สด
        </button>` : `<span></span>`}
        ${isActive ? `<button class="cancel-link" data-cancel="${esc(bk.code)}">ยกเลิกการจอง</button>` : `<span></span>`}
      </div>
    </article>`;
  }).join("");

  wrap.querySelectorAll("[data-radar-ticket]").forEach((btn) =>
    btn.addEventListener("click", () => openJourneyModal(btn.dataset.radarTicket)));

  wrap.querySelectorAll("[data-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => cancelBooking(btn.dataset.cancel)));
}

const goBookFirstBtn = $("goBookFirstBtn");
if (goBookFirstBtn) goBookFirstBtn.addEventListener("click", () => switchTab("schedules"));

/* SEARCH TICKET CROSS DEVICE */
async function searchTicketCrossDevice(e) {
  if (e) e.preventDefault();
  const codeInput = $("lookupCode");
  const phoneInput = $("lookupPhone");
  const btn = $("lookupBtn");
  if (!codeInput || !phoneInput || !btn) return;

  const code = codeInput.value.trim().toUpperCase();
  const phone = phoneInput.value.replace(/[-\s]/g, "");

  if (!/^BG-[0-9A-F]{6,12}$/i.test(code)) {
    showToast("รูปแบบรหัสตั๋วไม่ถูกต้อง (เช่น BG-2205FB)", true);
    codeInput.focus();
    return;
  }
  if (!/^0\d{8,9}$/.test(phone)) {
    showToast("รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง", true);
    phoneInput.focus();
    return;
  }

  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "กำลังค้นหา...";

  try {
    const res = await fetch(`/api/bookings/search?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ไม่พบข้อมูลตั๋วหรือเบอร์โทรศัพท์ไม่ตรงกัน");

    const ticket = { ...data, phone };
    addMyCode(ticket.code);

    const idx = bookings.findIndex((b) => b.code === ticket.code);
    if (idx !== -1) bookings[idx] = { ...bookings[idx], ...ticket };
    else bookings.unshift(ticket);

    saveMirror();
    updateBadge();
    renderTickets();
    showToast(`พบตั๋ว ${ticket.code} และกู้คืนเรียบร้อยแล้ว`);
    codeInput.value = "";
    phoneInput.value = "";
  } catch (err) {
    showToast(err.message || "ไม่สามารถกู้คืนตั๋วได้", true);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

const lookupForm = $("lookupForm");
if (lookupForm) lookupForm.addEventListener("submit", searchTicketCrossDevice);

/* CANCEL BOOKING */
async function cancelBooking(code) {
  let bk = bookings.find((b) => b.code === code) || loadMirror().find((b) => b.code === code);
  if (!bk || bk.status !== "active") return;
  if (!confirm(`ยืนยันการยกเลิกตั๋ว ${code}?\nที่นั่ง ${bk.seats.join(", ")} จะถูกคืนสู่ระบบทันที`)) return;

  let phone = withPii(bk).phone;
  if (!phone) {
    phone = (prompt("กรุณากรอกเบอร์โทรศัพท์ที่ใช้จองเพื่อยืนยัน:") || "").replace(/[-\s]/g, "");
    if (!phone) return;
  }

  if (serverOnline) {
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(code)}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) { showToast("เบอร์โทรศัพท์ไม่ตรงกับข้อมูลการจอง", true); return; }
      if (!res.ok) { showToast(data.error || "ยกเลิกไม่สำเร็จ", true); return; }
    } catch {
      showToast("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", true);
    }
  }

  bk.status = "cancelled";
  bk.cancelledAt = new Date().toISOString();
  saveMirror();
  updateBadge();
  renderTickets();
  renderBuses();
  showToast("ยกเลิกการจองตั๋วเรียบร้อยแล้ว");
}

/* ================= AUTHENTICATION (MEMBERSHIP) ================= */
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
    if ($("tab-tickets") && !$("tab-tickets").classList.contains("hidden")) renderTickets();
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

$("authBtn").addEventListener("click", () => openAuthModal("login"));
$("authClose").addEventListener("click", closeAuthModal);
$("authTabLogin").addEventListener("click", () => switchAuthTab("login"));
$("authTabRegister").addEventListener("click", () => switchAuthTab("register"));

function bindPasswordToggle(btnId, inputId) {
  const btn = $(btnId), input = $(inputId);
  if (btn && input) {
    btn.addEventListener("click", () => {
      const isPass = input.type === "password";
      input.type = isPass ? "text" : "password";
      btn.style.color = isPass ? "var(--primary)" : "var(--muted)";
    });
  }
}
bindPasswordToggle("toggleLiPassBtn", "liPass");
bindPasswordToggle("toggleRgPassBtn", "rgPass");

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
    showToast(`ยินดีต้อนรับคุณ ${d.user.name}`);
  } catch (err) {
    showToast(err.message || "เข้าสู่ระบบไม่สำเร็จ", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "เข้าสู่ระบบทันที";
  }
});

$("authRegisterForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = $("rgPhone").value.replace(/[-\s]/g, "");
  if (!/^0\d{8,9}$/.test(phone)) { showToast("เบอร์โทรศัพท์ไม่ถูกต้อง", true); return; }
  const btn = $("registerSubmitBtn");
  btn.disabled = true;
  btn.textContent = "กำลังสร้างบัญชี...";
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
    btn.textContent = "สร้างบัญชีสมาชิก";
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
  showToast("ออกจากระบบเรียบร้อยแล้ว");
});

/* ================= DATA LOADING ================= */
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

/* ================= THEME TOGGLE ================= */
const themeToggle = $("themeToggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme;
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("busgo_theme", next); } catch {}
    if (liveMap) {
      if (next === "light") {
        if (darkTileLayer && liveMap.hasLayer(darkTileLayer)) liveMap.removeLayer(darkTileLayer);
        if (lightTileLayer && !liveMap.hasLayer(lightTileLayer)) lightTileLayer.addTo(liveMap);
      } else {
        if (lightTileLayer && liveMap.hasLayer(lightTileLayer)) liveMap.removeLayer(lightTileLayer);
        if (darkTileLayer && !liveMap.hasLayer(darkTileLayer)) darkTileLayer.addTo(liveMap);
      }
    }
  });
}

/* ================= UPDATE NOTIFIER ================= */
const UPDATE_KEY = "busgo_loaded_version";
async function checkForUpdate(first = false) {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    const data = await res.json();
    const tag = $("versionTag");
    if (tag) {
      tag.textContent = `V${data.semver} (build ${data.short}) · ระบบสดเรียลไทม์`;
    }
    const loaded = sessionStorage.getItem(UPDATE_KEY);
    if (first) {
      sessionStorage.setItem(UPDATE_KEY, data.version);
      return;
    }
    if (loaded && loaded !== data.version) {
      if ($("updateFoot")) $("updateFoot").textContent = `BUILD V${data.semver} DETECTED ON SERVER`;
      $("updateOverlay").classList.remove("hidden");
    }
  } catch {}
}
$("updateReloadBtn").addEventListener("click", () => location.reload());
setInterval(checkForUpdate, 60000);

/* ================= INITIALIZATION ================= */
initFilters();
initAuth().then(() => syncMineTickets());
loadData().then(() => {
  renderBuses();
  updateBadge();
  renderPopular();
  loadPromoStrip();
  updateTrackerCounts();
  initLiveGpsMap();
});
checkForUpdate(true);
