const ExcelJS = require('exceljs');

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function parseDateDetails(dateInput, createdAt) {
  const str = String(dateInput || createdAt || '').trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const day = isoMatch[3];
    const hr = isoMatch[4];
    const min = isoMatch[5];
    return {
      tanggal: `${day}/${String(m + 1).padStart(2, '0')}/${y}`,
      bulan: INDO_MONTHS[m] || 'September',
      tahun: y,
      waktuWita: `${hr}:${min} WITA`
    };
  }

  let parsed = new Date(str.replace(' WITA', ''));
  if (isNaN(parsed.getTime()) && createdAt) parsed = new Date(createdAt);
  if (isNaN(parsed.getTime())) parsed = new Date();

  const day = String(parsed.getDate()).padStart(2, '0');
  const monthNum = parsed.getMonth();
  const year = parsed.getFullYear();
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return {
    tanggal: `${day}/${String(monthNum + 1).padStart(2, '0')}/${year}`,
    bulan: INDO_MONTHS[monthNum] || 'September',
    tahun: year,
    waktuWita: `${hours}:${minutes} WITA`
  };
}

async function generateBbmExcelReport(transactions, options = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SPBU 74-962-29';
  workbook.lastModifiedBy = 'PT. MUHRAS USAHA ARBA';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Laporan BBM ARBA Group', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 5 }]
  });

  // 1. KOP BANNER 3 BARIS (Persis seperti Google Spreadsheet)
  worksheet.mergeCells('A1:R1');
  const cellA1 = worksheet.getCell('A1');
  cellA1.value = 'PT. MUHRAS USAHA ARBA (SPBU 74-962-29)';
  cellA1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFC00000' } };
  cellA1.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 32;

  worksheet.mergeCells('A2:R2');
  const cellA2 = worksheet.getCell('A2');
  cellA2.value = 'LAPORAN PENGISIAN BBM OPERASIONAL ARBA GROUP';
  cellA2.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0B5394' } };
  cellA2.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 26;

  worksheet.mergeCells('A3:R3');
  const cellA3 = worksheet.getCell('A3');
  cellA3.value = 'Sistem Pencatatan BBM Tempo Harian & Rekonsiliasi Pelunasan Pukul 17:00 WITA';
  cellA3.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF555555' } };
  cellA3.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(3).height = 20;

  worksheet.getRow(4).height = 12;

  // 2. HEADER TABEL SOLID PERTAMINA RED (Baris 5)
  const headers = [
    'No.', 'No. Transaksi', 'Tanggal', 'Bulan', 'Tahun', 'Waktu (WITA)',
    'No. Plat', 'Kode Alat', 'Tipe Armada', 'Nama Sopir', 'Jenis BBM',
    'Harga / Liter (Rp)', 'Volume (Liter)', 'Total Nominal (Rp)',
    'No. Struk Dispenser', 'Foto Struk', 'Status Pembayaran', 'Petugas Kasir'
  ];

  const headerRow = worksheet.getRow(5);
  headerRow.values = headers;
  headerRow.height = 34;

  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFC00000' } // Pertamina Red Solid
  };
  const headerFont = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const headerBorder = {
    top: { style: 'medium', color: { argb: 'FF800000' } },
    left: { style: 'thin', color: { argb: 'FF800000' } },
    bottom: { style: 'medium', color: { argb: 'FF800000' } },
    right: { style: 'thin', color: { argb: 'FF800000' } }
  };

  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = headerBorder;
  });

  // Lebar Kolom Proporsional (Anti Teks Terpotong)
  const colWidths = [
    7,   // A: No.
    24,  // B: No. Transaksi
    14,  // C: Tanggal
    14,  // D: Bulan
    8,   // E: Tahun
    16,  // F: Waktu (WITA)
    16,  // G: No. Plat
    14,  // H: Kode Alat
    20,  // I: Tipe Armada
    18,  // J: Nama Sopir
    12,  // K: Jenis BBM
    18,  // L: Harga / Liter
    16,  // M: Volume
    20,  // N: Total Nominal
    22,  // O: No. Struk Dispenser
    18,  // P: Foto Struk
    20,  // Q: Status Pembayaran
    16   // R: Petugas Kasir
  ];

  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  let totalActiveLiters = 0;
  let totalActiveRp = 0;

  const dataList = transactions || [];

  dataList.forEach((t, idx) => {
    const isVoid = t.is_void || t.payment_status === 'DIBATALKAN';
    const isPaid = t.payment_status === 'SUDAH DIBAYAR';
    const dateInfo = parseDateDetails(t.filling_time_wita, t.created_at);
    const liters = Number(t.liters || 0);
    const totalRp = Number(t.total_rp || 0);

    if (!isVoid) {
      totalActiveLiters += liters;
      totalActiveRp += totalRp;
    }

    const photoText = t.receipt_photo_url ? (t.receipt_no && t.receipt_no !== '-' ? `Struk: ${t.receipt_no}` : 'Foto Tersimpan') : '-';
    const paymentStatus = isVoid ? 'DIBATALKAN' : (t.payment_status || 'BELUM DIBAYAR');

    const row = worksheet.addRow([
      idx + 1,
      t.transaction_no,
      dateInfo.tanggal,
      dateInfo.bulan,
      dateInfo.tahun,
      dateInfo.waktuWita,
      t.plate_no || '-',
      t.equipment_code || '-',
      t.vehicle_type || 'TRUK DISTRIBUSI',
      t.driver_name || '-',
      t.fuel_name || 'Dexlite',
      Number(t.price_per_liter || 24200),
      liters,
      totalRp,
      String(t.receipt_no || '-'),
      photoText,
      paymentStatus,
      t.created_by || 'admin'
    ]);

    row.height = 24;

    // Formatting dan Pewarnaan per Sel (Persis Gambar 2)
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { name: 'Arial', size: 9.5 };

      // Kolom Tengah
      if ([1, 2, 3, 4, 5, 6, 7, 8, 11, 15, 16, 17, 18].includes(colNumber)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([9, 10].includes(colNumber)) {
        // Kolom Rata Kiri
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        // Kolom Angka Rata Kanan
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }

      // Format Angka Mata Uang & Desimal
      if (colNumber === 12 || colNumber === 14) {
        cell.numFmt = '"Rp "#,##0';
      } else if (colNumber === 13) {
        cell.numFmt = '#,##0.00';
      }

      // Kolom Foto Struk (Kolom P / 16) - Link Hyperlink Google Drive
      if (colNumber === 16 && t.receipt_photo_url && String(t.receipt_photo_url).startsWith('http')) {
        cell.value = {
          text: 'Lihat Struk ↗',
          hyperlink: t.receipt_photo_url
        };
        cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0B5394' }, underline: true };
      }

      // Highlight Warna Kolom Status Pembayaran (Kolom Q / 17)
      if (colNumber === 17) {
        if (isPaid) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Soft Green
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF065F46' } };
        } else if (isVoid) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Soft Red/Pink
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF991B1B' }, strike: true };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Soft Amber/Yellow
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF92400E' } };
        }
      }

      // Baris Batal (VOID) dibuat abu-abu coret
      if (isVoid && colNumber !== 17) {
        cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF94A3B8' }, strike: true };
      }
    });
  });

  // 3. BARIS TOTAL KESELURUHAN
  const summaryRowIndex = worksheet.rowCount + 1;
  worksheet.mergeCells(`A${summaryRowIndex}:L${summaryRowIndex}`);
  const summaryLabelCell = worksheet.getCell(`A${summaryRowIndex}`);
  summaryLabelCell.value = 'TOTAL KESELURUHAN';
  summaryLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
  summaryLabelCell.font = { name: 'Arial', size: 10.5, bold: true };

  const summaryLitCell = worksheet.getCell(`M${summaryRowIndex}`);
  summaryLitCell.value = totalActiveLiters;
  summaryLitCell.numFmt = '#,##0.00';
  summaryLitCell.font = { name: 'Arial', size: 10.5, bold: true };
  summaryLitCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const summaryRpCell = worksheet.getCell(`N${summaryRowIndex}`);
  summaryRpCell.value = totalActiveRp;
  summaryRpCell.numFmt = '"Rp "#,##0';
  summaryRpCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFC00000' } };
  summaryRpCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const sumRow = worksheet.getRow(summaryRowIndex);
  sumRow.height = 28;

  const sumBorder = {
    top: { style: 'thin', color: { argb: 'FF0F172A' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };
  const sumFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  sumRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = sumFill;
    cell.border = sumBorder;
  });

  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  generateBbmExcelReport
};
