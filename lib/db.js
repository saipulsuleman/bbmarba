const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

// 30 Kendaraan Operasional WINGS Group (PT. MUHRAS USAHA ARBA)
const INITIAL_VEHICLES = [
  { plate_no: 'DM 8324 AG', equipment_code: 'D221001', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8204 AL', equipment_code: 'D221002', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8420 AD', equipment_code: 'D221003', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8260 AF', equipment_code: 'D221004', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8202 AJ', equipment_code: 'D221005', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8430 AI', equipment_code: 'D221006', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8166 AD', equipment_code: 'D221007', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8166 AH', equipment_code: 'D221008', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8033 AH', equipment_code: 'D221009', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8213 AL', equipment_code: 'D221010', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8273 AH', equipment_code: 'D221011', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8241 AC', equipment_code: 'D221012', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8356 AC', equipment_code: 'D221013', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8452 AC', equipment_code: 'D221014', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8077 AD', equipment_code: 'D221015', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8201 AK', equipment_code: 'D221016', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8163 AK', equipment_code: 'D221017', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8159 AH', equipment_code: 'D221018', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8168 AY', equipment_code: 'D221019', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8167 AY', equipment_code: 'D221020', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8166 AY', equipment_code: 'D221021', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8183 AY', equipment_code: 'D221022', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8435 AM', equipment_code: 'D221023', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8510 AM', equipment_code: 'D221024', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 8244 AN', equipment_code: 'D221025', vehicle_type: 'TRUK DISTRIBUSI', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 1048 AX', equipment_code: 'MOBIL OPR 01', vehicle_type: 'MOBIL OPR', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 1162 AI', equipment_code: 'MOBIL OPR 02', vehicle_type: 'MOBIL OPR', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 1294 AN', equipment_code: 'MOBIL OPR 03', vehicle_type: 'MOBIL OPR', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 1394 AF', equipment_code: 'MOBIL OPR 04', vehicle_type: 'MOBIL OPR', notes: 'PT. Awet Sarana Sukses - Marisa' },
  { plate_no: 'DM 2339 RG', equipment_code: 'MOTOR OPR 01', vehicle_type: 'MOTOR OPR', notes: 'PT. Awet Sarana Sukses - Marisa' }
];

const INITIAL_USERS = [
  {
    id: 'user-admin',
    username: 'admin',
    password_hash: '$2b$10$mb05.ciTR.BLyp7sYI3DFuV.Ch5feTKjd2aZVJTWKQMRsC63wWbOu', // SPBUMarisa2406
    role: 'admin',
    full_name: 'Kasir / Admin SPBU 74-962-29'
  },
  {
    id: 'user-godmode',
    username: 'godmode',
    password_hash: '$2b$10$eq2U/rlfoQfznKUfpXpgd.I0AZE4fSSSjO2BgWEh6wRNOb7sH1sXq', // Saipul123$
    role: 'godmode',
    full_name: 'Owner / Godmode SPBU 74-962-29'
  }
];

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'local_db.json');

// UUID pattern check helper
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-memory fallback cache untuk environment serverless read-only
let memoryDbCache = null;

// Pastikan direktori data ada (aman dari crash EROFS di serverless)
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem di cloud serverless
}

// Inisialisasi Supabase Client jika kredensial tersedia
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey && supabaseUrl.includes('supabase.co'));

let supabase = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[Database] Terhubung ke Supabase PostgreSQL.');
  } catch (err) {
    console.warn('[Database] Gagal menghubungkan Supabase, beralih ke local storage:', err.message);
  }
} else {
  console.log('[Database] Menggunakan Local Database Storage (Supabase belum diisi di .env).');
}

// Local Database Helpers
function readLocalDb() {
  if (memoryDbCache) return memoryDbCache;
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      users: INITIAL_USERS,
      vehicles: INITIAL_VEHICLES.map((v, i) => ({ id: `v-${i + 1}`, ...v, is_active: true, created_at: new Date().toISOString() })),
      fuel_types: [
        { id: 'fuel-1', name: 'Dexlite', price_per_liter: 24200, is_active: true, updated_at: new Date().toISOString() }
      ],
      transactions: [],
      settlements: [],
      settings: {
        google_sheets_webhook_url: process.env.GOOGLE_SHEETS_WEBHOOK_URL || '',
        fuel_price_dexlite: 24200,
        spbu_name: 'SPBU 74-962-29',
        client_name: 'PT. MUHRAS USAHA ARBA'
      }
    };
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    } catch (writeErr) {
      // Read-only storage fallback
    }
    memoryDbCache = defaultData;
    return defaultData;
  }
  try {
    memoryDbCache = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    return memoryDbCache;
  } catch (e) {
    return { users: INITIAL_USERS, vehicles: [], fuel_types: [], transactions: [], settlements: [], settings: {} };
  }
}

