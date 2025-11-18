// src/tabs/CStoresGallons.jsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";

/**
 * C-Stores (Gallons) Tab
 * 
 * Features:
 * - Upload weekly Excel/CSV files with gallons per c-store
 * - Display summary: total gallons, store count, top store
 * - Table view sorted by week ending (desc) then store (asc)
 * - Persists data in localStorage
 * 
 * Expected file format:
 * - First sheet only
 * - Header row: Store (or StoreName), StoreId (optional), WeekEnding, Gallons
 * - One row per store per week
 */

const STORAGE_KEY = "cstore-gallons-v1";

export default function CStoresGallons() {
  const [rows, setRows] = useState([]);
  const [lastUploadedAt, setLastUploadedAt] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRows(parsed.rows || []);
        setLastUploadedAt(parsed.lastUploadedAt || null);
      }
    } catch (err) {
      console.error("Failed to load C-Stores data from localStorage:", err);
    }
  }, []);

  // Save data to localStorage whenever rows change
  const saveData = (newRows) => {
    try {
      const now = new Date().toISOString();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rows: newRows,
          lastUploadedAt: now,
        })
      );
      setLastUploadedAt(now);
    } catch (err) {
      console.error("Failed to save C-Stores data to localStorage:", err);
      setError("Failed to save data. Storage might be full.");
    }
  };

  // Parse CSV file
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error("CSV file must have at least a header row and one data row");
    }

    // Simple CSV parser - handles quoted values
    const parseLine = (line) => {
      const values = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headerRow = parseLine(lines[0]);
    const dataRows = lines.slice(1).map(parseLine);

    return { headers: headerRow, data: dataRows };
  };

  // Normalize column names (case-insensitive mapping)
  const normalizeHeaders = (headers) => {
    const normalized = {};
    headers.forEach((header, index) => {
      const lower = header.toLowerCase().trim();
      if (lower === "store" || lower === "storename") {
        normalized.store = index;
      } else if (lower === "storeid") {
        normalized.storeId = index;
      } else if (lower === "weekending") {
        normalized.weekEnding = index;
      } else if (lower === "gallons") {
        normalized.gallons = index;
      }
    });
    return normalized;
  };

  // Process uploaded file
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const fileName = file.name.toLowerCase();
      let parsedData;

      if (fileName.endsWith(".csv")) {
        // Parse CSV
        const text = await file.text();
        parsedData = parseCSV(text);
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        // Parse Excel
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          throw new Error("Excel file must have at least a header row and one data row");
        }

        parsedData = {
          headers: jsonData[0],
          data: jsonData.slice(1),
        };
      } else {
        throw new Error("Unsupported file format. Please upload .xlsx, .xls, or .csv");
      }

      // Normalize headers
      const colMap = normalizeHeaders(parsedData.headers);

      // Validate required columns
      if (colMap.store === undefined) {
        throw new Error('Missing required column: "Store" or "StoreName"');
      }
      if (colMap.weekEnding === undefined) {
        throw new Error('Missing required column: "WeekEnding"');
      }
      if (colMap.gallons === undefined) {
        throw new Error('Missing required column: "Gallons"');
      }

      // Transform data rows
      const newRows = parsedData.data
        .filter((row) => row.length > 0 && row[colMap.store]) // Skip empty rows
        .map((row) => {
          const store = String(row[colMap.store] || "").trim();
          const storeId = colMap.storeId !== undefined ? String(row[colMap.storeId] || "").trim() : "";
          const weekEnding = String(row[colMap.weekEnding] || "").trim();
          const gallons = Number(row[colMap.gallons]) || 0;

          return {
            id: `${store}-${weekEnding}`,
            store,
            storeId,
            weekEnding,
            gallons,
          };
        });

      if (newRows.length === 0) {
        throw new Error("No valid data rows found in file");
      }

      setRows(newRows);
      saveData(newRows);
      setError(null);
    } catch (err) {
      console.error("File upload error:", err);
      setError(err.message || "Failed to process file");
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  // Calculate summary statistics
  const summary = React.useMemo(() => {
    if (rows.length === 0) {
      return { totalGallons: 0, storeCount: 0, topStore: null };
    }

    const totalGallons = rows.reduce((sum, row) => sum + row.gallons, 0);
    const uniqueStores = new Set(rows.map((row) => row.store));
    const storeCount = uniqueStores.size;

    // Find top store by total gallons
    const storeGallons = new Map();
    rows.forEach((row) => {
      storeGallons.set(row.store, (storeGallons.get(row.store) || 0) + row.gallons);
    });

    let topStore = null;
    let maxGallons = 0;
    storeGallons.forEach((gallons, store) => {
      if (gallons > maxGallons) {
        maxGallons = gallons;
        topStore = { store, gallons };
      }
    });

    return { totalGallons, storeCount, topStore };
  }, [rows]);

  // Sort rows: weekEnding desc, then store asc
  const sortedRows = React.useMemo(() => {
    return [...rows].sort((a, b) => {
      // Sort by weekEnding descending
      const dateA = new Date(a.weekEnding);
      const dateB = new Date(b.weekEnding);
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      // Then by store ascending
      return a.store.localeCompare(b.store);
    });
  }, [rows]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0, marginBottom: 24 }}>C-Stores (Gallons)</h2>

      {/* Upload Section */}
      <div
        style={{
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>
          Upload Weekly Gallons Data
        </h3>

        <div
          style={{
            background: "#F9FAFB",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>
            Expected file format:
          </strong>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#6B7280" }}>
            <li>Excel (.xlsx, .xls) or CSV (.csv) file</li>
            <li>
              <strong>Required columns:</strong> Store (or StoreName), WeekEnding, Gallons
            </li>
            <li>
              <strong>Optional column:</strong> StoreId
            </li>
            <li>One row per store for each week</li>
            <li>First sheet only (for Excel files)</li>
          </ul>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{
              padding: "10px 12px",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.6 : 1,
            }}
          />
          {uploading && (
            <span style={{ fontSize: 14, color: "#6B7280" }}>Processing...</span>
          )}
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              padding: 12,
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {lastUploadedAt && !error && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "#6B7280",
            }}
          >
            Last uploaded: {new Date(lastUploadedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {rows.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>Summary</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div
              style={{
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
                Total Gallons
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
                {summary.totalGallons.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                All stores combined
              </div>
            </div>

            <div
              style={{
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
                Store Count
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
                {summary.storeCount}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                Unique stores
              </div>
            </div>

            <div
              style={{
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
                Top Store
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
                {summary.topStore ? summary.topStore.store : "N/A"}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                {summary.topStore
                  ? `${summary.topStore.gallons.toLocaleString()} gal`
                  : "No data"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      {rows.length > 0 && (
        <div
          style={{
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>
            Data ({sortedRows.length} rows)
          </h3>
          <div style={{ overflow: "auto", border: "1px solid #E5E7EB", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: "#F3F4F6" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "#6B7280",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    Store
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "#6B7280",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    Store ID
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "#6B7280",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    Week Ending
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "#6B7280",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    Gallons
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{ background: i % 2 ? "#FAFAFA" : "white" }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #F3F4F6",
                        fontSize: 13,
                      }}
                    >
                      {row.store}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #F3F4F6",
                        fontSize: 13,
                        color: "#6B7280",
                      }}
                    >
                      {row.storeId || "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #F3F4F6",
                        fontSize: 13,
                      }}
                    >
                      {row.weekEnding}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #F3F4F6",
                        fontSize: 13,
                        textAlign: "right",
                        fontWeight: 500,
                      }}
                    >
                      {row.gallons.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {rows.length === 0 && !error && (
        <div
          style={{
            background: "white",
            border: "1px dashed #E5E7EB",
            borderRadius: 12,
            padding: 48,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 16, color: "#6B7280", marginBottom: 8 }}>
            No data uploaded yet
          </div>
          <div style={{ fontSize: 14, color: "#9CA3AF" }}>
            Upload a weekly gallons file to get started
          </div>
        </div>
      )}
    </div>
  );
}
