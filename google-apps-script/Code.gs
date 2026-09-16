/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT WEBHOOK: SPBU 74-962-29 (PT. MUHRAS USAHA ARBA / ARBA GROUP)
 * Format Laporan Pengisian BBM Operasional & Rekonsiliasi Pelunasan Pukul 17:00 WITA
 * Standar Visual: Kop Banner 3 Tingkat, Header Merah Pertamina Solid (#C00000)
 * ==============================================================================
 * 
 * PANDUAN PEMASANGAN CEPAT:
 * 1. Buka Google Spreadsheet Anda.
 * 2. Klik menu 'Extensions' (Ekstensi) -> 'Apps Script'.
 * 3. Hapus seluruh kode lama, lalu paste seluruh isi file ini.
 * 4. Klik 'Deploy' (Terapkan) -> 'New deployment' (Penerapan baru).
 * 5. Pilih jenis 'Web app' (Aplikasi web):
 *    - Execute as: Me (akun Google Anda)
 *    - Who has access: Anyone (Siapa saja)
 * 6. Klik 'Deploy' dan salin 'Web App URL' (berakhiran /exec).
 * 7. Masukkan Web App URL tersebut ke menu Pengaturan di Web App SPBU.
 */

var SPBU_NAME = "PT. MUHRAS USAHA ARBA (SPBU 74-962-29)";
var GDRIVE_ROOT_FOLDER_NAME = "PT. Awet Sarana Sukses";
var SHEET_NAME_TX = "Laporan BBM ARBA Group";
var SHEET_NAME_SETTLEMENT = "Rekap Pelunasan 17:00";
var COLOR_PERTAMINA_RED = "#C00000";
var COLOR_NAVY_TITLE = "#0B5394";
var COLOR_MUTED_GRAY = "#555555";
var COLOR_BG_AMBER = "#FEF3C7"; // Status Belum Dibayar
var COLOR_TXT_AMBER = "#92400E";
var COLOR_BG_EMERALD = "#D1FAE5"; // Status Sudah Dibayar
var COLOR_TXT_EMERALD = "#065F46";

var BULAN_INDO = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// ==============================================================================
// 1. WEBHOOK DISPATCHER (doPost & doGet)
// ==============================================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000); // Mencegah bentrok write saat transaksi bersamaan
  
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respondJson({ status: "error", message: "Payload kosong" });
    }
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Aksi: Uji Koneksi
    if (action === "TEST") {
      setupBbmTransactionSheet(ss);
      setupSettlementSheet(ss);
      return respondJson({
        status: "success",
        message: "Webhook SPBU 74-962-29 (ARBA GROUP) terhubung sukses! Template sheet aktif."
      });
    }
    
    // Aksi: Input Transaksi Pengisian BBM
    if (action === "INSERT_TRANSACTION") {
      var sheetTx = getOrCreateBbmSheet(ss);
      var driveResult = null;

      // 1. Simpan foto struk ke Google Drive (Hierarki: PT. Awet Sarana Sukses / Tahun / Bulan / Tanggal)
      var base64Data = payload.data.receipt_photo_base64 || 
        (payload.data.receipt_photo_url && String(payload.data.receipt_photo_url).startsWith("data:") ? payload.data.receipt_photo_url : null);

      if (base64Data) {
        driveResult = saveReceiptPhotoToDrive(
          base64Data,
          payload.data.plate_no,
          payload.data.filling_time_wita || payload.data.created_at,
          payload.data.transaction_no
        );
        if (driveResult && driveResult.success && driveResult.file_url) {
          payload.data.receipt_photo_url = driveResult.file_url;
          payload.data.drive_file_id = driveResult.file_id;
        }
      }

      // 2. Catat ke Spreadsheet
      appendBbmTransactionRow(sheetTx, payload.data);

      return respondJson({
        status: "success",
        message: "Transaksi " + payload.data.transaction_no + " berhasil dicatat di Spreadsheet" + (driveResult && driveResult.success ? " & Google Drive." : "."),
        drive: driveResult,
        receipt_photo_url: payload.data.receipt_photo_url
      });
    }

    // Aksi: Unggah Foto Struk Langsung ke Google Drive
    if (action === "UPLOAD_RECEIPT_TO_DRIVE") {
      var photoBase64 = payload.data.photo_base64 || payload.data.receipt_photo_base64;
      var uploadDriveRes = saveReceiptPhotoToDrive(
        photoBase64,
        payload.data.plate_no,
        payload.data.filling_time_wita || payload.data.date_time || payload.data.created_at,
        payload.data.transaction_no
      );
      return respondJson({
        status: uploadDriveRes && uploadDriveRes.success ? "success" : "error",
        data: uploadDriveRes,
        message: uploadDriveRes && uploadDriveRes.success ? "Foto struk berhasil disimpan di Google Drive." : (uploadDriveRes ? uploadDriveRes.error : "Gagal upload")
      });
    }
    
    // Aksi: Rekonsiliasi Pelunasan Batch Pukul 17:00 WITA
    if (action === "SETTLEMENT") {
      var sheetTx = getOrCreateBbmSheet(ss);
      var sheetStl = getOrCreateSettlementSheet(ss);
      updateBbmSettlement(sheetTx, sheetStl, payload.data);
      return respondJson({
        status: "success",
        message: "Pelunasan Batch 17:00 WITA berhasil diperbarui di Spreadsheet."
      });
    }

    // Aksi: Batalkan (VOID) Transaksi Pengisian BBM
    if (action === "VOID_TRANSACTION") {
      var sheetTx = getOrCreateBbmSheet(ss);
      voidBbmTransaction(sheetTx, payload.data);
      return respondJson({
        status: "success",
        message: "Transaksi " + payload.data.transaction_no + " berhasil dibatalkan (VOID) di Spreadsheet."
      });
    }

    // Aksi: Resync Seluruh Transaksi
    if (action === "RESYNC_ALL") {
      var sheetTx = getOrCreateBbmSheet(ss, true); // reset sheet
      var transactions = payload.data && payload.data.transactions ? payload.data.transactions : [];
      for (var i = 0; i < transactions.length; i++) {
        appendBbmTransactionRow(sheetTx, transactions[i], false);
      }
      refreshTotalSummaryRow(sheetTx);
      return respondJson({
        status: "success",
        message: "Berhasil menyinkronkan " + transactions.length + " transaksi ke Spreadsheet."
      });
    }

    // Aksi: Format Ulang Template Saja
    if (action === "FORMAT_TEMPLATE") {
      setupBbmTransactionSheet(ss);
      setupSettlementSheet(ss);
      return respondJson({
        status: "success",
        message: "Format template kop merah berhasil diperbarui."
      });
    }
    
    return respondJson({ status: "error", message: "Action tidak dikenali: " + action });
    
  } catch (err) {
    return respondJson({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("SPBU 74-962-29 (PT. MUHRAS USAHA ARBA / ARBA GROUP) Webhook Online.");
}

function respondJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// 2. SETUP SHEET 1: LAPORAN PENGISIAN BBM ARBA GROUP (18 KOLOM)
// ==============================================================================

function getOrCreateBbmSheet(ss, forceReset) {
  var sheet = ss.getSheetByName(SHEET_NAME_TX);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_TX);
    setupBbmTransactionSheet(ss, sheet);
  } else if (forceReset) {
    sheet.clear();
    setupBbmTransactionSheet(ss, sheet);
  }
  return sheet;
}

