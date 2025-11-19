// src/lib/imports/cStoreGallonsImport.js

import * as XLSX from 'xlsx';
import { findStoreBySheet } from '../../config/cStoreConfig';
import { supabase } from '../supabaseClient';

function findWeekEndingDate(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const v = String(cell.v || '').toLowerCase();
      if (v.includes('w/e')) {
        // Look to the right for an actual date cell
        const dateCell = sheet[XLSX.utils.encode_cell({ r, c + 1 })];
        if (dateCell && dateCell.v) {
          const d = new Date(dateCell.v);
          if (!isNaN(d.getTime())) {
            return d.toISOString().slice(0, 10);
          }
        }
      }
    }
  }
  return null;
}

function findTotalGallons(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    let label = null;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const value = String(cell.v || '');
      if (!label && value.toLowerCase().includes('total gallons')) {
        label = value;
        continue;
      }
      if (label) {
        const n = Number(String(value).replace(/[, ]/g, ''));
        if (Number.isFinite(n)) {
          return n;
        }
      }
    }
  }
  return null;
}

/**
 * Parse the C-Store Excel file and upsert into Supabase `cstore_gallons`.
 */
export async function importCStoreGallons(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const rows = [];

  for (const sheetName of workbook.SheetNames) {
    if (sheetName === 'Fuel Sales') continue; // summary sheet, skip

    const store = findStoreBySheet(sheetName);
    if (!store) continue; // sheet not mapped

    const sheet = workbook.Sheets[sheetName];
    const weekEnding = findWeekEndingDate(sheet);
    const totalGallons = findTotalGallons(sheet);

    if (!weekEnding || totalGallons == null) {
      console.warn('[C-Store] Skipping sheet (missing data):', sheetName);
      continue;
    }

    rows.push({
      store_id: store.storeId,
      week_ending: weekEnding,
      total_gallons: totalGallons,
    });
  }

  if (!rows.length) return;

  const { error } = await supabase
    .from('cstore_gallons')
    .upsert(rows, { onConflict: ['store_id','week_ending'] });

  if (error) {
    console.error('[C-Store] Failed to upsert gallons:', error);
  }
}
