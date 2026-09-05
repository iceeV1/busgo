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

/* ================= SECURITY: DISABLE F12 & DEVTOOLS ON LOGIN SCREENS =================
   ป้องกันการเปิด DevTools (F12, Ctrl+Shift+I/J/C, Ctrl+U, Mac Cmd+Opt+I) ในหน้า/กล่องเข้าสู่ระบบทุกอัน
   - หน้าเข้าสู่ระบบผู้ดูแลระบบ (Admin Login Overlay)
   - ป๊อปอัปเข้าสู่ระบบ/สมัครสมาชิก (User Auth Modal) */
window.addEventListener("keydown", function (e) {
  var isLoginScreen = false;

  // 1. หน้าเข้าสู่ระบบแอดมิน
  var adminLogin = document.getElementById("loginOverlay");
  if (adminLogin && adminLogin.style.display !== "none") {
    isLoginScreen = true;
  }

  // 2. กล่องป๊อปอัปเข้าสู่ระบบ/สมัครสมาชิกของผู้ใช้
  var authModal = document.getElementById("authModal");
  if (authModal && !authModal.classList.contains("hidden")) {
    isLoginScreen = true;
  }

  if (isLoginScreen) {
    var key = e.key || "";
    var isF12 = key === "F12" || e.keyCode === 123;
    var isDevInspect = (e.ctrlKey || e.metaKey) && e.shiftKey && (key === "I" || key === "i" || key === "J" || key === "j" || key === "C" || key === "c");
    var isMacDev = e.metaKey && e.altKey && (key === "I" || key === "i" || key === "J" || key === "j" || key === "C" || key === "c" || key === "U" || key === "u");
    var isViewSource = (e.ctrlKey || e.metaKey) && (key === "U" || key === "u");

    if (isF12 || isDevInspect || isMacDev || isViewSource) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }
}, true);

// ป้องกันคลิกขวา (Context Menu -> Inspect) บนหน้าและกล่องเข้าสู่ระบบ
document.addEventListener("contextmenu", function (e) {
  var adminLogin = document.getElementById("loginOverlay");
  if (adminLogin && adminLogin.style.display !== "none" && adminLogin.contains(e.target)) {
    e.preventDefault();
    return false;
  }
  var authModal = document.getElementById("authModal");
  if (authModal && !authModal.classList.contains("hidden") && authModal.contains(e.target)) {
    e.preventDefault();
    return false;
  }
}, true);
