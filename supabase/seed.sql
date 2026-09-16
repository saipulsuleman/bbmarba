-- ==============================================================================
-- SISTEM PENCATATAN PEMBELIAN BBM WINGS GROUP (PT. AWET SARANA SUKSES - MARISA)
-- SEED DATA: USERS, BBM (DEXLITE), & 30 KENDARAAN OPERASIONAL RESMI
-- ==============================================================================

-- 1. SEED USERS RESMI
-- Role: admin   | Password: SPBUMarisa2406
-- Role: godmode | Password: Saipul123$
INSERT INTO users (username, password_hash, role, full_name)
VALUES 
  ('admin', '$2b$10$mb05.ciTR.BLyp7sYI3DFuV.Ch5feTKjd2aZVJTWKQMRsC63wWbOu', 'admin', 'Kasir / Admin SPBU Marisa'),
  ('godmode', '$2b$10$eq2U/rlfoQfznKUfpXpgd.I0AZE4fSSSjO2BgWEh6wRNOb7sH1sXq', 'godmode', 'Owner / SPBU Godmode')
ON CONFLICT (username) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name;

-- 2. SEED MASTER BBM (DEXLITE @ Rp 24.200 / LITER)
INSERT INTO fuel_types (name, price_per_liter, is_active)
VALUES ('Dexlite', 24200, true)
ON CONFLICT DO NOTHING;

-- 3. SEED 30 KENDARAAN OPERASIONAL WINGS GROUP (PT. AWET SARANA SUKSES - MARISA)
INSERT INTO vehicles (plate_no, equipment_code, vehicle_type, notes)
VALUES
  -- 25 Truk / Equipment Distribusi
  ('DM 8324 AG', 'D221001', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8204 AL', 'D221002', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8420 AD', 'D221003', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8260 AF', 'D221004', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8202 AJ', 'D221005', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8430 AI', 'D221006', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8166 AD', 'D221007', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8166 AH', 'D221008', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8033 AH', 'D221009', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8213 AL', 'D221010', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8273 AH', 'D221011', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8241 AC', 'D221012', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8356 AC', 'D221013', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8452 AC', 'D221014', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8077 AD', 'D221015', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8201 AK', 'D221016', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8163 AK', 'D221017', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8159 AH', 'D221018', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8168 AY', 'D221019', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8167 AY', 'D221020', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8166 AY', 'D221021', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8183 AY', 'D221022', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8435 AM', 'D221023', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8510 AM', 'D221024', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 8244 AN', 'D221025', 'TRUK DISTRIBUSI', 'PT. Awet Sarana Sukses - Marisa'),
  -- 4 Mobil Operasional
  ('DM 1048 AX', 'MOBIL OPR 01', 'MOBIL OPR', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 1162 AI', 'MOBIL OPR 02', 'MOBIL OPR', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 1294 AN', 'MOBIL OPR 03', 'MOBIL OPR', 'PT. Awet Sarana Sukses - Marisa'),
  ('DM 1394 AF', 'MOBIL OPR 04', 'MOBIL OPR', 'PT. Awet Sarana Sukses - Marisa'),
  -- 1 Sepeda Motor Operasional
  ('DM 2339 RG', 'MOTOR OPR 01', 'MOTOR OPR', 'PT. Awet Sarana Sukses - Marisa')
ON CONFLICT (plate_no) DO UPDATE
SET equipment_code = EXCLUDED.equipment_code,
    vehicle_type = EXCLUDED.vehicle_type,
    notes = EXCLUDED.notes;

-- 4. SEED APP SETTINGS DEFAULT
INSERT INTO app_settings (key, value, description)
VALUES 
  ('spbu_name', 'SPBU MARISA', 'Nama unit SPBU rekanan'),
  ('client_name', 'PT. AWET SARANA SUKSES (WINGS GROUP)', 'Nama klien korporat mitra BBM'),
  ('google_sheets_webhook_url', '', 'URL Webhook Google Apps Script untuk live sync'),
  ('settlement_cutoff_time', '17:00 WITA', 'Waktu batas rekonsiliasi transfer harian')
ON CONFLICT (key) DO NOTHING;
