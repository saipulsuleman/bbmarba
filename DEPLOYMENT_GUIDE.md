# PANDUAN LENGKAP DEPLOYMENT: VERCEL & SUPABASE

Sistem Pencatatan Pembelian BBM WINGS Group (PT. MUHRAS USAHA ARBA) di SPBU 74-962-29.

---

## 🚀 OPSI 1: MENJALANKAN DI KOMPUTER LOKAL (LANGSUNG AKTIF)

Aplikasi ini sudah 100% siap dijalankan secara lokal tanpa perlu konfigurasi tambahan:

1. Buka terminal/PowerShell di folder `c:\BBM`:
   ```bash
   npm start
   ```
2. Buka browser di alamat:
   ```
   http://localhost:3000
   ```
3. Akun Login Resmi:
   * **Kasir / Admin**:
     * Username: `admin`
     * Password: `SPBUMarisa2406`
   * **Owner / Godmode**:
     * Username: `godmode`
     * Password: `Saipul123$`

---

## ☁️ OPSI 2: DEPLOY KE VERCEL & SUPABASE (CLOUD 24/7)

### Langkah 1: Setup Supabase Database
1. Buat akun gratis di [supabase.com](https://supabase.com).
2. Buat Project Baru (misal: `spbu-marisa-wings`).
3. Masuk ke menu **SQL Editor** di sidebar Supabase.
4. Buka file `supabase/schema.sql` di project ini, salin seluruh isinya, lalu klik **Run** di SQL Editor Supabase.
5. Buka file `supabase/seed.sql`, salin isinya, lalu klik **Run** di SQL Editor Supabase.
   *(Ini otomatis memasukkan 30 kendaraan resmi WINGS Group dari file Excel PT. MUHRAS USAHA ARBA, tarif Dexlite Rp 24.200, dan akun login).*
6. Buka menu **Project Settings** -> **API**:
   * Salin **Project URL** (misal: `https://xyzcompany.supabase.co`).
   * Salin **anon public key**.
   * Salin **service_role key** (secret).

---

### Langkah 2: Setup Google Spreadsheet Webhook
1. Buat Google Spreadsheet baru, bagikan ke Gmail:
   * **Manager Keuangan**
   * **Manager Operasional SPBU**
2. Ikuti panduan 4 langkah pada file [PANDUAN_SETUP_SPREADSHEET.md](file:///c:/BBM/google-apps-script/PANDUAN_SETUP_SPREADSHEET.md).
3. Anda akan mendapatkan URL Webhook berakhiran `/exec`.

---

### Langkah 3: Deploy ke Vercel
1. Upload folder project ini ke repository GitHub Anda (atau gunakan Vercel CLI `npx vercel`).
2. Masuk ke [vercel.com](https://vercel.com) -> Klik **Add New Project** -> Import repository GitHub Anda.
3. Di bagian **Environment Variables**, tambahkan:
   * `SUPABASE_URL`: (URL Supabase dari Langkah 1)
   * `SUPABASE_ANON_KEY`: (Anon key dari Langkah 1)
   * `SUPABASE_SERVICE_ROLE_KEY`: (Service role key dari Langkah 1)
   * `GOOGLE_SHEETS_WEBHOOK_URL`: (URL Webhook dari Langkah 2)
   * `JWT_SECRET`: `spbu_marisa_wings_bbm_secret_key_2024_secure`
4. Klik **Deploy**!
5. Dalam hitungan detik, aplikasi Anda online dengan domain HTTPS gratis (misal: `https://spbu-marisa-bbm.vercel.app`) dan dapat langsung diakses oleh kasir SPBU via smartphone maupun owner via laptop.

---

## 📋 DAFTAR 30 ARMADA WINGS GROUP YANG TERSEDIA

Sistem telah di-seed dengan 30 armada resmi:
* 25 Unit Truk / Alat Distribusi (`D221001` s/d `D221025`)
* 4 Unit Mobil Operasional (`DM 1048 AX`, `DM 1162 AI`, `DM 1294 AN`, `DM 1394 AF`)
* 1 Unit Motor Operasional (`DM 2339 RG`)
