"use strict";
/* ตั้งธีมก่อน CSS โหลด กันหน้าจอกระพริบ (FOUC) — ไฟล์เล็ก โหลดแบบ blocking ใน <head>
   ลำดับความสำคัญ: ?theme=light|dark ทาง URL > localStorage > ค่าเริ่มต้น dark */
try {
  var q = new URLSearchParams(location.search).get("theme");
  var t = (q === "light" || q === "dark") ? q : localStorage.getItem("busgo_theme");
  document.documentElement.dataset.theme = (t === "light" || t === "dark") ? t : "dark";
} catch (e) {
  document.documentElement.dataset.theme = "dark";
}
