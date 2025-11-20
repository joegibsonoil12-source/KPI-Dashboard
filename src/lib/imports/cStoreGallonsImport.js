// src/lib/imports/cStoreGallonsImport.js
import * as XLSX from 'xlsx';
import { findStoreBySheet } from '../../config/cStoreConfig';
import { supabase } from '../supabaseClient';

/**
 * Robust week ending finder - looks for "W/E", "Week Ending", "Week End", etc.
 */
function findWeekEndingDate(sheet) {
  if (!sheet || !sheet['!ref']) return null;
  const range = XLSX.utils.decode_range(sheet['!ref']);

  const patterns = ['w/e','week ending','week end','weekending','week_end'];
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: r, c: c });
      const cell = sheet[cellAddr];
      if (!cell || !cell.v) continue;
      const v = String(cell.v || '').toLowerCase();
      if (patterns.some(p => v.includes(p))) {
        // check next few columns for a date
        for (let off = 1; off <= 4; off++) {
          const dateCell = sheet[XLSX.utils.encode_cell({ r: r, c: c + off })];
          if (!dateCell || !dateCell.v) continue;
          const d = new Date(dateCell.v);
          if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
          // if it's a string like '11/17/2025'
          const d2 = new Date(String(dateCell.v));
          if (!isNaN(d2.getTime())) return d2.toISOString().slice(0,10);
        }
        // sometimes the date is in the same cell
        const sameDate = new Date(cell.v);
        if (!isNaN(sameDate.getTime())) return sameDate.toISOString().slice(0,10);
      }
      // Also accept headers like "W/E 11/17/2025" in same cell
      const maybeDate = v.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (maybeDate) {
        const d = new Date(maybeDate[1]);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
      }
    }
  }
  return null;
}

/**
 * Robust total gallons finder
 * - Looks for labels like "Total Gallons", "Total Gals", "Gallons Total"
 * - When label found, searches next 4 and previous 4 columns for a numeric value
 */
function findTotalGallons(sheet) {
  if (!sheet || !sheet['!ref']) return null;
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const labelRegex = /total\s*gallons|total\s*gals|gallons\s*total|total\s*gal/i;

  // quick pass: try to find a cell whose value contains labelRegex
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: r, c: c });
      const cell = sheet[cellAddr];
      if (!cell || cell.v == null) continue;
      const v = String(cell.v || '');
      if (labelRegex.test(v)) {
        // search forward a few columns for numeric
        for (let off = 1; off <= 4; off++) {
          const nextCell = sheet[XLSX.utils.encode_cell({ r: r, c: c + off })];
          if (!nextCell || nextCell.v == null) continue;
          const n = parseNumber(String(nextCell.v));
          if (n != null) return n;
        }
        // search left a few columns
        for (let off = 1; off <= 4; off++) {
          const prevCell = sheet[XLSX.utils.encode_cell({ r: r, c: c - off })];
          if (!prevCell || prevCell.v == null) continue;
          const n = parseNumber(String(prevCell.v));
          if (n != null) return n;
        }
        // maybe the label cell itself is the number (rare)
        const nself = parseNumber(v.replace(/[A-Za-z\$]/g,''));
        if (nself != null) return nself;
      }
    }
  }

  // fallback: try to find any cell with 'total' in nearby header and numeric nearby
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: r, c: c });
      const cell = sheet[cellAddr];
      if (!cell || cell.v == null) continue;
      const v = String(cell.v || '');
      if (v.toLowerCase().includes('total')) {
        // scan right for numeric
        for (let off = 1; off <= 6; off++) {
          const candidate = sheet[XLSX.utils.encode_cell({ r: r, c: c + off })];
          if (!candidate || candidate.v == null) continue;
          const n = parseNumber(String(candidate.v));
          if (n != null) return n;
        }
      }
    }
  }

  // Last resort: try to find biggest numeric in sheet (dangerous but sometimes the only numeric)
  let maxNum = null;
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: r, c: c });
      const cell = sheet[cellAddr];
      if (!cell || cell.v == null) continue;
      const n = parseNumber(String(cell.v));
      if (n != null && (maxNum == null || n > maxNum)) maxNum = n;
    }
  }
  return maxNum;
}

function parseNumber(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/[^0-9.\-]/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function slugifyStoreId(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '') // remove punctuation
    .trim()
    .replace(/\s+/g, '_')
    .replace(/__+/g,'_')
    .toUpperCase()
    .slice(0, 60);
}

/**
 * Parse the C-Store Excel file and upsert into Supabase `cstore_gallons`.
 * arrayBuffer: uploaded XLSX array buffer (browser File.arrayBuffer() or Node Buffer)
 */
export async function importCStoreGallons(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const rows = [];

  for (const sheetName of workbook.SheetNames) {
    // skip obvious summary sheets
    const lower = String(sheetName || '').toLowerCase();
    if (lower.includes('fuel sales') || lower.includes('summary') || lower.includes('overview')) continue;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const weekEnding = findWeekEndingDate(sheet);
    const totalGallons = findTotalGallons(sheet);

    if (!weekEnding || totalGallons == null) {
      console.warn('[C-Store] Skipping sheet (missing data):', sheetName);
      continue;
    }

    // Try to find store mapping, otherwise create a slug-based storeId
    let store = findStoreBySheet(sheetName);
    if (!store) {
      const generatedId = slugifyStoreId(sheetName);
      console.warn('[C-Store] No mapping for sheet "%s". Using generated storeId: %s', sheetName, generatedId);
      store = {
        sheetName,
        storeId: generatedId,
        dashboardKey: generatedId.toLowerCase()
      };
      // NOTE: We do not mutate config file on disk here. For now we compute a stable storeId per sheet name.
    }

    rows.push({
      store_id: store.storeId,
      sheet_name: sheetName,
      week_ending: weekEnding,
      total_gallons: totalGallons,
    });
  }

  if (!rows.length) {
    console.warn('[C-Store] No rows parsed from workbook.');
    return { upserted: 0 };
  }

  // Upsert into cstore_gallons to avoid duplicates on re-upload. Uses unique constraint (store_id, week_ending).
  const { error } = await supabase
    .from('cstore_gallons')
    .upsert(rows, { onConflict: ['store_id','week_ending'] });

  if (error) {
    console.error('[C-Store] Failed to upsert gallons:', error);
    return { error };
  }

  console.info('[C-Store] Upserted', rows.length, 'rows.');
  return { upserted: rows.length };
}
