"use strict";
/* ตั้งธีมก่อน CSS โหลด กันหน้าจอกระพริบ (FOUC) — ไฟล์เล็ก โหลดแบบ blocking ใน <head> */
try {
  var t = localStorage.getItem("busgo_theme");
  document.documentElement.dataset.theme = (t === "light" || t === "dark") ? t : "dark";
} catch (e) {
  document.documentElement.dataset.theme = "dark";
}
