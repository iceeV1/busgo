-- ============================================================
-- BusGo - ระบบจองตั๋วรถบัสออนไลน์ | Database Dump (MySQL)
-- ส่งงาน: จัดทำเว็บไซต์จองตั๋ว (งานที่ 2/8)
-- สร้างจากข้อมูลจริงในระบบ ณ วันที่ 2026-08-26
-- หมายเหตุ: ระบบจริงใช้ไฟล์ JSON/Redis ไฟล์ SQL นี้จัดทำเพื่อ
--           แสดงโครงสร้างและข้อมูลฐานข้อมูลของระบบ
-- ============================================================
SET NAMES utf8mb4;

CREATE TABLE users (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  name_lower VARCHAR(80) NOT NULL UNIQUE,
  phone VARCHAR(10) NOT NULL,
  salt VARCHAR(32) NOT NULL,
  pass_hash VARCHAR(128) NOT NULL,
  created_at DATETIME
);

CREATE TABLE buses (
  id VARCHAR(20) PRIMARY KEY,
  `from` VARCHAR(100) NOT NULL,
  `to` VARCHAR(100) NOT NULL,
  depart VARCHAR(5) NOT NULL,
  arrive VARCHAR(5) NOT NULL,
  duration VARCHAR(50),
  type ENUM('vip','air','eco') NOT NULL,
  mode VARCHAR(10) DEFAULT 'bus',
  price INT NOT NULL,
  seats INT
);

CREATE TABLE bookings (
  code VARCHAR(20) PRIMARY KEY,
  bus_id VARCHAR(20),
  date DATE,
  seats VARCHAR(200),
  name VARCHAR(80),
  phone VARCHAR(10),
  promo_code VARCHAR(20) NULL,
  discount INT DEFAULT 0,
  total INT,
  pay_method VARCHAR(20) NULL,
  status ENUM('active','cancelled','checked_in') DEFAULT 'active',
  created_at DATETIME
);

CREATE TABLE promos (
  code VARCHAR(20) PRIMARY KEY,
  percent INT NOT NULL,
  active TINYINT(1) DEFAULT 1
);

-- ===== users =====

-- ===== buses =====
INSERT INTO buses VALUES ('B01', 'กรุงเทพฯ', 'เชียงใหม่', '08:00', '17:30', '9 ชม. 30 นาที', 'vip', 'bus', 850, NULL);
INSERT INTO buses VALUES ('B02', 'กรุงเทพฯ', 'เชียงใหม่', '21:00', '06:30', '9 ชม. 30 นาที', 'air', 'bus', 620, NULL);
INSERT INTO buses VALUES ('B03', 'กรุงเทพฯ', 'ภูเก็ต', '09:30', '20:00', '10 ชม. 30 นาที', 'air', 'bus', 720, NULL);
INSERT INTO buses VALUES ('B04', 'กรุงเทพฯ', 'ภูเก็ต', '19:00', '05:30', '10 ชม. 30 นาที', 'vip', 'bus', 950, NULL);
INSERT INTO buses VALUES ('B05', 'กรุงเทพฯ', 'ขอนแก่น', '07:00', '13:30', '6 ชม. 30 นาที', 'eco', 'bus', 380, NULL);
INSERT INTO buses VALUES ('B06', 'กรุงเทพฯ', 'นครราชสีมา', '10:00', '14:00', '4 ชม.', 'eco', 'bus', 260, NULL);
INSERT INTO buses VALUES ('B07', 'กรุงเทพฯ', 'หาดใหญ่', '18:30', '06:00', '11 ชม. 30 นาที', 'vip', 'bus', 1050, NULL);
INSERT INTO buses VALUES ('B08', 'กรุงเทพฯ', 'พัทยา', '06:30', '09:00', '2 ชม. 30 นาที', 'air', 'bus', 180, NULL);
INSERT INTO buses VALUES ('B09', 'กรุงเทพฯ', 'พัทยา', '12:00', '14:30', '2 ชม. 30 นาที', 'eco', 'bus', 150, NULL);
INSERT INTO buses VALUES ('B10', 'กรุงเทพฯ', 'สุราษฎร์ธานี', '20:00', '07:00', '11 ชม.', 'air', 'bus', 780, NULL);
INSERT INTO buses VALUES ('B11', 'กรุงเทพฯ', 'อุดรธานี', '08:30', '16:00', '7 ชม. 30 นาที', 'air', 'bus', 480, NULL);
INSERT INTO buses VALUES ('B12', 'เชียงใหม่', 'กรุงเทพฯ', '09:00', '18:30', '9 ชม. 30 นาที', 'vip', 'bus', 850, NULL);
INSERT INTO buses VALUES ('B13', 'เชียงใหม่', 'แม่ฮ่องสอน', '07:30', '12:00', '4 ชม. 30 นาที', 'eco', 'bus', 280, NULL);
INSERT INTO buses VALUES ('B14', 'ภูเก็ต', 'กรุงเทพฯ', '16:00', '02:30', '10 ชม. 30 นาที', 'air', 'bus', 700, NULL);
INSERT INTO buses VALUES ('TC1VL2', 'X', 'Y', '05:00', '06:00', '1', 'eco', 'bus', 1, 48);

-- ===== bookings =====
INSERT INTO bookings VALUES ('BG-2205FB', 'B01', '2026-08-27', '1,2', 'TestUser', '0999999999', NULL, 0, 1700, NULL, 'active', '2026-08-26 13:14:17');
INSERT INTO bookings VALUES ('BG-EFCACE', 'B02', '2026-09-01', '10', 'ConcurrencyTest', '0988887777', NULL, 0, 620, NULL, 'active', '2026-08-26 13:34:30');
INSERT INTO bookings VALUES ('BG-4AC897', 'B03', '2026-09-02', '20,21', 'ConcurrencyTest', '0988887777', NULL, 0, 1440, NULL, 'active', '2026-08-26 13:34:30');
INSERT INTO bookings VALUES ('BG-00F925', 'B05', '2026-09-03', '5', 'ConcurrencyTest', '0988887777', NULL, 0, 380, NULL, 'active', '2026-08-26 13:34:30');
INSERT INTO bookings VALUES ('BG-638745', 'T88PXU', '2026-09-01', '1,2', 'สมชาย ใจดี', '0812345678', 'TEST50', 380, 380, 'promptpay', 'cancelled', '2026-08-26 15:06:43');
INSERT INTO bookings VALUES ('BG-335548', 'T88PXU', '2026-09-01', '10', 'ผู้ใช้ A', '0811111111', NULL, 0, 380, NULL, 'active', '2026-08-26 15:06:43');

-- ===== promos =====
INSERT INTO promos VALUES ('WELCOME10', 10, 1);
