# Panduan Setup Google Spreadsheet & Webhook: SPBU 74-962-29 (ARBA GROUP)

Ikuti 4 langkah mudah berikut untuk menghubungkan sistem operasional BBM ke Google Spreadsheet agar **Owner SPBU**, **Direksi ARBA GROUP**, dan **Manager Operasional** dapat memantau pengisian BBM armada dan pelunasan bank secara real-time dengan tampilan kop resmi Pertamina:

---

### Langkah 1: Buat & Bagikan Spreadsheet
1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Beri nama Spreadsheet, misalnya: **`Laporan BBM ARBA Group - SPBU 74-962-29`**.
3. Klik tombol **Bagikan (Share)** di pojok kanan atas:
   * Masukkan akun Gmail **Owner / Direksi ARBA GROUP**.
   * Masukkan akun Gmail **Manager Operasional SPBU**.
   * Atur perannya sebagai **Viewer (Pelihat)** atau **Editor** sesuai kebijakan internal.

---

### Langkah 2: Pasang Script Webhook
1. Di Google Sheets tersebut, klik menu **Ekstensi (Extensions)** -> pilih **Apps Script**.
2. Hapus semua teks yang ada di jendela editor script bawaan.
3. Buka file [Code.gs](file:///c:/BBM/google-apps-script/Code.gs) di folder project ini, **salin (copy) seluruh isinya**, lalu tempel (paste) ke editor Apps Script.
4. Klik ikon **Simpan (Save)** (ikon disket).

---

### Langkah 3: Terapkan (Deploy) Sebagai Web App
1. Di pojok kanan atas Apps Script, klik tombol biru **Terapkan (Deploy)** -> pilih **Penerapan baru (New deployment)**.
2. Klik ikon gerigi (Select type) di sebelah kiri -> pilih **Aplikasi web (Web app)**.
3. Isi pengaturannya sebagai berikut:
   * **Deskripsi**: Webhook SPBU 74-962-29 (ARBA GROUP)
   * **Jalankan sebagai (Execute as)**: **Saya (Me / email Anda)**
   * **Yang memiliki akses (Who has access)**: **Siapa saja (Anyone)** *(Penting agar backend sistem web app dapat mengirim data tanpa perlu login akun Google)*
4. Klik tombol **Terapkan (Deploy)**.
5. Jika muncul permintaan izin (*Authorization Required*):
   * Klik *Review Permissions* -> Pilih akun Google Anda.
   * Klik *Advanced (Lanjutan)* di bawah -> Klik *Go to Untitled project (unsafe) / Buka project*.
   * Klik *Allow (Izinkan)*.
6. Setelah selesai, Anda akan mendapatkan **URL Aplikasi Web (Web App URL)** yang berakhiran `/exec`. Salin (copy) URL tersebut.

---

### Langkah 4: Hubungkan ke Web SPBU 74-962-29
1. Login ke aplikasi web SPBU sebagai **Godmode**.
2. Masuk ke tab menu **Master Data & Webhook** (Pengaturan).
3. Tempelkan URL tadi ke kolom **Google Apps Script Web App URL**.
4. Klik tombol **Simpan URL Webhook** lalu klik **Uji Koneksi Webhook**.
5. Seketika dua lembar kerja (*sheet*) otomatis terbuat dengan format resmi:
   * **`Laporan BBM ARBA Group`**: Kop banner 3 tingkat (Merah Pertamina `#C00000` & Biru Navy), header tabel solid red dengan 18 kolom data BBM murni, baris beku di baris 5, dan baris dinamis `TOTAL KESELURUHAN` (Volume Liter & Total Nominal Rp) bergaris bawah ganda akuntansi.
   * **`Rekap Pelunasan 17:00`**: Log riwayat batch transfer pelunasan bank pukul 17:00 WITA, bukti transfer, dan status selisih mutasi.
6. Klik tombol **Sinkronkan Ulang Semua Data** untuk langsung mentransfer seluruh data transaksi yang ada ke spreadsheet.

---

### ⚡ Fitur Tambahan di Google Sheets:
Setelah Anda me-refresh halaman spreadsheet, akan muncul menu baru di bilah menu atas:
* **`⚡ Menu SPBU BBM`**:
  * **Format Ulang Tampilan Sheet (Kop Merah)**: Merapikan layout, warna kop, dan lebar kolom kapan saja dengan 1-klik.
  * **Perbarui Baris Total Keseluruhan**: Menghitung ulang formula `SUM` total liter & nominal.
  * **Buka Sheet Rekap Pelunasan 17:00**: Navigasi instan ke lembar kerja riwayat transfer bank.

---

### 📂 Penyimpanan Otomatis Foto Struk ke Google Drive (PT. Awet Sarana Sukses)
Setiap transaksi pengisian BBM yang melampirkan foto struk fisik dispenser akan otomatis disimpan langsung ke **Google Drive akun Anda** dengan struktur folder berjenjang yang rapi:
```
Google Drive (My Drive Akun Anda)
└── PT. Awet Sarana Sukses/
    └── 2026/
        └── September/
            └── 15 September 2026/
                └── DM 1455 JG - 15 September 2026 14.00.jpg
```
* **Format Nama File**: `[Nomor Plat] - [Tanggal Transaksi 14.00].jpg` (Contoh: `DM 1455 JG - 15 September 2026 14.00.jpg`).
* **Pemisahan Peran**: **Spreadsheet TIDAK menyimpan gambar secara fisik** (*zero in-cell images*) agar spreadsheet tetap super cepat dan tidak membengkak. Tugas spreadsheet hanya mengambil link formula `=HYPERLINK("https://drive.google.com/..."; "Lihat Struk")` di **Kolom P**.
* **Kepemilikan Penuh (Google Drive Anda)**: Karena pada Langkah 3 Anda memilih **Execute as: Me (Saya)**, semua file fisik struk tersimpan aman di kuota Google Drive akun Anda sendiri.
* **Izin Akses Apps Script**: Saat memperbarui penerapan (*New Deployment* atau *Manage Deployment*), jika Google meminta izin otorisasi (*Google Drive permissions*), cukup klik **Review Permissions** -> **Allow (Izinkan)** agar Apps Script dapat membuat hierarki folder dan menyimpan file struk.


