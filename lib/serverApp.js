const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');
const sheetsWebhook = require('./sheetsWebhook');
const { generateBbmExcelReport } = require('./excelReport');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'spbu_marisa_wings_bbm_secret_key_2024_secure';

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static uploads & public folder
const uploadsDir = path.join(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem di serverless environment (Vercel)
}
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Favicon fallback handler
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'favicon.svg'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: db.isSupabaseEnabled() ? 'supabase' : 'local'
  });
});

// Multer Memory Storage Configuration (Cloud & Serverless Ready with Strict MIME Validation)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Hanya file JPG, PNG, atau WEBP yang diperbolehkan.'));
    }
  }
});

// ==========================================
// AUTH MIDDLEWARE
// ==========================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ success: false, message: 'Sesi kedaluwarsa atau tidak valid. Silakan login kembali.' });
    }
    req.user = user;
    next();
  });
}

function requireGodmode(req, res, next) {
  if (!req.user || req.user.role !== 'godmode') {
    return res.status(403).json({ success: false, message: 'Akses khusus Role Godmode / Owner.' });
  }
  next();
}

// ==========================================
// ROUTES: AUTHENTICATION
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
    }

    const user = await db.findUserByUsername(username.trim());
    if (!user) {
      return res.status(401).json({ success: false, message: 'Username tidak ditemukan.' });
    }

    // Validasi password bcrypt (dengan fallback perbandingan langsung)
    const isMatch = bcrypt.compareSync(password, user.password_hash) || (password === user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Password salah. Periksa kembali huruf besar/kecil.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: `Login berhasil sebagai ${user.role.toUpperCase()}`,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login.' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ==========================================
// ROUTES: VEHICLES & BBM
// ==========================================
app.get('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    const vehicles = await db.getVehicles();
    res.json({ success: true, data: vehicles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/vehicles', authenticateToken, requireGodmode, async (req, res) => {
  try {
    const { plate_no, equipment_code, vehicle_type, notes } = req.body;
    if (!plate_no) return res.status(400).json({ success: false, message: 'Nomor plat wajib diisi.' });
    const vehicle = await db.addVehicle({
      plate_no: plate_no.trim().toUpperCase(),
      equipment_code: (equipment_code || '').trim().toUpperCase(),
      vehicle_type: vehicle_type || 'TRUK DISTRIBUSI',
      notes: notes || 'PT. Awet Sarana Sukses - Marisa'
    });
    res.json({ success: true, data: vehicle, message: 'Armada berhasil ditambahkan.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/fuel-price', authenticateToken, async (req, res) => {
  try {
    const price = await db.getFuelPrice();
    res.json({ success: true, fuel_name: 'Dexlite', price_per_liter: price });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/fuel-price', authenticateToken, requireGodmode, async (req, res) => {
  try {
    const { price } = req.body;
    if (!price || isNaN(price)) return res.status(400).json({ success: false, message: 'Harga BBM tidak valid.' });
    const updated = await db.updateFuelPrice(price);
    res.json({ success: true, price_per_liter: updated, message: 'Harga Dexlite berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ROUTES: TRANSAKSI PENGISIAN BBM
// ==========================================
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { status, plate_no, date } = req.query;
    const transactions = await db.getTransactions({ status, plate_no, date });
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// EXPORT LAPORAN EXCEL (.XLSX) BERWARNA & TERATUR (SEPERTI GOOGLE SPREADSHEET)
// ==========================================
app.post('/api/reports/excel', authenticateToken, async (req, res) => {
  try {
    const { transaction_ids, status, plate_no, date } = req.body || {};
    let transactions = await db.getTransactions({ status, plate_no, date });

    if (Array.isArray(transaction_ids) && transaction_ids.length > 0) {
      const idSet = new Set(transaction_ids);
      transactions = transactions.filter(t => idSet.has(t.id) || idSet.has(t.transaction_no));
    }

    const buffer = await generateBbmExcelReport(transactions);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Laporan_BBM_SPBU_74_962_29_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Gagal generate excel:', error);
    res.status(500).json({ success: false, message: 'Gagal membuat file Excel: ' + error.message });
  }
});

app.get('/api/reports/excel', authenticateToken, async (req, res) => {
  try {
    const { status, plate_no, date } = req.query;
    const transactions = await db.getTransactions({ status, plate_no, date });
    const buffer = await generateBbmExcelReport(transactions);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Laporan_BBM_SPBU_74_962_29_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Gagal generate excel:', error);
    res.status(500).json({ success: false, message: 'Gagal membuat file Excel: ' + error.message });
  }
});

app.get('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const tx = await db.getTransactionById(req.params.id);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    res.json({ success: true, data: tx });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const {
      plate_no,
      equipment_code,
      vehicle_type,
      total_rp,
      receipt_no,
      receipt_photo_url,
      receipt_photo_base64,
      driver_name,
      notes,
      filling_time_wita,
      idempotency_key,
      is_registered,
      ownership_group
    } = req.body;

    if (!plate_no || !total_rp) {
      return res.status(400).json({ success: false, message: 'Nomor plat dan nominal rupiah wajib diisi.' });
    }

    // 1. Idempotency Check (Mencegah Dobel Submit Saat Jaringan Lag)
    if (idempotency_key) {
      const existingTx = await db.findTransactionByIdempotencyKey(idempotency_key);
      if (existingTx) {
        return res.json({
          success: true,
          message: `Transaksi sudah pernah tercatat (Idempotent). Status: ${existingTx.payment_status}.`,
          data: existingTx,
          is_duplicate: true
        });
      }
    }

    // 2. Duplicate Receipt Number Check
    if (receipt_no && receipt_no.trim() !== '-' && receipt_no.trim().length > 3) {
      const isDuplicate = await db.checkDuplicateReceiptNo(receipt_no.trim());
      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          message: `Nomor struk fisik "${receipt_no.trim()}" sudah pernah diinput pada transaksi lain hari ini! Mohon periksa kembali fisik struk dispenser.`
        });
      }
    }

    const pricePerLiter = await db.getFuelPrice(); // Dexlite: Rp 24.200
    const nominalRp = Number(total_rp);
    if (isNaN(nominalRp) || nominalRp <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal rupiah tidak valid.' });
    }

    // Kalkulasi volume liter otomatis (2 desimal)
    const liters = Number((nominalRp / pricePerLiter).toFixed(2));

    // Generate Nomor Transaksi: BBM-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = Math.floor(1000 + Math.random() * 9000);
    const transactionNo = `BBM-${dateStr}-${randStr}`;

    // Waktu pengisian default (WITA)
    const timeWita = filling_time_wita || new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' });

    // Status registrasi armada (PT. ASS Marisa vs Armada Luar)
    const isRegisteredBool = is_registered !== false && is_registered !== 'false';
    const finalOwnership = ownership_group || (isRegisteredBool ? 'PT. ASS MARISA' : 'ARMADA LUAR');

    const txData = {
      transaction_no: transactionNo,
      idempotency_key: idempotency_key || null,
      plate_no: plate_no.trim().toUpperCase(),
      equipment_code: equipment_code || '-',
      vehicle_type: vehicle_type || 'TRUK DISTRIBUSI',
      fuel_name: 'Dexlite',
      price_per_liter: pricePerLiter,
      total_rp: nominalRp,
      liters: liters,
      receipt_no: receipt_no || '-',
      receipt_photo_url: receipt_photo_url || null,
      receipt_photo_base64: receipt_photo_base64 || (receipt_photo_url && String(receipt_photo_url).startsWith('data:') ? receipt_photo_url : null),
      driver_name: driver_name || '-',
      notes: notes || '-',
      filling_time_wita: timeWita,
      is_registered: isRegisteredBool,
      ownership_group: finalOwnership,
      payment_status: 'BELUM DIBAYAR',
      created_by: req.user.username,
      created_at: new Date().toISOString()
    };

    const createdTx = await db.createTransaction(txData);

    // Sync ke Google Apps Script Webhook (background async: upload ke Google Drive & rekap Sheets)
    sheetsWebhook.syncNewTransaction(createdTx).catch(err => {
      console.warn('[Webhook] Sync error:', err.message);
    });

    res.json({
      success: true,
      message: `Pengisian BBM Rp ${nominalRp.toLocaleString('id-ID')} (${liters} Liter) berhasil dicatat. Status: BELUM DIBAYAR.`,
      data: createdTx
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ROUTES: PEMBATALAN (VOID) TRANSAKSI (WAJIB OTORISASI GODMODE)
// ==========================================
app.post('/api/transactions/:id/void', authenticateToken, requireGodmode, async (req, res) => {
  try {
    const { id } = req.params;
    const { void_reason } = req.body;

    if (!void_reason || void_reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Alasan pembatalan transaksi wajib diisi (minimal 3 karakter).'
      });
    }

    const voidedTx = await db.voidTransaction(id, {
      void_reason: void_reason.trim(),
      voided_by: req.user.username
    });

    // Sync status pembatalan ke Google Sheets Webhook (background async)
    sheetsWebhook.syncVoidTransaction(voidedTx).catch(err => {
      console.warn('[Webhook] Sync void error:', err.message);
    });

    res.json({
      success: true,
      message: `Transaksi ${voidedTx.transaction_no} berhasil dibatalkan (VOID) oleh ${req.user.username}.`,
      data: voidedTx
    });
  } catch (error) {
    console.error('Error voiding transaction:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// ROUTES: REKONSILIASI & PELUNASAN JAM 17:00 WITA (KHUSUS GODMODE)
// ==========================================
app.post('/api/settlements', authenticateToken, requireGodmode, async (req, res) => {
  try {
    const {
      transaction_ids,
      settlement_date,
      transfer_amount,
      bank_name,
      bank_ref_no,
      variance_notes,
      transfer_proof_url
    } = req.body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Pilih minimal 1 transaksi yang akan dilunaskan.' });
    }

    if (transfer_amount === undefined || isNaN(transfer_amount)) {
      return res.status(400).json({ success: false, message: 'Nominal transfer bank wajib diisi.' });
    }

    // Ambil seluruh transaksi terkait (hanya yang aktif & tidak dibatalkan)
    const allTx = await db.getTransactions();
    const targetTx = allTx.filter(t => !t.is_void && t.payment_status !== 'DIBATALKAN' && (transaction_ids.includes(t.id) || transaction_ids.includes(t.transaction_no)));

    if (targetTx.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi yang dipilih tidak ditemukan atau sudah dibatalkan.' });
    }

    // Hitung total akumulasi tagihan
    const totalTransactionsAmount = targetTx.reduce((sum, t) => sum + Number(t.total_rp), 0);
    const nominalTransfer = Number(transfer_amount);
    const varianceAmount = nominalTransfer - totalTransactionsAmount; // Selisih

    let varianceStatus = 'MATCH';
    if (varianceAmount < 0) varianceStatus = 'UNDERPAID'; // Kurang bayar
    if (varianceAmount > 0) varianceStatus = 'OVERPAID';  // Lebih bayar

    // Wajib ada catatan selisih jika nominal tidak pas
    if (varianceAmount !== 0 && (!variance_notes || !variance_notes.trim())) {
      return res.status(400).json({
        success: false,
        message: `Terdapat selisih nominal Rp ${Math.abs(varianceAmount).toLocaleString('id-ID')}. Harap isi Catatan Selisih.`
      });
    }

    // Buat Nomor Settlement: SET-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = Math.floor(1000 + Math.random() * 9000);
    const settlementNo = `SET-${dateStr}-${randStr}`;

    const settlementData = {
      settlement_no: settlementNo,
      settlement_date: settlement_date || now.toISOString().slice(0, 10),
      total_transactions_amount: totalTransactionsAmount,
      transfer_amount: nominalTransfer,
      variance_amount: varianceAmount,
      variance_status: varianceStatus,
      variance_notes: variance_notes || '-',
      bank_name: bank_name || 'TRANSFER BANK',
      bank_ref_no: bank_ref_no || '-',
      transfer_proof_url: transfer_proof_url || null,
      verified_by: req.user.username,
      verified_at: new Date().toISOString(),
      notes: `Pelunasan ${targetTx.length} transaksi armada ARBA Group.`
    };

    const savedSettlement = await db.createSettlement(settlementData, transaction_ids);

    // Sync perubahan status ke Google Apps Script Webhook
    sheetsWebhook.syncSettlement(savedSettlement, targetTx).catch(err => {
      console.warn('[Webhook] Sync settlement error:', err.message);
    });

    res.json({
      success: true,
      message: `Pelunasan berhasil diverifikasi! ${targetTx.length} transaksi diubah menjadi SUDAH DIBAYAR.`,
      data: savedSettlement
    });
  } catch (error) {
    console.error('Error creating settlement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/settlements', authenticateToken, requireGodmode, async (req, res) => {
  try {
    const settlements = await db.getSettlements();
    res.json({ success: true, data: settlements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ROUTES: UPLOAD FILE (STRUK BBM & BUKTI TF)
// ==========================================
app.post('/api/upload', authenticateToken, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Gagal memproses upload file.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file foto yang diunggah.' });
    }

    try {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const filename = `${req.file.fieldname || 'struk'}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
      const base64Data = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;

      // 1. Coba upload langsung ke Google Drive via Apps Script Webhook
      const plateNo = req.body.plate_no || 'STRUK';
      const fillingTime = req.body.filling_time_wita || req.body.date || new Date().toISOString();

      try {
        const driveRes = await sheetsWebhook.uploadReceiptToDrive({
          photo_base64: dataUrl,
          plate_no: plateNo,
          filling_time_wita: fillingTime,
          transaction_no: req.body.transaction_no || `UPLOAD-${Date.now()}`
        });
        if (driveRes && driveRes.success && driveRes.data && driveRes.data.file_url) {
          return res.json({
            success: true,
            file_url: driveRes.data.file_url,
            drive_file_id: driveRes.data.file_id,
            photo_base64: dataUrl,
            filename: filename,
            storage: 'google_drive',
            message: 'Foto struk berhasil disimpan di Google Drive PT. Awet Sarana Sukses.'
          });
        }
      } catch (driveErr) {
        console.warn('[Upload] Upload Google Drive via webhook dilewati/fallback:', driveErr.message);
      }

      // 2. Fallback simpan lokal ke folder uploads/ (jika writable filesystem)
      try {
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, req.file.buffer);
        const fileUrl = `/uploads/${filename}`;
        return res.json({
          success: true,
          file_url: fileUrl,
          photo_base64: dataUrl,
          filename: filename,
          storage: 'local',
          message: 'Foto struk berhasil diproses dan disimpan.'
        });
      } catch (writeErr) {
        console.warn('[Upload] Gagal menulis disk lokal (serverless read-only), beralih ke Data URL:', writeErr.message);
      }

      // 3. Fallback Data URL Base64 jika lingkungan Vercel serverless tanpa database storage
      return res.json({
        success: true,
        file_url: dataUrl,
        photo_base64: dataUrl,
        filename: filename,
        storage: 'data_url',
        message: 'Foto struk berhasil diproses secara aman (Data URL).'
      });
    } catch (error) {
      console.error('Upload exception:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
});

// Endpoint Carry-Over Balance (Piutang Berjalan ARBA Group)
app.get('/api/settlements/carry-over', authenticateToken, async (req, res) => {
  try {
    const carryOver = await db.getCarryOverBalance();
    res.json({ success: true, data: carryOver });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ROUTES: PENGATURAN & GOOGLE SHEETS WEBHOOK
// ==========================================
app.get('/api/settings', authenticateToken, requireGodmode, async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/settings', authenticateToken, requireGodmode, async (req, res) => {
  try {
    const { google_sheets_webhook_url, spbu_name, client_name } = req.body;
    if (google_sheets_webhook_url !== undefined) {
      const url = google_sheets_webhook_url.trim();
      if (url && !url.startsWith('https://')) {
        return res.status(400).json({ success: false, message: 'URL Webhook Google Sheets harus menggunakan protokol HTTPS yang aman.' });
      }
      await db.updateSetting('google_sheets_webhook_url', url);
    }
    if (spbu_name !== undefined && spbu_name.trim()) {
      await db.updateSetting('spbu_name', spbu_name.trim());
    }
    if (client_name !== undefined && client_name.trim()) {
      await db.updateSetting('client_name', client_name.trim());
    }
    res.json({ success: true, message: 'Pengaturan berhasil disimpan.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/sync/test', authenticateToken, requireGodmode, async (req, res) => {
  try {
    const { webhook_url } = req.body;
    const result = await sheetsWebhook.testConnection(webhook_url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Resync seluruh transaksi ke spreadsheet
app.post('/api/sync/all', authenticateToken, requireGodmode, async (req, res) => {
  try {
    const allTx = await db.getTransactions();
    const result = await sheetsWebhook.resyncAll(allTx);
    res.json({
      success: true,
      message: `Berhasil menyinkronkan ${allTx.length} transaksi ke Google Sheets.`,
      result: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 404 Handler khusus API
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `Endpoint API ${req.method} ${req.originalUrl} tidak ditemukan (404).` });
});

// Global Error Handling Middleware (Cegah Server Error 500 HTML Stack Trace)
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Terjadi kesalahan internal pada server (500).'
  });
});

module.exports = app;