function setupBbmTransactionSheet(ss, targetSheet) {
  var sheet = targetSheet || ss.getSheetByName(SHEET_NAME_TX);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_TX);
  }
  
  var totalCols = 18;
  
  // 1. KOP BANNER 3 BARIS (Row 1 s/d 3)
  // Baris 1: Nama Resmi SPBU & Badan Usaha
  sheet.getRange(1, 1, 1, totalCols).merge();
  var row1 = sheet.getRange(1, 1);
  row1.setValue(SPBU_NAME);
  row1.setFontFamily("Arial");
  row1.setFontSize(14);
  row1.setFontWeight("bold");
  row1.setFontColor(COLOR_PERTAMINA_RED);
  row1.setHorizontalAlignment("center");
  row1.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 34);

  // Baris 2: Judul Laporan BBM ARBA GROUP
  sheet.getRange(2, 1, 1, totalCols).merge();
  var row2 = sheet.getRange(2, 1);
  row2.setValue("LAPORAN PENGISIAN BBM OPERASIONAL ARBA GROUP");
  row2.setFontFamily("Arial");
  row2.setFontSize(12);
  row2.setFontWeight("bold");
  row2.setFontColor(COLOR_NAVY_TITLE);
  row2.setHorizontalAlignment("center");
  row2.setVerticalAlignment("middle");
  sheet.setRowHeight(2, 28);

  // Baris 3: Subjudul Sistem & Waktu Rekonsiliasi
  sheet.getRange(3, 1, 1, totalCols).merge();
  var row3 = sheet.getRange(3, 1);
  row3.setValue("Sistem Pencatatan BBM Tempo Harian & Rekonsiliasi Pelunasan Pukul 17:00 WITA");
  row3.setFontFamily("Arial");
  row3.setFontSize(9.5);
  row3.setFontStyle("italic");
  row3.setFontColor(COLOR_MUTED_GRAY);
  row3.setHorizontalAlignment("center");
  row3.setVerticalAlignment("middle");
  sheet.setRowHeight(3, 22);

  // Baris 4: Spasi Kosong
  sheet.setRowHeight(4, 12);

  // 2. HEADER TABEL SOLID PERTAMINA RED (Baris 5)
  var headers = [
    "No.",
    "No. Transaksi",
    "Tanggal",
    "Bulan",
    "Tahun",
    "Waktu (WITA)",
    "No. Plat",
    "Kode Alat",
    "Tipe Armada",
    "Nama Sopir",
    "Jenis BBM",
    "Harga / Liter (Rp)",
    "Volume (Liter)",
    "Total Nominal (Rp)",
    "No. Struk Dispenser",
    "Foto Struk",
    "Status Pembayaran",
    "Petugas Kasir"
  ];

  var headerRange = sheet.getRange(5, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(COLOR_PERTAMINA_RED);
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  headerRange.setWrap(true);
  sheet.setRowHeight(5, 40);

  // Kunci Header (Freeze Rows 1 s/d 5)
  sheet.setFrozenRows(5);

  // Lebar Kolom Presisi (Sesuai Karakter Data)
  var colWidths = [
    45,  // A: No.
    155, // B: No. Transaksi
    95,  // C: Tanggal
    90,  // D: Bulan
    65,  // E: Tahun
    100, // F: Waktu (WITA)
    110, // G: No. Plat
    95,  // H: Kode Alat
    135, // I: Tipe Armada
    120, // J: Nama Sopir
    85,  // K: Jenis BBM
    115, // L: Harga / Liter
    115, // M: Volume Liter
    140, // N: Total Nominal Rp
    135, // O: No. Struk Dispenser
    100, // P: Foto Struk Link
    135, // Q: Status Pembayaran
    125  // R: Petugas Kasir
  ];

  for (var c = 0; c < colWidths.length; c++) {
    sheet.setColumnWidth(c + 1, colWidths[c]);
  }
}

