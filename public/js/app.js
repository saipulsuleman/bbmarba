// ==============================================================================
// SPBU MARISA x ARBA GROUP - CORE APPLICATION LOGIC
// ==============================================================================

let fuelPriceDexlite = 24200;
let registeredVehicles = [];
let allTransactions = [];
let selectedSettlementTxIds = [];

document.addEventListener('DOMContentLoaded', () => {
  initWitaClock();
  initSettlementCountdown();
  loadFuelPrice();
  loadVehicles();
  loadTransactions();
  // Set default nominal pengisian 500.000 agar langsung tampil rapi dengan format titik
  setNominal(500000);
  if (currentUser && currentUser.role === 'godmode') {
    loadSettings();
    loadSettlementHistory();
    loadCarryOverBalance();
  }
});

// ==============================================================================
// 1. LIVE CLOCK WITA (UTC+8 / ASIA/MAKASSAR)
// ==============================================================================
function initWitaClock() {
  function update() {
    const now = new Date();
    // Gunakan Intl DateTimeFormat untuk zona waktu WITA (Asia/Makassar)
    const options = {
      timeZone: 'Asia/Makassar',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    const formatter = new Intl.DateTimeFormat('id-ID', options);
    const parts = formatter.formatToParts(now);
    const getPart = (type) => parts.find(p => p.type === type)?.value || '';

    const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const timeStr = `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

    const clockEl = document.getElementById('witaTime');
    if (clockEl) clockEl.textContent = `${timeStr} WITA`;

    const fillingTimeInput = document.getElementById('fillingTimeInput');
    if (fillingTimeInput && !fillingTimeInput.dataset.custom) {
      fillingTimeInput.value = `${dateStr} ${timeStr} WITA`;
    }
  }

  update();
  setInterval(update, 1000);
}

// 1B. SETTLEMENT COUNTDOWN (17:00 WITA DEADLINE)
function initSettlementCountdown() {
  const countdownEl = document.getElementById('settlementCountdownText');
  if (!countdownEl) return;

  function update() {
    const now = new Date();
    const options = {
      timeZone: 'Asia/Makassar',
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
    const getPart = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

    const hour = getPart('hour');
    const minute = getPart('minute');
    const second = getPart('second');

    const currentSec = hour * 3600 + minute * 60 + second;
    const deadlineSec = 17 * 3600; // 17:00:00 WITA

    if (currentSec < deadlineSec) {
      const diff = deadlineSec - currentSec;
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      countdownEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      countdownEl.style.color = h === 0 ? '#f87171' : '#fbbf24';
    } else {
      countdownEl.textContent = 'WAKTU SETTLEMENT';
      countdownEl.style.color = '#34d399';
    }
  }

  update();
  setInterval(update, 1000);
}

// 1C. MONITORING PLAFON KREDIT TEMPO HARIAN (DINONAKTIFKAN)
function updateCreditLimit(unpaidAmount) {
  // Plafon kredit dinonaktifkan
}

// ==============================================================================
// 2. TAB NAVIGATION
// ==============================================================================
function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

  const targetPane = document.getElementById(tabId);
  if (targetPane) targetPane.classList.add('active');

  // Activate matching button
  const buttons = document.querySelectorAll('.nav-tab');
  buttons.forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(tabId)) {
      btn.classList.add('active');
    }
  });

  // Action hook saat tab dibuka
  if (tabId === 'transactionsTab') {
    loadTransactions();
  } else if (tabId === 'settlementTab') {
    loadUnpaidForSettlement();
    loadSettlementHistory();
    loadCarryOverBalance();
  } else if (tabId === 'reportsTab') {
    loadReportData();
  }
}

// ==============================================================================
// 3. MASTER DATA: HARGA BBM & 30 KENDARAAN ARBA
// ==============================================================================
async function loadFuelPrice() {
  try {
    const res = await fetchWithAuth('/api/fuel-price');
    const data = await res.json();
    if (data.success && data.price_per_liter) {
      fuelPriceDexlite = Number(data.price_per_liter);
      const badge = document.getElementById('dexlitePriceBadge');
      if (badge) badge.textContent = `Rp ${fuelPriceDexlite.toLocaleString('id-ID')} / Liter`;
      const settingInput = document.getElementById('settingFuelPriceInput');
      if (settingInput) settingInput.value = formatNumberWithDots(fuelPriceDexlite);
      calculateLiters();
    }
  } catch (err) {
    console.warn('Gagal memuat harga Dexlite:', err);
  }
}

async function loadVehicles() {
  try {
    const res = await fetchWithAuth('/api/vehicles');
    const data = await res.json();
    if (data.success && data.data) {
      registeredVehicles = data.data;

      // Populate Autocomplete Datalist
      const datalist = document.getElementById('vehicleDatalist');
      if (datalist) {
        datalist.innerHTML = registeredVehicles.map(v => 
          `<option value="${v.plate_no}">${v.equipment_code} (${v.vehicle_type})</option>`
        ).join('');
      }

      // Populate Master Vehicle Table
      const masterBody = document.getElementById('vehicleMasterTableBody');
      if (masterBody) {
        masterBody.innerHTML = registeredVehicles.map((v, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="font-mono" style="font-weight: 700; color: #f8fafc;">${v.plate_no}</td>
            <td class="font-mono" style="color: #38bdf8;">${v.equipment_code || '-'}</td>
            <td><span class="badge-status" style="background: rgba(2, 132, 199, 0.15); color: #38bdf8;">${v.vehicle_type || 'TRUK'}</span></td>
            <td>${v.notes || '-'}</td>
            <td><span style="color: #34d399; font-weight: 600;">Aktif</span></td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Gagal memuat kendaraan:', err);
  }
}

function handlePlateChange() {
  const plateInput = document.getElementById('plateInput');
  const eqInput = document.getElementById('equipmentCodeInput');
  const typeInput = document.getElementById('vehicleTypeInput');
  const detectInfo = document.getElementById('vehicleDetectInfo');
  const statusBadge = document.getElementById('registrationStatusBadge');
  const infoBox = document.getElementById('equipmentInfoBox');

  const rawVal = (plateInput?.value || '').trim();
  const val = rawVal.toUpperCase();
  const cleanVal = val.replace(/[^A-Z0-9]/g, '');

  if (!cleanVal) {
    if (eqInput) eqInput.value = '';
    if (typeInput) typeInput.value = 'TRUK DISTRIBUSI';
    if (detectInfo) {
      detectInfo.textContent = 'Pilih dari 30 armada terdaftar';
      detectInfo.style.color = 'var(--text-muted)';
    }
    if (statusBadge) {
      statusBadge.className = 'reg-status-badge waiting';
      statusBadge.textContent = 'Menunggu Input Plat';
    }
    if (infoBox) {
      infoBox.classList.remove('verified-active', 'alert-unregistered');
    }
    return;
  }

  const matched = registeredVehicles.find(v => {
    const cleanPlate = (v.plate_no || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    const cleanEq = (v.equipment_code || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    return cleanPlate === cleanVal || (cleanEq && cleanEq === cleanVal);
  });

  if (matched) {
    plateInput.value = matched.plate_no;
    if (eqInput) eqInput.value = `${matched.equipment_code} (${matched.vehicle_type})`;
    if (typeInput) typeInput.value = matched.vehicle_type;
    if (detectInfo) {
      detectInfo.textContent = `✅ Terdaftar: ${matched.equipment_code}`;
      detectInfo.style.color = '#34d399';
    }
    if (statusBadge) {
      statusBadge.className = 'reg-status-badge verified';
      statusBadge.innerHTML = `✓ Terverifikasi PT. ASS Marisa`;
    }
    if (infoBox) {
      infoBox.classList.remove('alert-unregistered');
      infoBox.classList.add('verified-active');
    }
  } else {
    if (eqInput) eqInput.value = 'NON-ARMADA / UMUM';
    if (typeInput) typeInput.value = 'KENDARAAN LUAR';
    if (detectInfo) {
      detectInfo.textContent = '⚠️ Plat Belum Terdaftar di Master';
      detectInfo.style.color = '#fbbf24';
    }
    if (statusBadge) {
      statusBadge.className = 'reg-status-badge unregistered';
      statusBadge.innerHTML = `⚠️ TIDAK TERDAFTAR (Armada Luar)`;
    }
    if (infoBox) {
      infoBox.classList.remove('verified-active');
      infoBox.classList.add('alert-unregistered');
    }
  }
}

// Modal Helper: Konfirmasi Armada Tidak Terdaftar (Office Hours & CEO Risk Control)
let pendingUnregisteredSubmit = false;

function closeUnregisteredModal(e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById('unregisteredConfirmModal');
  if (modal) modal.classList.remove('active');
  pendingUnregisteredSubmit = false;
}

function openUnregisteredModal(plateNo) {
  const modal = document.getElementById('unregisteredConfirmModal');
  const plateEl = document.getElementById('confirmModalPlate');
  if (plateEl) plateEl.textContent = plateNo;
  if (modal) modal.classList.add('active');
}

function confirmSaveUnregisteredTx() {
  const modal = document.getElementById('unregisteredConfirmModal');
  if (modal) modal.classList.remove('active');
  pendingUnregisteredSubmit = true;
  executeTransactionSubmit();
}

// Shortcut Quick Vehicle Chips (Office Hours - Kecepatan Kasir Lapangan)
function selectQuickVehicle(plateNo) {
  const plateInput = document.getElementById('plateInput');
  if (!plateInput) return;
  plateInput.value = plateNo;
  handlePlateChange();

  const totalRpInput = document.getElementById('totalRpInput');
  if (totalRpInput) {
    totalRpInput.focus();
  }
  showToast(`Armada ${plateNo} dipilih. Silakan isi nominal.`, 'info');
}

// ==============================================================================
// 4. KONVERSI OTOMATIS: RUPIAH -> LITER DEXLITE & FORMAT NOMINAL (MISAL: 500.000)
// ==============================================================================

// Helper: Format angka ke string bertitik pemisah ribuan (500000 -> 500.000)
function formatNumberWithDots(val) {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'number' ? val : Number(String(val).replace(/\D/g, ''));
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('id-ID');
}

// Helper: Format input currency dengan presisi kursor kustom
function formatCurrencyInputElement(input, onChangeCallback) {
  if (!input) return;
  const cursor = input.selectionStart || 0;
  const valBefore = input.value;
  const digitsBefore = (valBefore.substring(0, cursor).match(/\d/g) || []).length;

  const rawDigits = valBefore.replace(/\D/g, '');
  if (!rawDigits) {
    input.value = '';
    if (typeof onChangeCallback === 'function') onChangeCallback(0);
    return;
  }

  const num = parseInt(rawDigits, 10);
  const formatted = num.toLocaleString('id-ID');
  input.value = formatted;

  // Kembalikan posisi kursor agar nyaman saat mengetik
  let newCursor = 0;
  let digitsCounted = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      digitsCounted++;
    }
    if (digitsCounted === digitsBefore) {
      newCursor = i + 1;
      break;
    }
  }
  if (digitsCounted < digitsBefore) {
    newCursor = formatted.length;
  }
  input.setSelectionRange(newCursor, newCursor);

  if (typeof onChangeCallback === 'function') {
    onChangeCallback(num);
  }
}

// Event handler saat mengetik di input Nominal Pengisian
function handleNominalInput(input) {
  formatCurrencyInputElement(input, (amount) => {
    updateActivePresetChips(amount);
    calculateLiters();
  });
}

// Update status aktif tombol pilihan cepat
function updateActivePresetChips(amount) {
  const chips = document.querySelectorAll('.btn-preset-chip');
  chips.forEach(chip => {
    const chipAmount = Number(chip.dataset.amount) || 0;
    if (chipAmount > 0 && chipAmount === amount) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}

function calculateLiters() {
  const rpInput = document.getElementById('totalRpInput');
  const litersText = document.getElementById('calculatedLitersText');
  if (!rpInput || !litersText) return;

  const rawVal = rpInput.value.replace(/\D/g, '');
  const val = Number(rawVal) || 0;

  if (val > 0 && fuelPriceDexlite > 0) {
    const liters = (val / fuelPriceDexlite).toFixed(2);
    litersText.textContent = Number(liters).toLocaleString('id-ID', { minimumFractionDigits: 2 });
  } else {
    litersText.textContent = '0,00';
  }
}

function setNominal(amount) {
  const rpInput = document.getElementById('totalRpInput');
  if (!rpInput) return;
  rpInput.value = formatNumberWithDots(amount);
  updateActivePresetChips(amount);
  calculateLiters();
}

// ==============================================================================
// 5. UPLOAD & KOMPRESI FOTO STRUK (CLIENT-SIDE CANVAS COMPRESSION)
// ==============================================================================
let currentReceiptPhotoBase64 = null;

async function compressImage(file, maxWidth = 1280, maxHeight = 1280, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      return resolve({ blob: file, originalSize: file ? file.size : 0, compressedSize: file ? file.size : 0, savedPercent: '0%' });
    }

    const originalSize = file.size;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            return resolve({ blob: file, originalSize, compressedSize: originalSize, savedPercent: '0%' });
          }
          const compressedSize = blob.size;
          const saved = Math.max(0, Math.round((1 - compressedSize / originalSize) * 100));
          resolve({
            blob,
            originalSize,
            compressedSize,
            savedPercent: `${saved}%`,
            width,
            height
          });
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve({ blob: file, originalSize, compressedSize: originalSize, savedPercent: '0%' });
      img.src = e.target.result;
    };
    reader.onerror = () => resolve({ blob: file, originalSize, compressedSize: originalSize, savedPercent: '0%' });
    reader.readAsDataURL(file);
  });
}

async function handleReceiptFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Tampilkan preview lokal instan
  const previewContainer = document.getElementById('receiptPreviewContainer');
  const previewImg = document.getElementById('receiptPreviewImg');
  const compressionBadge = document.getElementById('compressionBadge');
  const compressionText = document.getElementById('compressionText');

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewContainer.style.display = 'block';
  };
  reader.readAsDataURL(file);

  if (compressionBadge && compressionText) {
    compressionBadge.style.display = 'flex';
    compressionText.textContent = '⏳ Mengompresi foto struk dengan resolusi optimal...';
  }

  // Kompresi client-side
  const compResult = await compressImage(file, 1280, 1280, 0.75);
  const origMB = (compResult.originalSize / (1024 * 1024)).toFixed(1);
  const compKB = (compResult.compressedSize / 1024).toFixed(0);

  if (compressionBadge && compressionText) {
    compressionText.textContent = `⚡ Foto Terkompresi: ${origMB} MB ➔ ${compKB} KB (${compResult.savedPercent} lebih cepat & hemat kuota)`;
  }

  // Convert blob ke Base64 untuk cadangan pengunggahan ke Google Drive
  const b64Reader = new FileReader();
  b64Reader.onload = () => {
    currentReceiptPhotoBase64 = b64Reader.result;
  };
  b64Reader.readAsDataURL(compResult.blob);

  // Upload file terkompresi ke server
  const formData = new FormData();
  formData.append('photo', compResult.blob, file.name.replace(/\.[^/.]+$/, '') + '.jpg');
  
  // Sertakan metadata plat dan waktu jika sudah diisi
  const plateVal = document.getElementById('plateInput') ? document.getElementById('plateInput').value.trim() : '';
  const timeVal = document.getElementById('fillingTimeInput') ? document.getElementById('fillingTimeInput').value : '';
  if (plateVal) formData.append('plate_no', plateVal);
  if (timeVal) formData.append('filling_time_wita', timeVal);

  try {
    showToast('Mengompresi & menyiapkan foto struk...', 'info');
    const res = await fetchWithAuth('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success && data.file_url) {
      document.getElementById('receiptPhotoUrl').value = data.file_url;
      if (data.photo_base64) {
        currentReceiptPhotoBase64 = data.photo_base64;
      }

      const driveBadge = document.getElementById('receiptDriveLinkBadge');
      const driveLink = document.getElementById('receiptDriveLink');
      const driveText = document.getElementById('receiptDriveLinkText');

      if (data.storage === 'google_drive' || String(data.file_url).includes('drive.google.com')) {
        if (driveBadge && driveLink) {
          driveBadge.style.display = 'flex';
          driveLink.href = data.file_url;
          if (driveText) driveText.textContent = '☁️ Tersimpan di Google Drive: PT. Awet Sarana Sukses';
        }
        showToast('Foto struk langsung tersimpan di Google Drive PT. Awet Sarana Sukses!', 'success');
      } else {
        if (driveBadge) driveBadge.style.display = 'none';
        showToast('Foto struk berhasil dilampirkan!', 'success');
      }
    } else {
      showToast(data.message || 'Gagal mengunggah foto', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat mengunggah foto struk.', 'error');
  }
}

function clearReceiptPhoto() {
  document.getElementById('receiptFileInput').value = '';
  document.getElementById('receiptPhotoUrl').value = '';
  currentReceiptPhotoBase64 = null;
  document.getElementById('receiptPreviewContainer').style.display = 'none';
  const badge = document.getElementById('compressionBadge');
  if (badge) badge.style.display = 'none';
  const driveBadge = document.getElementById('receiptDriveLinkBadge');
  if (driveBadge) driveBadge.style.display = 'none';
}

// ==============================================================================
// 6. SIMPAN TRANSAKSI PENGISIAN BBM (IDEMPOTENCY & VALIDASI DOUBLE CLICK)
// ==============================================================================
let isSubmittingTx = false;

async function handleTransactionSubmit(e) {
  if (e) e.preventDefault();
  if (isSubmittingTx) return;

  const plate_no = document.getElementById('plateInput').value.trim();
  const rawTotal = document.getElementById('totalRpInput').value.replace(/\D/g, '');
  const total_rp = Number(rawTotal);

  if (!plate_no || total_rp <= 0) {
    showToast('Nomor plat dan nominal rupiah wajib diisi.', 'warning');
    return;
  }

  // Check if registered
  const cleanVal = plate_no.replace(/[^A-Z0-9]/g, '').toUpperCase();
  const matched = registeredVehicles.find(v => {
    const cleanPlate = (v.plate_no || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    const cleanEq = (v.equipment_code || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    return cleanPlate === cleanVal || (cleanEq && cleanEq === cleanVal);
  });

  // Jika armada luar dan belum dikonfirmasi kasir, buka modal konfirmasi
  if (!matched && !pendingUnregisteredSubmit) {
    openUnregisteredModal(plate_no.toUpperCase());
    return;
  }

  executeTransactionSubmit();
}

async function executeTransactionSubmit() {
  if (isSubmittingTx) return;
  const btn = document.getElementById('btnSubmitTx');
  const plate_no = document.getElementById('plateInput').value.trim().toUpperCase();
  const rawTotal = document.getElementById('totalRpInput').value.replace(/\D/g, '');
  const total_rp = Number(rawTotal);
  const receipt_no = document.getElementById('receiptNoInput').value.trim();
  const receipt_photo_url = document.getElementById('receiptPhotoUrl').value;
  const driver_name = document.getElementById('driverNameInput').value.trim();
  const notes = document.getElementById('notesInput').value.trim();
  const filling_time_wita = document.getElementById('fillingTimeInput').value;

  isSubmittingTx = true;
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  // Generate Unique Idempotency Key per submit
  const idempotency_key = `tx-submit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Cari detail equipment_code dari matched vehicle
  const cleanVal = plate_no.replace(/[^A-Z0-9]/g, '').toUpperCase();
  const matched = registeredVehicles.find(v => {
    const cleanPlate = (v.plate_no || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    const cleanEq = (v.equipment_code || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
    return cleanPlate === cleanVal || (cleanEq && cleanEq === cleanVal);
  });

  const equipment_code = matched ? matched.equipment_code : 'NON-ARMADA';
  const vehicle_type = matched ? matched.vehicle_type : 'KENDARAAN LUAR';
  const is_registered = Boolean(matched);
  const ownership_group = matched ? 'PT. ASS MARISA' : 'ARMADA LUAR';

  try {
    const res = await fetchWithAuth('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        plate_no,
        equipment_code,
        vehicle_type,
        total_rp,
        receipt_no,
        receipt_photo_url,
        receipt_photo_base64: currentReceiptPhotoBase64,
        driver_name,
        notes,
        filling_time_wita,
        idempotency_key,
        is_registered,
        ownership_group
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');

      // Reset form
      document.getElementById('refuelForm').reset();
      updateActivePresetChips(0);
      clearReceiptPhoto();
      calculateLiters();
      handlePlateChange();

      // Refresh data
      loadTransactions();
      switchTab('transactionsTab');
    } else {
      showToast(data.message || 'Gagal mencatat transaksi.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan pada server.', 'error');
  } finally {
    isSubmittingTx = false;
    pendingUnregisteredSubmit = false;
    btn.disabled = false;
    btn.textContent = 'Simpan Pengisian BBM (Tempo)';
  }
}

// ==============================================================================
// 7. LOAD & TAMPILKAN TRANSAKSI HARI INI (LIVE SEARCH, FILTER & WORKSPACE)
// ==============================================================================
let currentTxSearchQuery = '';
let currentTxStatusFilter = 'BELUM DIBAYAR';
let currentTxArmadaFilter = '';

function formatWitaTime(dateInput) {
  if (!dateInput) return '-';
  const str = String(dateInput).trim();
  if (str.endsWith(' WITA')) return str;
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const options = {
      timeZone: 'Asia/Makassar',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    const parts = new Intl.DateTimeFormat('id-ID', options).formatToParts(d);
    const getPart = (type) => parts.find(p => p.type === type)?.value || '';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')} WITA`;
  } catch (e) {
    return str;
  }
}

async function loadTransactions() {
  try {
    const res = await fetchWithAuth('/api/transactions');
    const data = await res.json();
    if (data.success && data.data) {
      allTransactions = data.data;
      applyTxFilters();
      updateSummaryStats(allTransactions);
    }
  } catch (err) {
    console.error('Gagal memuat transaksi:', err);
  }
}

function handleSearchFilterChange() {
  currentTxSearchQuery = document.getElementById('txSearchInput')?.value.trim().toLowerCase() || '';
  currentTxStatusFilter = document.getElementById('filterStatus')?.value || '';
  currentTxArmadaFilter = document.getElementById('filterArmada')?.value || '';

  applyTxFilters();
}

function resetTxFilters() {
  const searchInput = document.getElementById('txSearchInput');
  const statusSelect = document.getElementById('filterStatus');
  const armadaSelect = document.getElementById('filterArmada');

  if (searchInput) searchInput.value = '';
  if (statusSelect) statusSelect.value = '';
  if (armadaSelect) armadaSelect.value = '';

  currentTxSearchQuery = '';
  currentTxStatusFilter = '';
  currentTxArmadaFilter = '';

  applyTxFilters();
}

function applyTxFilters() {
  const statusEl = document.getElementById('filterStatus');
  const armadaEl = document.getElementById('filterArmada');
  const searchEl = document.getElementById('txSearchInput');

  const statusFilter = statusEl ? statusEl.value : currentTxStatusFilter;
  const armadaFilter = armadaEl ? armadaEl.value : currentTxArmadaFilter;
  const searchQuery = searchEl ? searchEl.value.trim().toLowerCase() : currentTxSearchQuery;

  let filtered = [...allTransactions];

  if (statusFilter) {
    filtered = filtered.filter(t => t.payment_status === statusFilter);
  }

  if (armadaFilter === 'REGISTERED') {
    filtered = filtered.filter(t => t.is_registered !== false);
  } else if (armadaFilter === 'UNREGISTERED') {
    filtered = filtered.filter(t => t.is_registered === false);
  }

  if (searchQuery) {
    filtered = filtered.filter(t => {
      const p = (t.plate_no || '').toLowerCase();
      const no = (t.transaction_no || '').toLowerCase();
      const r = (t.receipt_no || '').toLowerCase();
      const d = (t.driver_name || '').toLowerCase();
      const eq = (t.equipment_code || '').toLowerCase();
      return p.includes(searchQuery) || 
             no.includes(searchQuery) || 
             r.includes(searchQuery) || 
             d.includes(searchQuery) || 
             eq.includes(searchQuery);
    });
  }

  renderTransactionTable(filtered);
}

function renderTransactionTable(transactions) {
  const tbody = document.getElementById('transactionTableBody');
  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
          Tidak ada data transaksi yang sesuai filter atau pencarian.
        </td>
      </tr>
    `;
    return;
  }

  const isGodmode = currentUser && currentUser.role === 'godmode';

  tbody.innerHTML = transactions.map(tx => {
    let statusBadge = '';
    const isVoid = tx.is_void || tx.payment_status === 'DIBATALKAN';
    const isPaid = tx.payment_status === 'SUDAH DIBAYAR';

    if (isVoid) {
      statusBadge = `<span class="badge-status void" title="Dibatalkan: ${tx.void_reason || '-'}">DIBATALKAN</span>`;
    } else if (isPaid) {
      statusBadge = `<span class="badge-status paid">LUNAS</span>`;
    } else {
      statusBadge = `<span class="badge-status pending">BELUM DIBAYAR</span>`;
    }

    const isReg = tx.is_registered !== false;
    const unregBadge = !isReg ? `<span class="badge-unreg-pill" title="Armada Tidak Terdaftar di PT. ASS Marisa">Luar</span>` : '';
    const plateColor = isVoid ? '#64748b' : (isReg ? '#38bdf8' : '#fbbf24');
    const strikeStyle = isVoid ? 'text-decoration: line-through; opacity: 0.6;' : '';

    let actionButtons = `
      <div class="table-actions-cell">
        <button type="button" class="btn-action-sm" onclick="openTransactionDetail('${tx.id || tx.transaction_no}')" title="Lihat Detail Transaksi">
          <span>📋</span> Detail
        </button>
        <button type="button" class="btn-action-sm print" onclick="openThermalReceipt('${tx.id || tx.transaction_no}')" title="Cetak Slip Pengisian Thermal">
          <span>🖨️</span> Slip
        </button>
    `;

    if (tx.receipt_photo_url) {
      actionButtons += `
        <button type="button" class="btn-action-sm" onclick="openPhotoModal('${tx.receipt_photo_url}', '${tx.transaction_no}')" title="Lihat Foto Struk Fisik">
          <span>📷</span> Struk
        </button>
      `;
    }

    // Tombol VOID: WAJIB OTORISASI GODMODE & HANYA UNTUK TRANSAKSI BELUM DIBAYAR
    if (isGodmode && !isPaid && !isVoid) {
      actionButtons += `
        <button type="button" class="btn-action-sm void" onclick="openVoidModal('${tx.id || tx.transaction_no}')" title="Batalkan Transaksi (Otorisasi Godmode)">
          <span>🚫</span> Void
        </button>
      `;
    }

    actionButtons += `</div>`;

    return `
      <tr style="${strikeStyle}">
        <td class="font-mono" style="font-weight: 700; color: #f8fafc;">${tx.transaction_no}</td>
        <td style="font-size: 0.82rem; color: #94a3b8;">${formatWitaTime(tx.filling_time_wita || tx.created_at)}</td>
        <td class="font-mono" style="font-weight: 700; color: ${plateColor};">${tx.plate_no}${unregBadge}</td>
        <td class="font-mono">${tx.equipment_code || '-'}</td>
        <td class="font-mono" style="font-weight: 700; color: #f8fafc;">Rp ${Number(tx.total_rp).toLocaleString('id-ID')}</td>
        <td class="font-mono" style="color: #34d399;">${Number(tx.liters).toFixed(2)} L</td>
        <td>${tx.receipt_no || '-'}</td>
        <td>${statusBadge}</td>
        <td style="font-size: 0.8rem; color: #94a3b8;">${tx.created_by || 'admin'}</td>
        <td>${actionButtons}</td>
      </tr>
    `;
  }).join('');
}

function updateSummaryStats(transactions) {
  let totalCount = 0;
  let totalLiters = 0;
  let unpaidRp = 0;
  let paidRp = 0;
  let pendingCount = 0;

  transactions.forEach(t => {
    if (t.is_void || t.payment_status === 'DIBATALKAN') return; // Lewati transaksi batal
    totalCount++;
    totalLiters += Number(t.liters) || 0;
    const rp = Number(t.total_rp) || 0;
    if (t.payment_status === 'SUDAH DIBAYAR') {
      paidRp += rp;
    } else {
      unpaidRp += rp;
      pendingCount++;
    }
  });

  const statCount = document.getElementById('statTodayCount');
  const statLiters = document.getElementById('statTodayLiters');
  const statUnpaid = document.getElementById('statTodayUnpaidRp');
  const statPaid = document.getElementById('statTodayPaidRp');
  const pendingBadge = document.getElementById('pendingCountBadge');

  if (statCount) statCount.textContent = `${totalCount} Transaksi Aktif`;
  if (statLiters) statLiters.textContent = `${totalLiters.toFixed(2)} L`;
  if (statUnpaid) statUnpaid.textContent = `Rp ${unpaidRp.toLocaleString('id-ID')}`;
  if (statPaid) statPaid.textContent = `Rp ${paidRp.toLocaleString('id-ID')}`;
  if (pendingBadge) pendingBadge.textContent = pendingCount;

  updateCreditLimit(unpaidRp);
}

// ==============================================================================
// 7B. MODAL DETAIL TRANSAKSI
// ==============================================================================
function openTransactionDetail(txId) {
  const tx = allTransactions.find(t => t.id === txId || t.transaction_no === txId);
  if (!tx) {
    showToast('Data transaksi tidak ditemukan.', 'error');
    return;
  }

  const contentEl = document.getElementById('txDetailContent');
  const footerEl = document.getElementById('txDetailFooter');
  if (!contentEl) return;

  const isVoid = tx.is_void || tx.payment_status === 'DIBATALKAN';
  const isPaid = tx.payment_status === 'SUDAH DIBAYAR';
  const isGodmode = currentUser && currentUser.role === 'godmode';

  let voidBannerHtml = '';
  if (isVoid) {
    voidBannerHtml = `
      <div class="tx-void-banner">
        <strong style="color: #f43f5e; font-size: 0.88rem;">🚫 TRANSAKSI TELAH DIBATALKAN (VOID)</strong><br>
        <strong>Alasan:</strong> ${tx.void_reason || 'Tidak dicantumkan'}<br>
        <strong>Dibatalkan Oleh:</strong> ${tx.voided_by || 'Godmode'} • ${tx.voided_at || '-'}
      </div>
    `;
  }

  contentEl.innerHTML = `
    ${voidBannerHtml}
    <div class="tx-detail-grid">
      <div class="tx-detail-item">
        <div class="tx-detail-label">Nomor Transaksi</div>
        <div class="tx-detail-val font-mono" style="color: var(--accent-cyan);">${tx.transaction_no}</div>
      </div>
      <div class="tx-detail-item">
        <div class="tx-detail-label">Waktu Pengisian (WITA)</div>
        <div class="tx-detail-val">${formatWitaTime(tx.filling_time_wita || tx.created_at)}</div>
      </div>
      <div class="tx-detail-item">
        <div class="tx-detail-label">Nomor Plat Kendaraan</div>
        <div class="tx-detail-val font-mono" style="color: #38bdf8;">${tx.plate_no} ${tx.is_registered === false ? '<span style="color:#fbbf24; font-size:0.75rem;">(Armada Luar)</span>' : ''}</div>
      </div>
      <div class="tx-detail-item">
        <div class="tx-detail-label">Kode Equipment & Jenis</div>
        <div class="tx-detail-val font-mono">${tx.equipment_code || '-'} <span style="font-size:0.75rem; color:#94a3b8;">(${tx.vehicle_type || 'TRUK'})</span></div>
      </div>
      <div class="tx-detail-item">
        <div class="tx-detail-label">Nominal Pembelian</div>
        <div class="tx-detail-val font-mono" style="color: var(--accent-amber); font-size: 1.1rem;">Rp ${Number(tx.total_rp).toLocaleString('id-ID')}</div>
      </div>
      <div class="tx-detail-item">
        <div class="tx-detail-label">Volume Dexlite (Rp 24.200/L)</div>
        <div class="tx-detail-val font-mono" style="color: #34d399; font-size: 1.1rem;">${Number(tx.liters).toFixed(2)} Liter</div>
      </div>
      <div class="tx-detail-item">
        <div class="tx-detail-label">Nomor Struk Pompa SPBU</div>
        <div class="tx-detail-val font-mono">${tx.receipt_no || '-'}</div>
      </div>
      <div class="tx-detail-item">
        <div class="tx-detail-label">Status Pembayaran</div>
        <div class="tx-detail-val">
          <span class="badge-status ${isVoid ? 'void' : (isPaid ? 'paid' : 'pending')}">
            ${isVoid ? 'DIBATALKAN' : tx.payment_status}
          </span>
        </div>
      </div>
      <div class="tx-detail-item">
        <div class="tx-detail-label">Nama Sopir / Driver</div>
        <div class="tx-detail-val">${tx.driver_name || '-'}</div>
      </div>
      <div class="tx-detail-item">
        <div class="tx-detail-label">Petugas Kasir</div>
        <div class="tx-detail-val">${tx.created_by || 'admin'}</div>
      </div>
    </div>
    ${tx.notes && tx.notes !== '-' ? `
      <div style="padding: 10px 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 14px; font-size: 0.82rem;">
        <span style="color: var(--text-muted); font-weight: 600;">Catatan Dispenser:</span> ${tx.notes}
      </div>
    ` : ''}
    ${tx.receipt_photo_url ? `
      <div style="text-align: center; margin-top: 10px;">
        <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 6px;">Foto Struk Dispenser yang Ditahan:</div>
        <img src="${tx.receipt_photo_url}" style="max-height: 220px; border-radius: var(--radius-sm); border: 1px solid var(--border-card); cursor: pointer;" onclick="openPhotoModal('${tx.receipt_photo_url}', '${tx.transaction_no}')" title="Klik untuk perbesar">
      </div>
    ` : ''}
  `;

  let footerButtons = `
    <div style="display: flex; gap: 8px;">
      <button type="button" class="btn-primary" onclick="closeTxDetailModal(); openThermalReceipt('${tx.id || tx.transaction_no}')">
        🖨️ Cetak Slip Thermal
      </button>
    </div>
    <div style="display: flex; gap: 8px;">
  `;

  if (isGodmode && !isPaid && !isVoid) {
    footerButtons += `
      <button type="button" class="btn-secondary" style="color: #f43f5e; border-color: rgba(244,63,94,0.4);" onclick="closeTxDetailModal(); openVoidModal('${tx.id || tx.transaction_no}')">
        🚫 Batalkan (VOID)
      </button>
    `;
  }

  footerButtons += `<button type="button" class="btn-secondary" onclick="closeTxDetailModal()">Tutup</button></div>`;

  if (footerEl) footerEl.innerHTML = footerButtons;

  document.getElementById('txDetailModal').classList.add('active');
}

function closeTxDetailModal(e) {
  if (!e || e.target.id === 'txDetailModal' || e.target.classList.contains('modal-close') || e.target.tagName === 'BUTTON') {
    document.getElementById('txDetailModal').classList.remove('active');
  }
}

// ==============================================================================
// 7C. MODAL VOID / PEMBATALAN TRANSAKSI (WAJIB OTORISASI GODMODE)
// ==============================================================================
let targetVoidTxId = null;

function openVoidModal(txId) {
  if (!currentUser || currentUser.role !== 'godmode') {
    showToast('Otorisasi Ditolak: Pembatalan transaksi wajib menggunakan akun Godmode / Owner!', 'error');
    return;
  }

  const tx = allTransactions.find(t => t.id === txId || t.transaction_no === txId);
  if (!tx) {
    showToast('Data transaksi tidak ditemukan.', 'error');
    return;
  }

  if (tx.payment_status === 'SUDAH DIBAYAR') {
    showToast('Transaksi yang sudah lunas terkunci permanen dan tidak dapat dibatalkan.', 'error');
    return;
  }

  targetVoidTxId = tx.id || tx.transaction_no;
  document.getElementById('voidModalTxNo').textContent = tx.transaction_no;
  document.getElementById('voidModalPlate').textContent = tx.plate_no;
  document.getElementById('voidModalAmount').textContent = `Rp ${Number(tx.total_rp).toLocaleString('id-ID')}`;
  document.getElementById('voidReasonInput').value = '';

  document.getElementById('txVoidModal').classList.add('active');
}

function closeVoidModal(e) {
  if (!e || e.target.id === 'txVoidModal' || e.target.classList.contains('modal-close') || e.target.tagName === 'BUTTON') {
    document.getElementById('txVoidModal').classList.remove('active');
    targetVoidTxId = null;
  }
}

async function handleConfirmVoidSubmit(e) {
  e.preventDefault();
  if (!targetVoidTxId) return;

  const voidReason = document.getElementById('voidReasonInput').value.trim();
  if (voidReason.length < 3) {
    showToast('Alasan pembatalan minimal 3 karakter.', 'warning');
    return;
  }

  const btn = document.getElementById('btnSubmitVoid');
  btn.disabled = true;
  btn.textContent = 'Membatalkan...';

  try {
    const res = await fetchWithAuth(`/api/transactions/${targetVoidTxId}/void`, {
      method: 'POST',
      body: JSON.stringify({ void_reason: voidReason })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Transaksi berhasil dibatalkan (VOID)', 'success');
      closeVoidModal();
      loadTransactions();
      if (typeof loadUnpaidForSettlement === 'function') loadUnpaidForSettlement();
    } else {
      showToast(data.message || 'Gagal membatalkan transaksi', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat menghubungi server.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Konfirmasi Batalkan (VOID)';
  }
}

// ==============================================================================
// 7D. SLIP PENGISIAN BBM THERMAL POS (TANPA TANDA TANGAN)
// ==============================================================================
function openThermalReceipt(txId) {
  const tx = allTransactions.find(t => t.id === txId || t.transaction_no === txId);
  if (!tx) {
    showToast('Data transaksi tidak ditemukan.', 'error');
    return;
  }

  const target = document.getElementById('thermalPrintTarget');
  if (!target) return;

  const isVoid = tx.is_void || tx.payment_status === 'DIBATALKAN';
  const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });

  target.innerHTML = `
    <div class="thermal-header">
      <h3>SPBU 74-962-29</h3>
      <div style="font-size: 11px; font-weight: bold;">PT. MUHRAS USAHA ARBA</div>
      <div style="font-size: 10px; margin-top: 2px;">SLIP PENGISIAN BBM TEMPO</div>
      <div style="font-size: 9.5px; color: #555;">REKANAN: ARBA GROUP</div>
    </div>

    ${isVoid ? '<div style="text-align:center; font-weight:bold; color:red; border:1px solid red; padding:3px; margin-bottom:6px;">*** DIBATALKAN (VOID) ***</div>' : ''}

    <div class="thermal-row">
      <span>No Transaksi:</span>
      <span style="font-weight: bold;">${tx.transaction_no}</span>
    </div>
    <div class="thermal-row">
      <span>Waktu (WITA):</span>
      <span>${formatWitaTime(tx.filling_time_wita || tx.created_at)}</span>
    </div>
    <div class="thermal-row">
      <span>Nomor Plat:</span>
      <span style="font-weight: bold;">${tx.plate_no}</span>
    </div>
    <div class="thermal-row">
      <span>Kode Alat:</span>
      <span>${tx.equipment_code || '-'}</span>
    </div>
    <div class="thermal-row">
      <span>Jenis Armada:</span>
      <span>${tx.vehicle_type || 'TRUK DISTRIBUSI'}</span>
    </div>
    ${tx.driver_name && tx.driver_name !== '-' ? `
      <div class="thermal-row">
        <span>Sopir:</span>
        <span>${tx.driver_name}</span>
      </div>
    ` : ''}
    <div class="thermal-row">
      <span>No Struk Pompa:</span>
      <span>${tx.receipt_no || '-'}</span>
    </div>

    <div class="thermal-divider"></div>

    <div class="thermal-row">
      <span>Produk BBM:</span>
      <span style="font-weight: bold;">Dexlite</span>
    </div>
    <div class="thermal-row">
      <span>Tarif Resmi:</span>
      <span>Rp ${Number(tx.price_per_liter || fuelPriceDexlite).toLocaleString('id-ID')} / L</span>
    </div>
    <div class="thermal-row" style="font-size: 13px; font-weight: bold;">
      <span>Volume:</span>
      <span>${Number(tx.liters).toFixed(2)} Liter</span>
    </div>
    <div class="thermal-row" style="font-size: 14px; font-weight: 900; margin-top: 4px;">
      <span>TOTAL RUPIAH:</span>
      <span>Rp ${Number(tx.total_rp).toLocaleString('id-ID')}</span>
    </div>
    <div class="thermal-row" style="font-size: 10px; margin-top: 2px;">
      <span>Status Bayar:</span>
      <span style="font-weight: bold;">${tx.payment_status} (TEMPO 17:00)</span>
    </div>

    <div class="thermal-divider"></div>

    <div class="thermal-footer">
      <div>Petugas Kasir: ${tx.created_by || 'admin'}</div>
      <div style="margin-top: 4px; font-style: italic;">Struk sah pengisian BBM armada PT. ASS Marisa.</div>
      <div>Terima kasih atas kerja samanya.</div>
    </div>
  `;

  document.getElementById('thermalReceiptModal').classList.add('active');
}

function closeThermalModal(e) {
  if (!e || e.target.id === 'thermalReceiptModal' || e.target.classList.contains('modal-close') || e.target.tagName === 'BUTTON') {
    document.getElementById('thermalReceiptModal').classList.remove('active');
  }
}

function printThermalReceipt() {
  document.body.classList.add('print-mode-thermal');
  window.print();
  const cleanup = () => {
    document.body.classList.remove('print-mode-thermal');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 2000);
}

// ==============================================================================
// 8. REKONSILIASI & PELUNASAN JAM 17:00 WITA (KHUSUS GODMODE)
// ==============================================================================
async function loadUnpaidForSettlement() {
  const container = document.getElementById('settlementTxList');
  if (!container) return;

  try {
    const res = await fetchWithAuth('/api/transactions?status=BELUM%20DIBAYAR');
    const data = await res.json();

    if (data.success && data.data) {
      const unpaidTx = data.data;
      if (unpaidTx.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 30px; color: #34d399;">
            🎉 Tidak ada tagihan pending. Seluruh transaksi pengisian BBM sudah lunas!
          </div>
        `;
        selectedSettlementTxIds = [];
        updateSelectedSettlementTotal();
        return;
      }

      container.innerHTML = unpaidTx.map(tx => `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; margin-bottom: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-card); border-radius: var(--radius-sm); cursor: pointer;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="checkbox" class="settlement-checkbox" value="${tx.id}" data-amount="${tx.total_rp}" onchange="handleSettlementCheckboxChange()">
            <div>
              <div style="font-weight: 700; font-size: 0.88rem; color: #fff;">${tx.plate_no} <span style="font-weight: 400; color: #38bdf8;">(${tx.equipment_code})</span></div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${tx.transaction_no} • ${formatWitaTime(tx.filling_time_wita || tx.created_at)}</div>
            </div>
          </div>
          <div class="font-mono" style="font-weight: 700; color: #fbbf24;">
            Rp ${Number(tx.total_rp).toLocaleString('id-ID')}
          </div>
        </label>
      `).join('');

      // Auto-centang semua secara default
      toggleSelectAllSettlement(true);
    }
  } catch (err) {
    console.error('Gagal memuat transaksi pending:', err);
  }
}

function toggleSelectAllSettlement(forceState = null) {
  const checkboxes = document.querySelectorAll('.settlement-checkbox');
  const shouldCheck = forceState !== null ? forceState : !Array.from(checkboxes).every(c => c.checked);
  checkboxes.forEach(c => { c.checked = shouldCheck; });
  handleSettlementCheckboxChange();
}

function handleSettlementCheckboxChange() {
  const checkboxes = document.querySelectorAll('.settlement-checkbox:checked');
  selectedSettlementTxIds = Array.from(checkboxes).map(c => c.value);
  updateSelectedSettlementTotal();
}

function handleTransferAmountInput(input) {
  input.dataset.autoFilled = '';
  formatCurrencyInputElement(input, () => {
    calculateVariance();
  });
}

function updateSelectedSettlementTotal() {
  const checkboxes = document.querySelectorAll('.settlement-checkbox:checked');
  let total = 0;
  checkboxes.forEach(c => {
    total += Number(c.dataset.amount) || 0;
  });

  const totalText = document.getElementById('selectedTotalAmountText');
  if (totalText) totalText.textContent = `Rp ${total.toLocaleString('id-ID')}`;

  // Isi nominal transfer default jika kosong atau auto-filled
  const transferInput = document.getElementById('transferAmountInput');
  if (transferInput && (!transferInput.value || transferInput.dataset.autoFilled)) {
    transferInput.value = total > 0 ? formatNumberWithDots(total) : '';
    transferInput.dataset.autoFilled = 'true';
  }

  calculateVariance();
}

function calculateVariance() {
  const checkboxes = document.querySelectorAll('.settlement-checkbox:checked');
  let totalTagihan = 0;
  checkboxes.forEach(c => {
    totalTagihan += Number(c.dataset.amount) || 0;
  });

  const transferInput = document.getElementById('transferAmountInput');
  const rawTransfer = (transferInput?.value || '').replace(/\D/g, '');
  const transferAmount = Number(rawTransfer) || 0;
  const variance = transferAmount - totalTagihan;

  const badge = document.getElementById('varianceStatusBadge');
  const note = document.getElementById('varianceDiffNote');
  const notesGroup = document.getElementById('varianceNotesGroup');

  if (variance === 0) {
    badge.className = 'badge-variance-match';
    badge.textContent = 'KLOP / SESUAI (Rp 0)';
    note.textContent = 'Nominal transfer bank klop 100% dengan total tagihan pengisian BBM.';
  } else if (variance < 0) {
    badge.className = 'badge-variance-diff';
    badge.textContent = `KURANG BAYAR (-Rp ${Math.abs(variance).toLocaleString('id-ID')})`;
    note.textContent = 'Perhatian: Nominal transfer bank lebih kecil dari tagihan. Harap tuliskan alasan di kolom catatan selisih.';
  } else {
    badge.className = 'badge-variance-diff';
    badge.style.background = 'rgba(56, 189, 248, 0.15)';
    badge.style.color = '#38bdf8';
    badge.textContent = `LEBIH BAYAR (+Rp ${variance.toLocaleString('id-ID')})`;
    note.textContent = 'Perhatian: Nominal transfer bank lebih besar dari tagihan. Kelebihan dapat dicatat sebagai deposit.';
  }
}

async function handleTransferProofSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('photo', file);

  try {
    showToast('Mengunggah bukti transfer...', 'info');
    const res = await fetchWithAuth('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success && data.file_url) {
      document.getElementById('transferProofUrl').value = data.file_url;
      showToast('Bukti transfer bank terlampir.', 'success');
    }
  } catch (err) {
    showToast('Gagal mengunggah bukti transfer.', 'error');
  }
}

async function handleSettlementSubmit(e) {
  e.preventDefault();
  if (selectedSettlementTxIds.length === 0) {
    showToast('Pilih minimal 1 transaksi yang akan diverifikasi pelunasannya.', 'warning');
    return;
  }

  const rawTransfer = document.getElementById('transferAmountInput').value.replace(/\D/g, '');
  const transfer_amount = Number(rawTransfer);
  const bank_name = document.getElementById('bankNameInput').value.trim();
  const bank_ref_no = document.getElementById('bankRefInput').value.trim();
  const variance_notes = document.getElementById('varianceNotesInput').value.trim();
  const transfer_proof_url = document.getElementById('transferProofUrl').value;

  const checkboxes = document.querySelectorAll('.settlement-checkbox:checked');
  let totalTagihan = 0;
  checkboxes.forEach(c => { totalTagihan += Number(c.dataset.amount) || 0; });
  const variance = transfer_amount - totalTagihan;

  if (variance !== 0 && !variance_notes) {
    showToast(`Terdapat selisih nominal Rp ${Math.abs(variance).toLocaleString('id-ID')}. Catatan selisih wajib diisi!`, 'error');
    document.getElementById('varianceNotesInput').focus();
    return;
  }

  const btn = document.getElementById('btnSubmitSettlement');
  btn.disabled = true;
  btn.textContent = 'Memverifikasi...';

  try {
    const res = await fetchWithAuth('/api/settlements', {
      method: 'POST',
      body: JSON.stringify({
        transaction_ids: selectedSettlementTxIds,
        transfer_amount,
        bank_name,
        bank_ref_no,
        variance_notes,
        transfer_proof_url
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('settlementForm').reset();
      loadUnpaidForSettlement();
      loadSettlementHistory();
      loadCarryOverBalance();
      loadTransactions();
      // Buka otomatis format laporan WhatsApp untuk tim manajemen ARBA Group
      openWhatsAppSummaryModal(data.data);
    } else {
      showToast(data.message || 'Gagal memproses pelunasan.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan pada server.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verifikasi & Selesaikan Pelunasan (LUNAS)';
  }
}

async function loadSettlementHistory() {
  const tbody = document.getElementById('settlementHistoryTableBody');
  if (!tbody) return;

  try {
    const res = await fetchWithAuth('/api/settlements');
    const data = await res.json();
    if (data.success && data.data) {
      const list = data.data;
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-muted);">Belum ada riwayat pelunasan.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(s => `
        <tr>
          <td class="font-mono" style="font-weight: 700;">${s.settlement_no}</td>
          <td>${s.settlement_date}</td>
          <td class="font-mono">Rp ${Number(s.total_transactions_amount).toLocaleString('id-ID')}</td>
          <td class="font-mono" style="color: #34d399; font-weight: 700;">Rp ${Number(s.transfer_amount).toLocaleString('id-ID')}</td>
          <td class="font-mono" style="color: ${s.variance_amount === 0 ? '#34d399' : '#f87171'};">
            ${s.variance_amount === 0 ? 'Rp 0 (Klop)' : (s.variance_amount > 0 ? '+' : '') + 'Rp ' + Number(s.variance_amount).toLocaleString('id-ID')}
          </td>
          <td>${s.bank_name || '-'} ${s.bank_ref_no ? `(${s.bank_ref_no})` : ''}</td>
          <td style="font-size: 0.8rem; color: #94a3b8;">${s.variance_notes || '-'}</td>
          <td>${s.verified_by || 'godmode'}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Gagal memuat riwayat settlement:', err);
  }
}

// ==============================================================================
// 9. LAPORAN, EKSPOR CSV IDENTIK SPREADSHEET & CETAK INVOICE A4
// ==============================================================================
const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function parseReportDateDetails(dateInput, createdAt) {
  const str = String(dateInput || createdAt || '').trim();

  // Pola YYYY-MM-DD HH:mm:ss
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

  // Fallback objek Date
  let parsed = new Date(str.replace(' WITA', ''));
  if (isNaN(parsed.getTime()) && createdAt) {
    parsed = new Date(createdAt);
  }
  if (isNaN(parsed.getTime())) {
    parsed = new Date();
  }

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

function getFilteredReportTransactions() {
  const dateFilter = document.getElementById('reportDateFilter')?.value || '';
  const plateFilter = document.getElementById('reportPlateFilter')?.value.trim().toLowerCase() || '';

  let filtered = [...allTransactions];
  if (dateFilter) {
    filtered = filtered.filter(t => t.filling_time_wita && t.filling_time_wita.startsWith(dateFilter));
  }
  if (plateFilter) {
    filtered = filtered.filter(t => (t.plate_no || '').toLowerCase().includes(plateFilter));
  }
  return filtered;
}

function loadReportData() {
  const filtered = getFilteredReportTransactions();
  const tbody = document.getElementById('reportTableBody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">Tidak ada data laporan yang sesuai filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const isVoid = t.is_void || t.payment_status === 'DIBATALKAN';
    const isPaid = t.payment_status === 'SUDAH DIBAYAR';
    const badgeClass = isVoid ? 'void' : (isPaid ? 'paid' : 'pending');
    const strikeStyle = isVoid ? 'text-decoration: line-through; opacity: 0.65;' : '';
    const hasPhoto = t.receipt_photo_url && t.receipt_photo_url !== '-' && t.receipt_photo_url !== 'null';

    return `
      <tr style="${strikeStyle}">
        <td class="font-mono">${t.transaction_no}</td>
        <td>${t.filling_time_wita || '-'}</td>
        <td class="font-mono" style="font-weight: 700; color: ${isVoid ? '#64748b' : '#38bdf8'};">${t.plate_no}</td>
        <td class="font-mono">${t.equipment_code || '-'}</td>
        <td class="font-mono">Rp ${Number(t.total_rp).toLocaleString('id-ID')}</td>
        <td class="font-mono">${Number(t.liters).toFixed(2)} L</td>
        <td>
          <span class="badge-status ${badgeClass}">
            ${isVoid ? 'DIBATALKAN' : t.payment_status}
          </span>
        </td>
        <td>${t.receipt_no || '-'}</td>
        <td style="text-align: center;">
          ${hasPhoto ? `
            <button type="button" class="btn-action-sm" onclick="openPhotoModal('${t.receipt_photo_url}', '${t.transaction_no}')" title="Lihat Foto Struk / Google Drive">
              <span>📷</span> Struk
            </button>
          ` : `<span style="color: var(--text-dim);">-</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

async function exportToExcel() {
  const filtered = getFilteredReportTransactions();
  if (!filtered || filtered.length === 0) {
    showToast('Tidak ada data transaksi untuk diekspor.', 'warning');
    return;
  }

  showToast('Menyiapkan file Excel (.xlsx) rapi & berwarna...', 'info');

  try {
    const txIds = filtered.map(t => t.id || t.transaction_no);
    const res = await fetchWithAuth('/api/reports/excel', {
      method: 'POST',
      body: JSON.stringify({ transaction_ids: txIds })
    });

    if (!res.ok) {
      throw new Error('Gagal mengunduh file Excel dari server');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `Laporan_BBM_SPBU_74_962_29_${dateStr}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Laporan Excel (.xlsx) dengan Kop & Warna berhasil diunduh!', 'success');
  } catch (err) {
    console.error('Error export excel:', err);
    showToast('Gagal mengunduh file Excel: ' + err.message, 'error');
  }
}

function exportToCSV() {
  const filtered = getFilteredReportTransactions();
  if (!filtered || filtered.length === 0) {
    showToast('Tidak ada data transaksi untuk diekspor.', 'warning');
    return;
  }

  // 1. KOP BANNER 3 TINGKAT (Persis sama dengan Google Spreadsheet Gambar 3)
  const bannerRows = [
    ['PT. MUHRAS USAHA ARBA (SPBU 74-962-29)'],
    ['LAPORAN PENGISIAN BBM OPERASIONAL ARBA GROUP'],
    ['Sistem Pencatatan BBM Tempo Harian & Rekonsiliasi Pelunasan Pukul 17:00 WITA'],
    ['']
  ];

  // 2. 18 HEADER KOLOM IDENTIK SPREADSHEET
  const headers = [
    'No.',
    'No. Transaksi',
    'Tanggal',
    'Bulan',
    'Tahun',
    'Waktu (WITA)',
    'No. Plat',
    'Kode Alat',
    'Tipe Armada',
    'Nama Sopir',
    'Jenis BBM',
    'Harga / Liter (Rp)',
    'Volume (Liter)',
    'Total Nominal (Rp)',
    'No. Struk Dispenser',
    'Foto Struk',
    'Status Pembayaran',
    'Petugas Kasir'
  ];

  let totalActiveLiters = 0;
  let totalActiveRp = 0;

  // 3. BARIS DATA TRANSAKSI
  const dataRows = filtered.map((t, idx) => {
    const isVoid = t.is_void || t.payment_status === 'DIBATALKAN';
    const dateInfo = parseReportDateDetails(t.filling_time_wita, t.created_at);
    const liters = Number(t.liters || 0);
    const totalRp = Number(t.total_rp || 0);

    if (!isVoid) {
      totalActiveLiters += liters;
      totalActiveRp += totalRp;
    }

    // Proteksi format teks untuk nomor struk agar Excel tidak mengubahnya jadi eksponensial (3.12E+08)
    let receiptCell = t.receipt_no || '-';
    if (receiptCell !== '-' && /^\d+$/.test(receiptCell)) {
      receiptCell = `="${receiptCell}"`;
    }

    let photoCell = '-';
    if (t.receipt_photo_url) {
      if (String(t.receipt_photo_url).startsWith('http')) {
        photoCell = t.receipt_photo_url;
      } else {
        photoCell = t.receipt_no && t.receipt_no !== '-' ? `Struk: ${t.receipt_no}` : 'Foto Tersimpan';
      }
    }

    const paymentStatus = isVoid ? 'DIBATALKAN' : (t.payment_status || 'BELUM DIBAYAR');

    return [
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
      Number(t.price_per_liter || fuelPriceDexlite || 24200),
      liters.toFixed(2),
      totalRp,
      receiptCell,
      photoCell,
      paymentStatus,
      t.created_by || 'admin'
    ];
  });

  // 4. BARIS TOTAL KESELURUHAN (Kolom Volume M & Nominal N)
  const summaryRow = [
    'TOTAL KESELURUHAN',
    '', '', '', '', '', '', '', '', '', '', '',
    totalActiveLiters.toFixed(2),
    totalActiveRp,
    '', '', '', ''
  ];

  // Helper escape CSV cell RFC 4180
  const formatCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.startsWith('="')) return str; // Rumus teks Excel proteksi angka
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const allLines = [
    ...bannerRows.map(row => row.map(formatCell).join(',')),
    headers.map(formatCell).join(','),
    ...dataRows.map(row => row.map(formatCell).join(',')),
    summaryRow.map(formatCell).join(',')
  ];

  // 5. Enkoding UTF-8 BOM (\uFEFF) untuk Windows Excel
  const csvString = '\uFEFF' + allLines.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Laporan_BBM_SPBU_74_962_29_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Laporan CSV 18 kolom berhasil diunduh.', 'success');
}

function printReportInvoice() {
  const filtered = getFilteredReportTransactions();
  if (!filtered || filtered.length === 0) {
    showToast('Tidak ada data transaksi untuk dicetak.', 'warning');
    return;
  }

  const dateFilter = document.getElementById('reportDateFilter')?.value || '';
  const plateFilter = document.getElementById('reportPlateFilter')?.value.trim().toUpperCase() || '';

  const activeTx = filtered.filter(t => !t.is_void && t.payment_status !== 'DIBATALKAN');
  const totalLiters = activeTx.reduce((sum, t) => sum + (Number(t.liters) || 0), 0);
  const totalRp = activeTx.reduce((sum, t) => sum + (Number(t.total_rp) || 0), 0);

  const nowWita = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
  const periodeText = dateFilter ? `Tanggal: ${dateFilter}` : 'Semua Periode Transaksi';

  const rowsHtml = filtered.map((t, index) => {
    const isVoid = t.is_void || t.payment_status === 'DIBATALKAN';
    const isPaid = t.payment_status === 'SUDAH DIBAYAR';
    const dateInfo = parseReportDateDetails(t.filling_time_wita, t.created_at);
    const rowStyle = isVoid ? 'text-decoration: line-through; color: #64748b; background-color: #fee2e2;' : '';
    const statusText = isVoid ? 'DIBATALKAN' : (t.payment_status || 'BELUM DIBAYAR');
    const statusColor = isVoid ? '#dc2626' : (isPaid ? '#059669' : '#d97706');

    return `
      <tr style="${rowStyle}">
        <td style="text-align: center;">${index + 1}</td>
        <td style="font-family: monospace; font-weight: bold;">${t.transaction_no}</td>
        <td>${dateInfo.tanggal} ${dateInfo.waktuWita}</td>
        <td style="font-family: monospace; font-weight: bold;">${t.plate_no}</td>
        <td style="font-family: monospace;">${t.equipment_code || '-'}</td>
        <td>${t.vehicle_type || 'TRUK DISTRIBUSI'}</td>
        <td>${t.driver_name || '-'}</td>
        <td style="text-align: right; font-family: monospace;">${Number(t.liters || 0).toFixed(2)} L</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold;">Rp ${Number(t.total_rp || 0).toLocaleString('id-ID')}</td>
        <td style="font-family: monospace;">${t.receipt_no || '-'}</td>
        <td style="font-weight: bold; color: ${statusColor}; text-align: center;">${statusText}</td>
        <td>${t.created_by || 'admin'}</td>
      </tr>
    `;
  }).join('');

  const container = document.getElementById('reportPrintArea');
  if (!container) return;

  container.innerHTML = `
    <div class="report-print-header">
      <div class="report-print-top">
        <div class="report-print-brand">
          <h1>PT. MUHRAS USAHA ARBA</h1>
          <h2>SPBU 74-962-29 MARISA</h2>
          <p>Jl. Trans Sulawesi, Marisa, Kab. Pohuwato, Gorontalo • Standar Operasional Pertamina</p>
        </div>
        <div class="report-print-badge">
          <div class="title">REKAPITULASI TAGIHAN BBM (INVOICE)</div>
          <div class="sub">Rekanan: PT. ASS MARISA (ARBA GROUP) • BBM: Dexlite</div>
        </div>
      </div>
    </div>

    <div class="report-print-meta-grid">
      <div class="report-print-meta-item">
        <div class="meta-label">Waktu Cetak Dokumen</div>
        <div class="meta-value">${nowWita} WITA</div>
      </div>
      <div class="report-print-meta-item">
        <div class="meta-label">Periode / Filter Laporan</div>
        <div class="meta-value">${periodeText}</div>
      </div>
      <div class="report-print-meta-item">
        <div class="meta-label">Total Transaksi Valid</div>
        <div class="meta-value">${activeTx.length} Pengisian (${filtered.length} Total)</div>
      </div>
      <div class="report-print-meta-item">
        <div class="meta-label">Total Tagihan Akumulatif</div>
        <div class="meta-value" style="color: #c00000;">Rp ${totalRp.toLocaleString('id-ID')} (${totalLiters.toFixed(2)} L)</div>
      </div>
    </div>

    <table class="report-print-table">
      <thead>
        <tr>
          <th style="width: 25px; text-align: center;">No.</th>
          <th>No Transaksi</th>
          <th>Waktu (WITA)</th>
          <th>No Plat</th>
          <th>Kode Alat</th>
          <th>Tipe Armada</th>
          <th>Nama Sopir</th>
          <th style="text-align: right;">Volume</th>
          <th style="text-align: right;">Nominal Tagihan</th>
          <th>No Struk</th>
          <th style="text-align: center;">Status</th>
          <th>Petugas</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7" style="text-align: right; font-weight: 800;">TOTAL KESELURUHAN:</td>
          <td style="text-align: right; font-weight: 800; font-family: monospace;">${totalLiters.toFixed(2)} L</td>
          <td style="text-align: right; font-weight: 800; font-family: monospace; color: #c00000;">Rp ${totalRp.toLocaleString('id-ID')}</td>
          <td colspan="3" style="text-align: center; font-size: 9px; color: #64748b;">(Transaksi Batal tidak diakumulasikan)</td>
        </tr>
      </tfoot>
    </table>

    <div class="report-print-signatures">
      <div class="report-print-sign-col">
        <div class="report-print-sign-title">Dibuat Oleh (Kasir SPBU)</div>
        <div class="report-print-sign-name">${currentUser?.full_name || currentUser?.username || 'Petugas Kasir'}</div>
        <div class="report-print-sign-role">Operator Pompa SPBU 74-962-29</div>
      </div>
      <div class="report-print-sign-col">
        <div class="report-print-sign-title">Diverifikasi Oleh (Pengawas)</div>
        <div class="report-print-sign-name">Owner / Godmode SPBU</div>
        <div class="report-print-sign-role">PT. Muhras Usaha Arba</div>
      </div>
      <div class="report-print-sign-col">
        <div class="report-print-sign-title">Diterima Oleh (Rekanan)</div>
        <div class="report-print-sign-name">( ..................................... )</div>
        <div class="report-print-sign-role">Logistik PT. ASS Marisa (ARBA Group)</div>
      </div>
    </div>
  `;

  document.body.classList.add('print-mode-report');
  window.print();
  const cleanup = () => {
    document.body.classList.remove('print-mode-report');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 2500);
}

// ==============================================================================
// 10. SETTINGS, WEBHOOK & MASTER HARGA
// ==============================================================================
async function loadSettings() {
  try {
    const res = await fetchWithAuth('/api/settings');
    const data = await res.json();
    if (data.success && data.data) {
      const webhookInput = document.getElementById('webhookUrlInput');
      if (webhookInput && data.data.google_sheets_webhook_url) {
        webhookInput.value = data.data.google_sheets_webhook_url;
      }
    }
  } catch (err) {
    console.warn('Gagal memuat setting:', err);
  }
}

async function saveWebhookUrl() {
  const url = document.getElementById('webhookUrlInput').value.trim();
  try {
    const res = await fetchWithAuth('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ google_sheets_webhook_url: url })
    });
    const data = await res.json();
    if (data.success) {
      showToast('URL Webhook Google Apps Script berhasil disimpan!', 'success');
    }
  } catch (err) {
    showToast('Gagal menyimpan URL Webhook.', 'error');
  }
}

async function testWebhookUrl() {
  const url = document.getElementById('webhookUrlInput').value.trim();
  if (!url) {
    showToast('Masukkan URL Webhook Google Apps Script terlebih dahulu.', 'warning');
    return;
  }

  showToast('Menguji koneksi ke Google Sheets...', 'info');
  try {
    const res = await fetchWithAuth('/api/sync/test', {
      method: 'POST',
      body: JSON.stringify({ webhook_url: url })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Berhasil terhubung ke Google Spreadsheet!', 'success');
    } else {
      showToast(`Gagal: ${data.error || data.message}`, 'error');
    }
  } catch (err) {
    showToast('Gagal menguji webhook.', 'error');
  }
}

async function resyncAllToSheets() {
  if (!confirm('Apakah Anda ingin menyinkronkan ulang seluruh transaksi ke Google Spreadsheet?')) return;
  showToast('Memulai sinkronisasi seluruh data ke Google Sheets...', 'info');
  try {
    const res = await fetchWithAuth('/api/sync/all', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
    } else {
      showToast('Gagal resync.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat resync.', 'error');
  }
}

function handleFuelPriceInput(input) {
  formatCurrencyInputElement(input, null);
}

async function saveFuelPrice() {
  const rawPrice = document.getElementById('settingFuelPriceInput').value.replace(/\D/g, '');
  const price = Number(rawPrice);
  if (!price || price <= 0) {
    showToast('Harga BBM tidak valid.', 'error');
    return;
  }
  try {
    const res = await fetchWithAuth('/api/fuel-price', {
      method: 'PUT',
      body: JSON.stringify({ price })
    });
    const data = await res.json();
    if (data.success) {
      fuelPriceDexlite = price;
      document.getElementById('dexlitePriceBadge').textContent = `Rp ${price.toLocaleString('id-ID')} / Liter`;
      calculateLiters();
      showToast('Harga Dexlite berhasil diperbarui!', 'success');
    }
  } catch (err) {
    showToast('Gagal memperbarui harga.', 'error');
  }
}

// Modal Tambah Armada
function openAddVehicleModal() {
  document.getElementById('addVehicleModal').classList.add('active');
}
function closeAddVehicleModal() {
  document.getElementById('addVehicleModal').classList.remove('active');
}

async function handleAddVehicleSubmit(e) {
  e.preventDefault();
  const plate_no = document.getElementById('newVehiclePlate').value.trim();
  const equipment_code = document.getElementById('newVehicleCode').value.trim();
  const vehicle_type = document.getElementById('newVehicleType').value;

  try {
    const res = await fetchWithAuth('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify({ plate_no, equipment_code, vehicle_type })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Armada baru berhasil ditambahkan!', 'success');
      closeAddVehicleModal();
      document.getElementById('newVehiclePlate').value = '';
      document.getElementById('newVehicleCode').value = '';
      loadVehicles();
    } else {
      showToast(data.message || 'Gagal menambahkan armada', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan server.', 'error');
  }
}

// Modal Preview Foto Struk (Mendukung Google Drive Direct Thumbnail & Tautan)
function openPhotoModal(imgUrl, txNo) {
  const modal = document.getElementById('photoModal');
  const img = document.getElementById('modalPreviewImg');
  const title = document.getElementById('photoModalTitle');
  const driveBtn = document.getElementById('modalDriveLink');

  if (!imgUrl || imgUrl === 'null' || imgUrl === 'undefined' || imgUrl === '-') {
    showToast('Tidak ada foto struk terlampir pada transaksi ini.', 'warning');
    return;
  }

  title.textContent = `Foto Struk Dispenser: ${txNo}`;

  // Deteksi jika link adalah Google Drive
  const isGoogleDrive = imgUrl.includes('drive.google.com');
  if (isGoogleDrive) {
    const fileIdMatch = imgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || imgUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      // Direct CDN image thumbnail dari Google Drive
      img.src = `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    } else {
      img.src = imgUrl;
    }

    if (driveBtn) {
      driveBtn.href = imgUrl;
      driveBtn.style.display = 'inline-flex';
    }
  } else {
    img.src = imgUrl;
    if (driveBtn) {
      driveBtn.style.display = 'none';
    }
  }

  modal.classList.add('active');
}

function closePhotoModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('photoModal').classList.remove('active');
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3500);
}

// ==============================================================================
// 10. CARRY-OVER BALANCE & WHATSAPP EXECUTIVE SUMMARY (CEO PLAN REVIEW)
// ==============================================================================
async function loadCarryOverBalance() {
  const banner = document.getElementById('carryOverAlertBanner');
  const amountEl = document.getElementById('carryOverAmountText');
  if (!banner || !amountEl) return;

  try {
    const res = await fetchWithAuth('/api/settlements/carry-over');
    const data = await res.json();
    if (data.success && data.data) {
      if (data.data.has_unsettled_balance) {
        banner.style.display = 'flex';
        amountEl.textContent = `Rp ${Number(data.data.total_underpaid).toLocaleString('id-ID')}`;
      } else {
        banner.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('Gagal memuat carry-over balance:', err);
  }
}

let lastActiveSettlement = null;

async function openWhatsAppSummaryModal(settlementData = null) {
  const modal = document.getElementById('waModal');
  const textarea = document.getElementById('waSummaryTextarea');
  if (!modal || !textarea) return;

  // Jika tidak ada data spesifik yang di-pass, ambil settlement paling akhir
  let s = settlementData;
  if (!s) {
    try {
      const res = await fetchWithAuth('/api/settlements');
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        s = data.data[0];
      }
    } catch (e) {}
  }

  // Hitung agregat transaksi hari ini
  const todayDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeWita = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour12: false }) + ' WITA';

  const activeTransactions = allTransactions.filter(t => !t.is_void && t.payment_status !== 'DIBATALKAN');
  const totalArmada = activeTransactions.length;
  let totalLiters = 0;
  activeTransactions.forEach(t => { totalLiters += Number(t.liters) || 0; });

  let totalTagihan = s ? Number(s.total_transactions_amount) : 0;
  let transferMasuk = s ? Number(s.transfer_amount) : 0;
  let selisih = s ? Number(s.variance_amount) : 0;
  let bankInfo = s ? `${s.bank_name || 'BANK'} (Ref: ${s.bank_ref_no || '-'})` : 'TRANSFER BANK';
  let catatanSelisih = s && s.variance_notes ? s.variance_notes : '-';
  let verifikator = s && s.verified_by ? s.verified_by.toUpperCase() : 'GODMODE / OWNER';

  let statusSelisihText = '✅ *KLOP / LUNAS* (Rp 0)';
  if (selisih < 0) {
    statusSelisihText = `⚠️ *KURANG BAYAR* (-Rp ${Math.abs(selisih).toLocaleString('id-ID')})`;
  } else if (selisih > 0) {
    statusSelisihText = `ℹ️ *LEBIH BAYAR* (+Rp ${selisih.toLocaleString('id-ID')})`;
  }

  const message = 
`*REKONSILIASI PENGISIAN BBM ARBA GROUP*
⛽ *SPBU 74-962-29 (PT. MUHRAS USAHA ARBA)*
━━━━━━━━━━━━━━━━━━━━
📅 *Hari/Tanggal:* ${todayDate}
🕒 *Waktu Rekonsiliasi:* ${timeWita}
👑 *Diverifikasi Oleh:* ${verifikator}

📊 *RINGKASAN OPERASIONAL:*
• Total Armada Terlayani: ${totalArmada} Kendaraan
• Total Volume Dexlite: ${totalLiters.toFixed(2)} Liter
• Tarif Dexlite Resmi: Rp ${fuelPriceDexlite.toLocaleString('id-ID')} / Liter

💰 *REKONSILIASI PELUNASAN (17:00 WITA):*
• Total Akumulasi Tagihan: *Rp ${totalTagihan.toLocaleString('id-ID')}*
• Transfer Masuk Rekening: *Rp ${transferMasuk.toLocaleString('id-ID')}*
• Bank Tujuan / Mutasi: ${bankInfo}
• Status Pelunasan: ${statusSelisihText}
• Catatan Selisih: ${catatanSelisih}

📑 *DOKUMEN PENDUKUNG:*
• Struk Fisik Dispenser: *Lengkap & Ditahan Kasir SPBU*
• Data Live Spreadsheet: *Tersinkronisasi 100%*
━━━━━━━━━━━━━━━━━━━━
_Laporan otomatis Sistem Operasional BBM SPBU 74-962-29_`;

  textarea.value = message;
  lastActiveSettlement = s;
  modal.classList.add('active');
}

function closeWaModal(e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById('waModal');
  if (modal) modal.classList.remove('active');
}

function copyWaSummaryText() {
  const textarea = document.getElementById('waSummaryTextarea');
  if (!textarea) return;

  textarea.select();
  textarea.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(textarea.value).then(() => {
    showToast('Teks ringkasan WhatsApp berhasil disalin ke clipboard!', 'success');
  }).catch(() => {
    document.execCommand('copy');
    showToast('Teks ringkasan WhatsApp disalin.', 'success');
  });
}

function openDirectWhatsApp() {
  const textarea = document.getElementById('waSummaryTextarea');
  if (!textarea) return;
  const encoded = encodeURIComponent(textarea.value);
  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
}