function writeLocalDb(data) {
  memoryDbCache = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    try {
      const os = require('os');
      const tmpFile = path.join(os.tmpdir(), 'bbm_local_db.json');
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
    } catch (tmpErr) {
      // Memory fallback data already saved in memoryDbCache
    }
  }
}

// ==========================================
// DB SERVICE INTERFACE
// ==========================================
const db = {
  isSupabase: Boolean(supabase),

  // 1. USERS
  async findUserByUsername(username) {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('username', username).single();
      if (!error && data) return data;
    }
    const local = readLocalDb();
    return local.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  },

  // 2. VEHICLES
  async getVehicles() {
    if (supabase) {
      const { data, error } = await supabase.from('vehicles').select('*').order('equipment_code', { ascending: true });
      if (!error && data && data.length > 0) return data;
    }
    const local = readLocalDb();
    return local.vehicles;
  },

  async addVehicle(vehicleData) {
    if (supabase) {
      const { data, error } = await supabase.from('vehicles').insert([vehicleData]).select().single();
      if (!error && data) return data;
    }
    const local = readLocalDb();
    const newVehicle = { id: `v-${Date.now()}`, ...vehicleData, is_active: true, created_at: new Date().toISOString() };
    local.vehicles.push(newVehicle);
    writeLocalDb(local);
    return newVehicle;
  },

  // 3. FUEL PRICE (DEXLITE)
  async getFuelPrice() {
    if (supabase) {
      const { data, error } = await supabase.from('fuel_types').select('*').eq('name', 'Dexlite').single();
      if (!error && data) return Number(data.price_per_liter);
    }
    const local = readLocalDb();
    const fuel = local.fuel_types.find(f => f.name === 'Dexlite');
    return fuel ? Number(fuel.price_per_liter) : 24200;
  },

  async updateFuelPrice(newPrice) {
    const price = Number(newPrice);
    if (supabase) {
      await supabase.from('fuel_types').update({ price_per_liter: price, updated_at: new Date().toISOString() }).eq('name', 'Dexlite');
    }
    const local = readLocalDb();
    const fuel = local.fuel_types.find(f => f.name === 'Dexlite');
    if (fuel) {
      fuel.price_per_liter = price;
      fuel.updated_at = new Date().toISOString();
      local.settings.fuel_price_dexlite = price;
      writeLocalDb(local);
    }
    return price;
  },

  // 4. TRANSACTIONS
  async getTransactions(filter = {}) {
    if (supabase) {
      let query = supabase.from('transactions').select('*').order('filling_time_wita', { ascending: false });
      if (filter.status) query = query.eq('payment_status', filter.status);
      if (filter.plate_no) query = query.ilike('plate_no', `%${filter.plate_no}%`);
      if (filter.startDate) query = query.gte('filling_time_wita', filter.startDate);
      if (filter.endDate) query = query.lte('filling_time_wita', filter.endDate);
      const { data, error } = await query;
      if (!error && data) return data;
    }

    const local = readLocalDb();
    let result = [...local.transactions];
    if (filter.status) {
      result = result.filter(t => t.payment_status === filter.status);
    }
    if (filter.plate_no) {
      result = result.filter(t => t.plate_no.toLowerCase().includes(filter.plate_no.toLowerCase()));
    }
    if (filter.date) {
      result = result.filter(t => t.filling_time_wita && t.filling_time_wita.startsWith(filter.date));
    }
    result.sort((a, b) => new Date(b.filling_time_wita) - new Date(a.filling_time_wita));
    return result;
  },

  async createTransaction(txData) {
    if (supabase) {
      const { data, error } = await supabase.from('transactions').insert([txData]).select().single();
      if (!error && data) return data;
      console.warn('[Database] Gagal insert transaksi Supabase, fallback local:', error?.message);
    }

    const local = readLocalDb();
    const newTx = {
      id: `tx-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...txData
    };
    local.transactions.push(newTx);
    writeLocalDb(local);
    return newTx;
  },

  async getTransactionById(id) {
    if (!id) return null;
    if (supabase) {
      const isUuid = UUID_REGEX.test(id);
      let query = supabase.from('transactions').select('*');
      if (isUuid) {
        query = query.or(`id.eq.${id},transaction_no.eq.${id}`);
      } else {
        query = query.eq('transaction_no', id);
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data) return data;
    }
    const local = readLocalDb();
    return local.transactions.find(t => t.id === id || t.transaction_no === id) || null;
  },

  async voidTransaction(id, voidData) {
    if (supabase) {
      const existing = await this.getTransactionById(id);
      if (!existing) throw new Error('Transaksi tidak ditemukan.');
      if (existing.payment_status === 'SUDAH DIBAYAR') {
        throw new Error('Transaksi yang sudah lunas/settled terkunci permanen dan tidak dapat dibatalkan.');
      }
      const updatePayload = {
        payment_status: 'DIBATALKAN',
        is_void: true,
        void_reason: voidData.void_reason || 'Dibatalkan oleh Owner/Godmode',
        voided_by: voidData.voided_by || 'godmode',
        voided_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('transactions').update(updatePayload).eq('id', existing.id).select().single();
      if (!error && data) return data;
    }

    const local = readLocalDb();
    const idx = local.transactions.findIndex(t => t.id === id || t.transaction_no === id);
    if (idx === -1) {
      throw new Error('Transaksi tidak ditemukan.');
    }
    const existing = local.transactions[idx];
    if (existing.payment_status === 'SUDAH DIBAYAR') {
      throw new Error('Transaksi yang sudah lunas/settled terkunci permanen dan tidak dapat dibatalkan.');
    }

    local.transactions[idx] = {
      ...existing,
      payment_status: 'DIBATALKAN',
      is_void: true,
      void_reason: voidData.void_reason || 'Dibatalkan oleh Owner/Godmode',
      voided_by: voidData.voided_by || 'godmode',
      voided_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    writeLocalDb(local);
    return local.transactions[idx];
  },

  async updateTransactionPhotoUrl(idOrTxNo, photoUrl, driveFileId = null) {
    if (!idOrTxNo || !photoUrl) return null;

    if (supabase) {
      try {
        const isUuid = UUID_REGEX.test(idOrTxNo);
        let query = supabase.from('transactions').update({
          receipt_photo_url: photoUrl,
          updated_at: new Date().toISOString()
        });
        if (isUuid) {
          query = query.or(`id.eq.${idOrTxNo},transaction_no.eq.${idOrTxNo}`);
        } else {
          query = query.eq('transaction_no', idOrTxNo);
        }
        await query;
      } catch (err) {
        console.warn('[Database] Gagal update receipt_photo_url di Supabase:', err.message);
      }
    }

    const local = readLocalDb();
    const idx = local.transactions.findIndex(t => t.id === idOrTxNo || t.transaction_no === idOrTxNo);
    if (idx !== -1) {
      local.transactions[idx].receipt_photo_url = photoUrl;
      if (driveFileId) {
        local.transactions[idx].drive_file_id = driveFileId;
      }
      local.transactions[idx].updated_at = new Date().toISOString();
      writeLocalDb(local);
      return local.transactions[idx];
    }
    return null;
  },

  // 5. SETTLEMENTS (REKONSILIASI JAM 17:00 WITA)
  async createSettlement(settlementData, transactionIds) {
    if (supabase) {
      // 1. Insert settlement
      const { data: sData, error: sErr } = await supabase.from('settlements').insert([settlementData]).select().single();
      if (!sErr && sData) {
        // 2. Update status transaksi menjadi SUDAH DIBAYAR (pisahkan UUID dan transaction_no)
        const uuidIds = (transactionIds || []).filter(id => UUID_REGEX.test(id));
        const nonUuidIds = (transactionIds || []).filter(id => !UUID_REGEX.test(id));

        if (uuidIds.length > 0) {
          await supabase
            .from('transactions')
            .update({
              payment_status: 'SUDAH DIBAYAR',
              settlement_id: sData.id,
              updated_at: new Date().toISOString()
            })
            .in('id', uuidIds);
        }
        if (nonUuidIds.length > 0) {
          await supabase
            .from('transactions')
            .update({
              payment_status: 'SUDAH DIBAYAR',
              settlement_id: sData.id,
              updated_at: new Date().toISOString()
            })
            .in('transaction_no', nonUuidIds);
        }
        return sData;
      }
      console.warn('[Database] Fallback settlement local:', sErr?.message);
    }

    const local = readLocalDb();
    const newSettlement = {
      id: `set-${Date.now()}`,
      ...settlementData,
      transaction_ids: transactionIds,
      verified_at: new Date().toISOString()
    };
    local.settlements.push(newSettlement);

    // Update status transaksi terkait
    local.transactions = local.transactions.map(tx => {
      if (transactionIds.includes(tx.id) || transactionIds.includes(tx.transaction_no)) {
        return {
          ...tx,
          payment_status: 'SUDAH DIBAYAR',
          settlement_id: newSettlement.id,
          settlement_no: newSettlement.settlement_no,
          verified_at: newSettlement.verified_at,
          transfer_amount: newSettlement.transfer_amount,
          variance_amount: newSettlement.variance_amount,
          variance_notes: newSettlement.variance_notes,
          bank_ref_no: newSettlement.bank_ref_no,
          transfer_proof_url: newSettlement.transfer_proof_url
        };
      }
      return tx;
    });

    writeLocalDb(local);
    return newSettlement;
  },

  async getSettlements() {
    if (supabase) {
      const { data, error } = await supabase.from('settlements').select('*').order('verified_at', { ascending: false });
      if (!error && data) return data;
    }
    const local = readLocalDb();
    return local.settlements.sort((a, b) => new Date(b.verified_at) - new Date(a.verified_at));
  },

  // 6. SETTINGS & WEBHOOK URL
  async getSettings() {
    if (supabase) {
      const { data, error } = await supabase.from('app_settings').select('*');
      if (!error && data) {
        const obj = {};
        data.forEach(item => { obj[item.key] = item.value; });
        return obj;
      }
    }
    const local = readLocalDb();
    return local.settings || {};
  },

  async updateSetting(key, value) {
    if (supabase) {
      await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
    }
    const local = readLocalDb();
    if (!local.settings) local.settings = {};
    local.settings[key] = value;
    writeLocalDb(local);
    return { key, value };
  },

  // 7. ARSITEKTUR CLOUD & INTEGRITAS DATA (PLAN ENG REVIEW)
  async uploadFileToStorage(fileBuffer, filename, mimeType) {
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from('struk-bbm')
          .upload(filename, fileBuffer, {
            contentType: mimeType,
            upsert: true
          });
        if (!error && data) {
          const { data: publicUrlData } = supabase.storage
            .from('struk-bbm')
            .getPublicUrl(filename);
          return { success: true, url: publicUrlData.publicUrl };
        }
        console.warn('[Storage] Gagal upload ke Supabase Storage:', error?.message);
      } catch (err) {
        console.warn('[Storage] Supabase storage exception:', err.message);
      }
    }
    return null;
  },

  async findTransactionByIdempotencyKey(key) {
    if (!key) return null;
    if (supabase) {
      const { data } = await supabase.from('transactions').select('*').eq('idempotency_key', key).maybeSingle();
      if (data) return data;
    }
    const local = readLocalDb();
    return local.transactions.find(t => t.idempotency_key === key) || null;
  },

  async checkDuplicateReceiptNo(receiptNo) {
    if (!receiptNo || receiptNo === '-' || receiptNo.trim().length <= 3) return false;
    const cleanNo = receiptNo.trim().toLowerCase();
    
    // Periksa hanya pada transaksi hari ini (WITA)
    const todayStr = new Date().toISOString().slice(0, 10);
    if (supabase) {
      const { data } = await supabase
        .from('transactions')
        .select('id, receipt_no')
        .ilike('receipt_no', cleanNo)
        .gte('created_at', `${todayStr}T00:00:00Z`);
      if (data && data.length > 0) return true;
    }
    const local = readLocalDb();
    return local.transactions.some(t => 
      t.receipt_no && 
      t.receipt_no.toLowerCase().trim() === cleanNo &&
      t.created_at && t.created_at.startsWith(todayStr)
    );
  },

  async getCarryOverBalance() {
    const settlements = await this.getSettlements();
    let totalUnderpaid = 0;
    let totalOverpaid = 0;

    settlements.forEach(s => {
      const variance = Number(s.variance_amount) || 0;
      if (variance < 0) {
        totalUnderpaid += Math.abs(variance);
      } else if (variance > 0) {
        totalOverpaid += variance;
      }
    });

    const netCarryOver = totalOverpaid - totalUnderpaid;
    return {
      total_underpaid: totalUnderpaid,
      total_overpaid: totalOverpaid,
      net_carry_over: netCarryOver,
      has_unsettled_balance: totalUnderpaid > 0
    };
  }
};

module.exports = db;