// ==============================================================================
// 3. PENCATATAN BARIS TRANSAKSI & REFRESH TOTAL SUMMARY
// ==============================================================================

function appendBbmTransactionRow(sheet, tx, autoRefreshSummary) {
  if (autoRefreshSummary === undefined) autoRefreshSummary = true;
  
  // Cari baris terakhir data (sebelum baris TOTAL KESELURUHAN jika sudah ada)
  var summaryRowIndex = findSummaryRowIndex(sheet);
  var targetRow;
  
  if (summaryRowIndex > 0) {
    sheet.insertRowBefore(summaryRowIndex);
    targetRow = summaryRowIndex;
  } else {
    targetRow = Math.max(sheet.getLastRow() + 1, 6);
  }

  // Hitung nomor urut (data mulai dari baris 6)
  var noUrut = targetRow - 5;

  // Parsing Tanggal & Waktu Terurai
  var dateInfo = parseDateDetails(tx.filling_time_wita || tx.created_at);

    var receiptLink = "-";
    if (tx.receipt_photo_url) {
      if (String(tx.receipt_photo_url).startsWith("http")) {
        receiptLink = '=HYPERLINK("' + tx.receipt_photo_url + '"; "Lihat Struk")';
      } else {
        receiptLink = tx.receipt_no && tx.receipt_no !== '-' ? 'Struk: ' + tx.receipt_no : 'Foto Tersimpan';
      }
    }

    var rowValues = [
      noUrut,
      tx.transaction_no || ("TRX-" + new Date().getTime()),
      dateInfo.tanggal,
      dateInfo.bulan,
      dateInfo.tahun,
      dateInfo.waktuWita,
      tx.plate_no || "-",
      tx.equipment_code || "-",
      tx.vehicle_type || "TRUK DISTRIBUSI",
      tx.driver_name || "-",
      tx.fuel_name || "Dexlite",
      Number(tx.price_per_liter) || 24200,
      Number(tx.liters) || 0,
      Number(tx.total_rp) || 0,
      tx.receipt_no || "-",
      receiptLink,
      tx.payment_status || "BELUM DIBAYAR",
      tx.created_by || "Kasir"
    ];

  var range = sheet.getRange(targetRow, 1, 1, rowValues.length);
  range.setValues([rowValues]);

  // Alignment
  range.setVerticalAlignment("middle");
  sheet.getRange(targetRow, 1).setHorizontalAlignment("center"); // No.
  sheet.getRange(targetRow, 2).setHorizontalAlignment("center"); // No Transaksi
  sheet.getRange(targetRow, 3, 1, 4).setHorizontalAlignment("center"); // Tgl, Bulan, Thn, Waktu
  sheet.getRange(targetRow, 7).setHorizontalAlignment("center").setFontWeight("bold"); // No Plat
  sheet.getRange(targetRow, 8, 1, 2).setHorizontalAlignment("center"); // Kode, Tipe
  sheet.getRange(targetRow, 10).setHorizontalAlignment("left"); // Sopir
  sheet.getRange(targetRow, 11).setHorizontalAlignment("center"); // BBM
  sheet.getRange(targetRow, 12).setHorizontalAlignment("right"); // Harga/L
  sheet.getRange(targetRow, 13).setHorizontalAlignment("right"); // Liter
  sheet.getRange(targetRow, 14).setHorizontalAlignment("right"); // Nominal
  sheet.getRange(targetRow, 15, 1, 4).setHorizontalAlignment("center"); // Struk, Link, Status, Kasir

  // Number Formatting
  sheet.getRange(targetRow, 12).setNumberFormat('"Rp "#,##0'); // Harga/L
  sheet.getRange(targetRow, 13).setNumberFormat('#,##0.00'); // Volume Liter
  sheet.getRange(targetRow, 14).setNumberFormat('"Rp "#,##0'); // Total Nominal Rp

  // Styling Status Pembayaran
  applyStatusStyle(sheet.getRange(targetRow, 17), tx.payment_status);

  // Border standar baris
  range.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(targetRow, 26);

  if (autoRefreshSummary) {
    refreshTotalSummaryRow(sheet);
  }
}

