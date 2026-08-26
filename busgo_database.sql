-- ============================================
-- BusGo — ระบบจองตั๋วรถบัสออนไลน์
-- ไฟล์ฐานข้อมูล (MySQL) — ส่งออกจากระบบจริง
-- สร้าง: 2026-08-26T19:55:52.176Z
-- ============================================
CREATE DATABASE IF NOT EXISTS busgo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE busgo;

-- ตารางสมาชิก
CREATE TABLE IF NOT EXISTS users (id VARCHAR(20) PRIMARY KEY, name VARCHAR(120) NOT NULL, nameLower VARCHAR(120) NOT NULL UNIQUE, phone VARCHAR(15), salt VARCHAR(64) NOT NULL, passHash VARCHAR(128) NOT NULL, createdAt DATETIME);
-- ตารางรอบรถ
CREATE TABLE IF NOT EXISTS buses (id VARCHAR(20) PRIMARY KEY, code VARCHAR(10), fromCity VARCHAR(80), toCity VARCHAR(80), departDate DATE, departTime TIME, busType VARCHAR(10), seats INT, price DECIMAL(10,2), active TINYINT(1));
-- ตารางการจอง
CREATE TABLE IF NOT EXISTS bookings (id VARCHAR(20) PRIMARY KEY, code VARCHAR(20) UNIQUE, busId VARCHAR(20), userId VARCHAR(20), name VARCHAR(120), phone VARCHAR(15), seats VARCHAR(120), total DECIMAL(10,2), status VARCHAR(15), promoCode VARCHAR(30), createdAt DATETIME, checkedInAt DATETIME NULL, cancelledAt DATETIME NULL);
-- ตารางโปรโมชั่น
CREATE TABLE IF NOT EXISTS promos (id VARCHAR(20) PRIMARY KEY, code VARCHAR(30) UNIQUE, type VARCHAR(10), value DECIMAL(10,2), active TINYINT(1), usedCount INT);

-- ข้อมูลสมาชิก (1 คน)
INSERT INTO users VALUES ('U5FE25A45', 'เทสไฟร์เบส 1787768246516', 'เทสไฟร์เบส 1787768246516', '0812345678', 'bd5657303559a59db258a11efa783b55', 'f1ebcf5065b9e4316fd9b21247a35173201434a1b32feac8f38badb26f266319bec647c5dac6dc5ac3783808745739d577b3f952231021b1ad04462b92b70897', '2026-08-26T18:17:27.311Z');

-- ข้อมูลรอบรถ (15 รอบ)
INSERT INTO buses VALUES ('B01', NULL, 'กรุงเทพฯ', 'เชียงใหม่', '', NULL, 'vip', NULL, 850, 1);
INSERT INTO buses VALUES ('B02', NULL, 'กรุงเทพฯ', 'เชียงใหม่', '', NULL, 'air', NULL, 620, 1);
INSERT INTO buses VALUES ('B03', NULL, 'กรุงเทพฯ', 'ภูเก็ต', '', NULL, 'air', NULL, 720, 1);
INSERT INTO buses VALUES ('B04', NULL, 'กรุงเทพฯ', 'ภูเก็ต', '', NULL, 'vip', NULL, 950, 1);
INSERT INTO buses VALUES ('B05', NULL, 'กรุงเทพฯ', 'ขอนแก่น', '', NULL, 'eco', NULL, 380, 1);
INSERT INTO buses VALUES ('B06', NULL, 'กรุงเทพฯ', 'นครราชสีมา', '', NULL, 'eco', NULL, 260, 1);
INSERT INTO buses VALUES ('B07', NULL, 'กรุงเทพฯ', 'หาดใหญ่', '', NULL, 'vip', NULL, 1050, 1);
INSERT INTO buses VALUES ('B08', NULL, 'กรุงเทพฯ', 'พัทยา', '', NULL, 'air', NULL, 180, 1);
INSERT INTO buses VALUES ('B09', NULL, 'กรุงเทพฯ', 'พัทยา', '', NULL, 'eco', NULL, 150, 1);
INSERT INTO buses VALUES ('B10', NULL, 'กรุงเทพฯ', 'สุราษฎร์ธานี', '', NULL, 'air', NULL, 780, 1);
INSERT INTO buses VALUES ('B11', NULL, 'กรุงเทพฯ', 'อุดรธานี', '', NULL, 'air', NULL, 480, 1);
INSERT INTO buses VALUES ('B12', NULL, 'เชียงใหม่', 'กรุงเทพฯ', '', NULL, 'vip', NULL, 850, 1);
INSERT INTO buses VALUES ('B13', NULL, 'เชียงใหม่', 'แม่ฮ่องสอน', '', NULL, 'eco', NULL, 280, 1);
INSERT INTO buses VALUES ('B14', NULL, 'ภูเก็ต', 'กรุงเทพฯ', '', NULL, 'air', NULL, 700, 1);
INSERT INTO buses VALUES ('TC1VL2', NULL, 'X', 'Y', '', NULL, 'eco', 48, 1, 1);

-- ข้อมูลการจอง (7 รายการ)
INSERT INTO bookings VALUES (NULL, 'BG-2205FB', 'B01', 'NULL', 'TestUser', '0999999999', '1/2', 1700, 'active', 'NULL', '2026-08-26T13:14:17.157Z', 'NULL', 'NULL');
INSERT INTO bookings VALUES (NULL, 'BG-EFCACE', 'B02', 'NULL', 'ConcurrencyTest', '0988887777', '10', 620, 'active', 'NULL', '2026-08-26T13:34:30.392Z', 'NULL', 'NULL');
INSERT INTO bookings VALUES (NULL, 'BG-4AC897', 'B03', 'NULL', 'ConcurrencyTest', '0988887777', '20/21', 1440, 'active', 'NULL', '2026-08-26T13:34:30.415Z', 'NULL', 'NULL');
INSERT INTO bookings VALUES (NULL, 'BG-00F925', 'B05', 'NULL', 'ConcurrencyTest', '0988887777', '5', 380, 'active', 'NULL', '2026-08-26T13:34:30.431Z', 'NULL', 'NULL');
INSERT INTO bookings VALUES (NULL, 'BG-638745', 'T88PXU', 'NULL', 'สมชาย ใจดี', '0812345678', '1/2', 380, 'cancelled', 'NULL', '2026-08-26T15:06:43.472Z', 'NULL', '2026-08-26T15:06:43.624Z');
INSERT INTO bookings VALUES (NULL, 'BG-335548', 'T88PXU', 'NULL', 'ผู้ใช้ A', '0811111111', '10', 380, 'active', 'NULL', '2026-08-26T15:06:43.640Z', 'NULL', 'NULL');
INSERT INTO bookings VALUES (NULL, 'BG-48661B', 'B02', 'U5FE25A45', 'เทสไฟร์เบส 1787768246516', '0812345678', '3', 620, 'active', 'NULL', '2026-08-26T18:17:27.468Z', 'NULL', 'NULL');

-- ข้อมูลโปรโมชั่น (1 โค้ด)
INSERT INTO promos VALUES (NULL, 'WELCOME10', NULL, NULL, 1, 0);
