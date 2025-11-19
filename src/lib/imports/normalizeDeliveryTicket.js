// src/lib/imports/normalizeDeliveryTicket.js

/**
 * Normalization helpers for OCR-parsed delivery tickets
 * Converts OCR output into the Supabase delivery_tickets schema
 */

function parseNumber(value) {
  if (value == null) return null;
  const s = String(value).replace(/[, ]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Normalize a single OCR result into the delivery_tickets schema.
 * Returns null if required fields cannot be parsed.
 */
export function normalizeOcrTicket(ocrRow) {
  const date = parseDate(ocrRow.date || ocrRow.delivery_date);
  const qty = parseNumber(ocrRow.gallons || ocrRow.qty);
  const amount = parseNumber(ocrRow.amount || ocrRow.total);

  if (!date || qty == null || amount == null) {
    console.warn('[OCR] Skipping ticket (missing required fields):', ocrRow);
    return null;
  }

  return {
    date,
    qty,
    amount,
    customer: ocrRow.customer || null,
    ticket_number: ocrRow.ticket_number || null,
  };
}