// ==============================================================================
// 4. BARIS DINAMIS "TOTAL KESELURUHAN" (AKUNTANSI DOUBLE-UNDERLINE)
// ==============================================================================

function findSummaryRowIndex(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 6) return 0;
  
  // Periksa 3 baris terbawah untuk menemukan teks 'TOTAL KESELURUHAN'
  var startCheck = Math.max(6, lastRow - 3);
  for (var r = lastRow; r >= startCheck; r--) {
    var val = sheet.getRange(r, 7).getValue().toString(); // Kolom G (No. Plat / Awal Label)
    if (val.indexOf("TOTAL KESELURUHAN") !== -1) {
      return r;
    }
  }
  return 0;
}

function refreshTotalSummaryRow(sheet) {
  var existingIdx = findSummaryRowIndex(sheet);
  if (existingIdx > 0) {
    sheet.deleteRow(existingIdx);
  }

  var lastDataRow = sheet.getLastRow();
  if (lastDataRow < 6) {
    return; // Belum ada baris transaksi
  }

  var summaryRow = lastDataRow + 1;
  sheet.insertRowAfter(lastDataRow);

  // Label 'TOTAL KESELURUHAN' di Kolom G s/d L (Merged)
  var labelRange = sheet.getRange(summaryRow, 7, 1, 6);
  labelRange.merge();
  labelRange.setValue("TOTAL KESELURUHAN");
  labelRange.setFontWeight("bold");
  labelRange.setHorizontalAlignment("right");
  labelRange.setVerticalAlignment("middle");
  labelRange.setFontSize(10.5);

  // Kolom M: SUM Volume Liter (Hanya baris yang tidak dibatalkan - Format Indonesia ;)
  var literSumCell = sheet.getRange(summaryRow, 13);
  literSumCell.setFormula('=SUMIF(Q6:Q' + lastDataRow + '; "<>DIBATALKAN"; M6:M' + lastDataRow + ')');
  literSumCell.setNumberFormat("#,##0.00");
  literSumCell.setFontWeight("bold");
  literSumCell.setHorizontalAlignment("right");
  literSumCell.setVerticalAlignment("middle");

  // Kolom N: SUM Total Nominal Rp (Hanya baris yang tidak dibatalkan - Format Indonesia ;)
  var rpSumCell = sheet.getRange(summaryRow, 14);
  rpSumCell.setFormula('=SUMIF(Q6:Q' + lastDataRow + '; "<>DIBATALKAN"; N6:N' + lastDataRow + ')');
  rpSumCell.setNumberFormat('"Rp "#,##0');
  rpSumCell.setFontWeight("bold");
  rpSumCell.setHorizontalAlignment("right");
  rpSumCell.setVerticalAlignment("middle");

  // Format Baris Total Akuntansi
  var summaryFullRange = sheet.getRange(summaryRow, 1, 1, 18);
  summaryFullRange.setBackground("#F8FAFC");
  summaryFullRange.setBorder(
    true, null, true, null, null, null,
    "#334155",
    SpreadsheetApp.BorderStyle.SOLID_MEDIUM
  );

  // Khusus cell nilai: Double Bottom Border (Standar Akuntansi)
  sheet.getRange(summaryRow, 13, 1, 2).setBorder(
    true, true, true, true, null, null,
    "#0F172A",
    SpreadsheetApp.BorderStyle.DOUBLE
  );

  sheet.setRowHeight(summaryRow, 32);
}

