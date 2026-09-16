-- ==============================================================================
-- SISTEM PENCATATAN PEMBELIAN BBM WINGS GROUP (PT. AWET SARANA SUKSES - MARISA)
-- SPBU MARISA - SUPABASE DATABASE SCHEMA
-- ==============================================================================

-- 1. TABEL USERS (Autentikasi & Role)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('godmode', 'admin')),
  full_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABEL VEHICLES (Master 30 Kendaraan WINGS Group)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_no VARCHAR(20) UNIQUE NOT NULL,
  equipment_code VARCHAR(50),
  vehicle_type VARCHAR(50) DEFAULT 'TRUK',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pencarian cepat nomor plat
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_no ON vehicles(plate_no);
CREATE INDEX IF NOT EXISTS idx_vehicles_equipment_code ON vehicles(equipment_code);

-- 3. TABEL FUEL_TYPES (Master BBM: Dexlite @ Rp 24.200)
CREATE TABLE IF NOT EXISTS fuel_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  price_per_liter NUMERIC(12, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL SETTLEMENTS (Batch Rekonsiliasi Pelunasan Pukul 17:00 WITA)
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_no VARCHAR(50) UNIQUE NOT NULL,
  settlement_date DATE NOT NULL,
  total_transactions_amount NUMERIC(15, 2) NOT NULL,
  transfer_amount NUMERIC(15, 2) NOT NULL,
  variance_amount NUMERIC(15, 2) DEFAULT 0, -- Selisih (Transfer - Total Tagihan)
  variance_status VARCHAR(20) DEFAULT 'MATCH', -- 'MATCH', 'UNDERPAID', 'OVERPAID'
  variance_notes TEXT,
  bank_name VARCHAR(50),
  bank_ref_no VARCHAR(100),
  transfer_proof_url TEXT,
  verified_by VARCHAR(50) DEFAULT 'godmode',
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- 5. TABEL TRANSACTIONS (Pencatatan Pengisian BBM Harian)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_no VARCHAR(50) UNIQUE NOT NULL,
  plate_no VARCHAR(20) NOT NULL,
  equipment_code VARCHAR(50),
  vehicle_type VARCHAR(50),
  fuel_name VARCHAR(50) DEFAULT 'Dexlite',
  price_per_liter NUMERIC(12, 2) NOT NULL DEFAULT 24200,
  total_rp NUMERIC(15, 2) NOT NULL,       -- INPUT UTAMA KASIR
  liters NUMERIC(10, 2) NOT NULL,         -- HASIL KONVERSI OTOMATIS
  receipt_no VARCHAR(100),                -- No Struk Dispenser Fisik
  receipt_photo_url TEXT,                 -- Foto Struk BBM Ditahan
  driver_name VARCHAR(100),
  notes TEXT,
  filling_time_wita TIMESTAMPTZ NOT NULL, -- Waktu Pengisian (WITA GMT+8)
  payment_status VARCHAR(20) NOT NULL DEFAULT 'BELUM DIBAYAR' CHECK (payment_status IN ('BELUM DIBAYAR', 'SUDAH DIBAYAR', 'DIBATALKAN')),
  is_void BOOLEAN DEFAULT false,
  void_reason TEXT,
  voided_by VARCHAR(50),
  voided_at TIMESTAMPTZ,
  idempotency_key VARCHAR(100),
  is_registered BOOLEAN DEFAULT true,
  ownership_group VARCHAR(100) DEFAULT 'PT. ASS MARISA',
  settlement_id UUID REFERENCES settlements(id) ON DELETE SET NULL,
  created_by VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index filter laporan dan status harian
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_no ON transactions(transaction_no);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_filling_time ON transactions(filling_time_wita);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_plate_no ON transactions(plate_no);

-- 6. TABEL APP_SETTINGS (Pengaturan Aplikasi & Webhook Google Sheets)
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL AUDIT_LOGS (Log Aktivitas & Riwayat Transaksi)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_role VARCHAR(20) NOT NULL,
  username VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. STORAGE BUCKET UNTUK FOTO STRUK & BUKTI TRANSFER (Eksekusi di SQL Editor Supabase)
-- Membuat bucket public 'struk-bbm'
INSERT INTO storage.buckets (id, name, public)
VALUES ('struk-bbm', 'struk-bbm', true)
ON CONFLICT (id) DO NOTHING;

-- Policy agar foto struk bisa dibaca publik (untuk link di Google Sheets)
CREATE POLICY IF NOT EXISTS "Allow Public Read struk-bbm"
ON storage.objects FOR SELECT
USING (bucket_id = 'struk-bbm');

-- Policy agar upload bisa dilakukan oleh authenticated/anon
CREATE POLICY IF NOT EXISTS "Allow Upload struk-bbm"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'struk-bbm');
