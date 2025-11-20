// src/lib/imports/deliveryTicketsFromOcr.js
import { normalizeOcrTicket } from './normalizeDeliveryTicket';
import { supabase } from '../supabaseClient';

/**
 * Import delivery tickets from OCR results
 * 
 * @param {Array} ocrRows - OCR parsed rows
 * @returns {Promise<Object>} - { inserted, error }
 */
export async function importDeliveryTicketsFromOcr(ocrRows) {
  const validRows = [];

  for (const row of ocrRows) {
    const normalized = normalizeOcrTicket(row);
    if (normalized) validRows.push(normalized);
  }

  if (!validRows.length) return { inserted: 0 };

  const { error } = await supabase.from('delivery_tickets').insert(validRows);
  if (error) {
    console.error('[OCR] Failed to insert delivery tickets:', error);
    return { error };
  }
  return { inserted: validRows.length };
}