function applyStatusStyle(cell, status) {
  if (status === "SUDAH DIBAYAR" || status === "LUNAS") {
    cell.setValue("SUDAH DIBAYAR");
    cell.setBackground(COLOR_BG_EMERALD);
    cell.setFontColor(COLOR_TXT_EMERALD);
    cell.setFontWeight("bold");
    cell.setFontLine("none");
  } else if (status === "DIBATALKAN" || status === "VOID") {
    cell.setValue("DIBATALKAN");
    cell.setBackground("#FEE2E2");
    cell.setFontColor("#991B1B");
    cell.setFontWeight("bold");
  } else {
    cell.setValue("BELUM DIBAYAR");
    cell.setBackground(COLOR_BG_AMBER);
    cell.setFontColor(COLOR_TXT_AMBER);
    cell.setFontWeight("bold");
    cell.setFontLine("none");
  }
}

function voidBbmTransaction(sheet, voidData) {
  var txNo = voidData.transaction_no;
  var lastRow = sheet.getLastRow();
  if (lastRow < 6) return;

  var txRange = sheet.getRange(6, 2, lastRow - 5, 1).getValues();
  for (var i = 0; i < txRange.length; i++) {
    var currentTxNo = txRange[i][0];
    if (currentTxNo === txNo) {
      var rowIndex = i + 6;
      var statusCell = sheet.getRange(rowIndex, 17); // Kolom Q
      applyStatusStyle(statusCell, "DIBATALKAN");

      var rowRange = sheet.getRange(rowIndex, 1, 1, 18);
      rowRange.setFontLine("line-through");
      rowRange.setFontColor("#94A3B8");

      if (voidData.void_reason) {
        var noteCell = sheet.getRange(rowIndex, 10); // Kolom J: Sopir / Note
        var curVal = noteCell.getValue();
        noteCell.setValue(curVal + " [VOID: " + voidData.void_reason + "]");
      }
      break;
    }
  }

  refreshTotalSummaryRow(sheet);
}

