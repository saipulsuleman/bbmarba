const db = require('./db');

async function sendToWebhook(payload, customUrl = null) {
  try {
    let webhookUrl = customUrl;
    if (!webhookUrl) {
      const settings = await db.getSettings();
      webhookUrl = settings.google_sheets_webhook_url || process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    }

    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      console.log('[Sheets Webhook] URL belum disetting. Melewati auto-sync spreadsheet.');
      return { success: false, message: 'URL Webhook Google Sheets belum diatur' };
    }

    // Google Apps Script redirect dengan status 302, Node fetch/native mendukung follow redirects
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const responseText = await response.text();
    let result = {};
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { raw: responseText };
    }

    console.log('[Sheets Webhook] Respon sukses:', result);
    return { success: true, data: result };
  } catch (error) {
    console.warn('[Sheets Webhook] Gagal mengirim data:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  async testConnection(url) {
    return sendToWebhook({ action: 'TEST', timestamp: new Date().toISOString() }, url);
  },

  async syncNewTransaction(tx) {
    const photoBase64 = tx.receipt_photo_base64 ||
      (tx.receipt_photo_url && String(tx.receipt_photo_url).startsWith('data:') ? tx.receipt_photo_url : null);

    const res = await sendToWebhook({
      action: 'INSERT_TRANSACTION',
      data: {
        transaction_no: tx.transaction_no,
        filling_time_wita: tx.filling_time_wita || tx.created_at,
        created_at: tx.created_at,
        plate_no: tx.plate_no,
        equipment_code: tx.equipment_code || '-',
        vehicle_type: tx.vehicle_type || 'TRUK DISTRIBUSI',
        driver_name: tx.driver_name || '-',
        fuel_name: tx.fuel_name || 'Dexlite',
        price_per_liter: tx.price_per_liter || 24200,
        liters: tx.liters,
        total_rp: tx.total_rp,
        receipt_no: tx.receipt_no || '-',
        receipt_photo_url: tx.receipt_photo_url || null,
        receipt_photo_base64: photoBase64,
        payment_status: tx.payment_status || 'BELUM DIBAYAR',
        is_registered: tx.is_registered !== false,
        ownership_group: tx.ownership_group || 'PT. ASS MARISA',
        created_by: tx.created_by || 'Kasir'
      }
    });

    // Jika Apps Script berhasil menyimpan ke Google Drive, perbarui URL permanen di database
    if (res && res.success && res.data) {
      const driveData = res.data.drive;
      const finalPhotoUrl = (driveData && driveData.file_url) || res.data.receipt_photo_url;
      if (finalPhotoUrl && String(finalPhotoUrl).startsWith('http')) {
        try {
          await db.updateTransactionPhotoUrl(
            tx.id || tx.transaction_no,
            finalPhotoUrl,
            driveData ? driveData.file_id : null
          );
          console.log(`[Sheets Webhook] Foto struk ${tx.transaction_no} berhasil disimpan di Google Drive: ${finalPhotoUrl}`);
        } catch (dbErr) {
          console.warn('[Sheets Webhook] Gagal memperbarui URL Google Drive ke database:', dbErr.message);
        }
      }
    }

    return res;
  },

  async uploadReceiptToDrive(params) {
    return sendToWebhook({
      action: 'UPLOAD_RECEIPT_TO_DRIVE',
      data: {
        photo_base64: params.photo_base64,
        plate_no: params.plate_no,
        filling_time_wita: params.filling_time_wita || params.date_time,
        transaction_no: params.transaction_no
      }
    });
  },

  async syncSettlement(settlement, transactions) {
    const txNumbers = transactions ? transactions.map(t => t.transaction_no) : [];
    return sendToWebhook({
      action: 'SETTLEMENT',
      data: {
        settlement_no: settlement.settlement_no,
        settlement_date: settlement.settlement_date,
        transaction_numbers: txNumbers,
        transaction_count: txNumbers.length || (transactions ? transactions.length : 1),
        total_transactions_amount: settlement.total_transactions_amount,
        transfer_amount: settlement.transfer_amount,
        variance_amount: settlement.variance_amount || 0,
        variance_status: settlement.variance_status || 'MATCH',
        variance_notes: settlement.variance_notes || '-',
        bank_name: settlement.bank_name || 'BCA',
        bank_ref_no: settlement.bank_ref_no || '-',
        transfer_proof_url: settlement.transfer_proof_url || null,
        verified_at: settlement.verified_at || new Date().toISOString(),
        verified_by: settlement.verified_by || 'godmode'
      }
    });
  },

  async resyncAll(transactions) {
    return sendToWebhook({
      action: 'RESYNC_ALL',
      data: {
        transactions: transactions.map(tx => ({
          transaction_no: tx.transaction_no,
          filling_time_wita: tx.filling_time_wita || tx.created_at,
          created_at: tx.created_at,
          plate_no: tx.plate_no,
          equipment_code: tx.equipment_code || '-',
          vehicle_type: tx.vehicle_type || 'TRUK DISTRIBUSI',
          driver_name: tx.driver_name || '-',
          fuel_name: tx.fuel_name || 'Dexlite',
          price_per_liter: tx.price_per_liter || 24200,
          liters: tx.liters,
          total_rp: tx.total_rp,
          receipt_no: tx.receipt_no || '-',
          receipt_photo_url: tx.receipt_photo_url || null,
          payment_status: tx.payment_status || 'BELUM DIBAYAR',
          created_by: tx.created_by || 'Kasir'
        }))
      }
    });
  },

  async formatTemplate(url) {
    return sendToWebhook({ action: 'FORMAT_TEMPLATE' }, url);
  },

  async syncVoidTransaction(tx) {
    return sendToWebhook({
      action: 'VOID_TRANSACTION',
      data: {
        transaction_no: tx.transaction_no,
        plate_no: tx.plate_no,
        total_rp: tx.total_rp,
        liters: tx.liters,
        void_reason: tx.void_reason,
        voided_by: tx.voided_by,
        voided_at: tx.voided_at
      }
    });
  }
};