// ==============================================================================
// 5. SETUP SHEET 2: REKAP PELUNASAN BATCH 17:00 WITA (14 KOLOM)
// ==============================================================================

function getOrCreateSettlementSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_NAME_SETTLEMENT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_SETTLEMENT);
    setupSettlementSheet(ss, sheet);
  }
  return sheet;
}

function setupSettlementSheet(ss, targetSheet) {
  var sheet = targetSheet || ss.getSheetByName(SHEET_NAME_SETTLEMENT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_SETTLEMENT);
  }

  var totalCols = 14;

  // Kop Banner Sheet 2
  sheet.getRange(1, 1, 1, totalCols).merge();
  var row1 = sheet.getRange(1, 1);
  row1.setValue(SPBU_NAME);
  row1.setFontFamily("Arial");
  row1.setFontSize(14);
  row1.setFontWeight("bold");
  row1.setFontColor(COLOR_PERTAMINA_RED);
  row1.setHorizontalAlignment("center");
  row1.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 34);

  sheet.getRange(2, 1, 1, totalCols).merge();
  var row2 = sheet.getRange(2, 1);
  row2.setValue("REKAPITULASI PELUNASAN TRANSFER BANK (PUKUL 17:00 WITA)");
  row2.setFontFamily("Arial");
  row2.setFontSize(12);
  row2.setFontWeight("bold");
  row2.setFontColor(COLOR_NAVY_TITLE);
  row2.setHorizontalAlignment("center");
  row2.setVerticalAlignment("middle");
  sheet.setRowHeight(2, 28);

  sheet.getRange(3, 1, 1, totalCols).merge();
  var row3 = sheet.getRange(3, 1);
  row3.setValue("Audit Rekonsiliasi Mutasi Bank & Piutang Harian ARBA GROUP");
  row3.setFontFamily("Arial");
  row3.setFontSize(9.5);
  row3.setFontStyle("italic");
  row3.setFontColor(COLOR_MUTED_GRAY);
  row3.setHorizontalAlignment("center");
  row3.setVerticalAlignment("middle");
  sheet.setRowHeight(3, 22);

  sheet.setRowHeight(4, 12);

  var headers = [
    "No.",
    "No. Settlement",
    "Tanggal Pelunasan",
    "Jumlah Transaksi",
    "Total Tagihan (Rp)",
    "Transfer Masuk (Rp)",
    "Selisih Mutasi (Rp)",
    "Status Selisih",
    "Bank SPBU",
    "No. Ref Mutasi",
    "Catatan Selisih",
    "Bukti Transfer",
    "Diverifikasi Oleh",
    "Waktu Verifikasi (WITA)"
  ];

  var headerRange = sheet.getRange(5, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(COLOR_PERTAMINA_RED);
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  headerRange.setWrap(true);
  sheet.setRowHeight(5, 40);

  sheet.setFrozenRows(5);

  var colWidths = [
    45,  // A: No
    155, // B: No Settlement
    110, // C: Tanggal
    110, // D: Jml Transaksi
    140, // E: Tagihan Rp
    140, // F: Transfer Rp
    130, // G: Selisih Rp
    120, // H: Status
    95,  // I: Bank
    140, // J: No Ref
    160, // K: Catatan
    110, // L: Bukti Transfer Link
    120, // M: Verifikator
    140  // N: Waktu Verifikasi
  ];

  for (var c = 0; c < colWidths.length; c++) {
    sheet.setColumnWidth(c + 1, colWidths[c]);
  }
}

// ==============================================================================
// 6. UPDATE PELUNASAN BATCH PADA SHEET 1 & CATAT DI SHEET 2
// ==============================================================================

function updateBbmSettlement(sheetTx, sheetStl, settlementData) {
  var txNumbers = settlementData.transaction_numbers || [];
  var lastRow = sheetTx.getLastRow();
  
  // 1. Update Status di Sheet 1 (Laporan Transaksi BBM)
  if (lastRow >= 6) {
    var txRange = sheetTx.getRange(6, 2, lastRow - 5, 1).getValues();
    for (var i = 0; i < txRange.length; i++) {
      var currentTxNo = txRange[i][0];
      if (txNumbers.indexOf(currentTxNo) !== -1) {
        var rowIndex = i + 6;
        var statusCell = sheetTx.getRange(rowIndex, 17); // Kolom Q: Status Pembayaran
        applyStatusStyle(statusCell, "SUDAH DIBAYAR");
      }
    }
  }

  // 2. Append Baris Baru di Sheet 2 (Rekap Pelunasan 17:00)
  var targetRow = Math.max(sheetStl.getLastRow() + 1, 6);
  var noUrut = targetRow - 5;

    var proofLink = "-";
    if (settlementData.transfer_proof_url) {
      if (String(settlementData.transfer_proof_url).startsWith("http")) {
        proofLink = '=HYPERLINK("' + settlementData.transfer_proof_url + '"; "Lihat Bukti")';
      } else {
        proofLink = "Bukti Terlampir";
      }
    }

    var rowValues = [
      noUrut,
      settlementData.settlement_no || ("SET-" + new Date().getTime()),
      settlementData.settlement_date || new Date().toISOString().slice(0, 10),
      txNumbers.length || Number(settlementData.transaction_count) || 1,
      Number(settlementData.total_transactions_amount) || 0,
      Number(settlementData.transfer_amount) || 0,
      Number(settlementData.variance_amount) || 0,
      settlementData.variance_status || "MATCH",
      settlementData.bank_name || "BCA",
      settlementData.bank_ref_no || "-",
      settlementData.variance_notes || "-",
      proofLink,
      settlementData.verified_by || "godmode",
      settlementData.verified_at || new Date().toLocaleString("id-ID")
    ];

  var range = sheetStl.getRange(targetRow, 1, 1, rowValues.length);
  range.setValues([rowValues]);
  range.setVerticalAlignment("middle");

  sheetStl.getRange(targetRow, 1, 1, 4).setHorizontalAlignment("center");
  sheetStl.getRange(targetRow, 5, 1, 3).setHorizontalAlignment("right");
  sheetStl.getRange(targetRow, 8, 1, 7).setHorizontalAlignment("center");

  sheetStl.getRange(targetRow, 5).setNumberFormat('"Rp "#,##0');
  sheetStl.getRange(targetRow, 6).setNumberFormat('"Rp "#,##0');
  sheetStl.getRange(targetRow, 7).setNumberFormat('"Rp "#,##0');

  range.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
  sheetStl.setRowHeight(targetRow, 28);
}

// ==============================================================================
// 7. HELPER: PARSER TANGGAL, BULAN, TAHUN & WAKTU INDONESIA
// ==============================================================================

function parseDateDetails(dateInput) {
  var d = new Date();
  if (dateInput) {
    var parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }

  var day = String(d.getDate()).padStart(2, '0');
  var monthNum = d.getMonth();
  var year = d.getFullYear();
  var hours = String(d.getHours()).padStart(2, '0');
  var minutes = String(d.getMinutes()).padStart(2, '0');

  return {
    tanggal: day + "/" + String(monthNum + 1).padStart(2, '0') + "/" + year,
    bulan: BULAN_INDO[monthNum],
    tahun: year,
    waktuWita: hours + ":" + minutes + " WITA"
  };
}

// ==============================================================================
// 8. MENU KUSTOM DI GOOGLE SPREADSHEET (onOpen)
// ==============================================================================

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("⚡ Menu SPBU BBM")
    .addItem("Format Ulang Tampilan Sheet (Kop Merah)", "menuFormatTemplate")
    .addItem("Perbarui Baris Total Keseluruhan", "menuRefreshSummary")
    .addSeparator()
    .addItem("Buka Sheet Rekap Pelunasan 17:00", "menuOpenSettlementSheet")
    .addToUi();
}

function menuFormatTemplate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupBbmTransactionSheet(ss);
  setupSettlementSheet(ss);
  refreshTotalSummaryRow(getOrCreateBbmSheet(ss));
  SpreadsheetApp.getUi().alert("✅ Format visual kop merah Pertamina SPBU 74-962-29 berhasil diterapkan!");
}

function menuRefreshSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  refreshTotalSummaryRow(getOrCreateBbmSheet(ss));
  SpreadsheetApp.getUi().alert("✅ Baris 'TOTAL KESELURUHAN' berhasil dihitung ulang!");
}

function menuOpenSettlementSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSettlementSheet(ss);
  ss.setActiveSheet(sheet);
}

// ==============================================================================
// 9. GOOGLE DRIVE AUTOMATION: STRUKTUR FOLDER HIERARKIS & SIMPAN FOTO STRUK
// Hierarki Folder: PT. Awet Sarana Sukses / [Tahun] / [Bulan] / [Tanggal]
// Format Nama File: [Nomor Plat] - [Tanggal Transaksi 14.00].[ext]
// Contoh: DM 1455 JG - 15 September 2026 14.00.jpg
// ==============================================================================

function saveReceiptPhotoToDrive(photoBase64, plateNo, dateInput, transactionNo) {
  if (!photoBase64 || typeof photoBase64 !== "string") {
    return { success: false, error: "Data foto base64 kosong" };
  }

  try {
    // 1. Ekstrak Data Base64 & Tentukan MIME Type
    var base64Data = photoBase64;
    var mimeType = "image/jpeg";
    var ext = "jpg";

    var match = photoBase64.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
      if (mimeType.indexOf("png") !== -1) ext = "png";
      else if (mimeType.indexOf("webp") !== -1) ext = "webp";
    }

    // 2. Parse Tanggal & Jam Transaksi Terurai
    var d = new Date();
    if (dateInput) {
      var parsed = new Date(dateInput);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }

    var day = d.getDate();
    var monthName = BULAN_INDO[d.getMonth()] || "Bulan";
    var year = d.getFullYear();
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');

    var yearStr = String(year);
    var monthStr = monthName;
    var dateStr = day + " " + monthName + " " + year; // Contoh: "15 September 2026"
    var timeFormatted = hours + "." + minutes;         // Format tanda titik: "14.00"

    // 3. Format Nama File: [Plat Mobil] - [Tanggal Transaksi] (contoh: DM 1455 JG - 15 September 2026 14.00.jpg)
    var cleanPlate = (plateNo || "KENDARAAN").trim().toUpperCase();
    var fileName = cleanPlate + " - " + dateStr + " " + timeFormatted + "." + ext;

    // Bersihkan karakter terlarang filesystem jika ada
    fileName = fileName.replace(/[/\\?%*:|"<>]/g, '-');

    // 4. Buat / Cari Hierarki Folder di Google Drive
    // Level 1: Root Folder "PT. Awet Sarana Sukses"
    var rootFolder = getOrCreateDriveFolder(DriveApp.getRootFolder(), GDRIVE_ROOT_FOLDER_NAME);
    // Level 2: Folder Tahun (misal: 2026)
    var yearFolder = getOrCreateDriveFolder(rootFolder, yearStr);
    // Level 3: Folder Bulan (misal: September)
    var monthFolder = getOrCreateDriveFolder(yearFolder, monthStr);
    // Level 4: Folder Tanggal (misal: 15 September 2026)
    var targetFolder = getOrCreateDriveFolder(monthFolder, dateStr);

    // 5. Simpan File Struk ke Folder Target
    var decodedBytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    var driveFile = targetFolder.createFile(blob);

    // 6. Atur Hak Akses agar dapat dibuka langsung dari Spreadsheet & Web App
    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      console.warn("Set sharing warning: " + shareErr.toString());
    }

    var fileId = driveFile.getId();
    var fileUrl = driveFile.getUrl();
    var directViewUrl = "https://lh3.googleusercontent.com/d/" + fileId;

    return {
      success: true,
      file_id: fileId,
      file_url: fileUrl,
      direct_url: directViewUrl,
      file_name: fileName,
      folder_path: GDRIVE_ROOT_FOLDER_NAME + "/" + yearStr + "/" + monthStr + "/" + dateStr
    };
  } catch (err) {
    console.error("Gagal menyimpan struk ke Google Drive:", err.toString());
    return {
      success: false,
      error: err.toString()
    };
  }
}

function getOrCreateDriveFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

