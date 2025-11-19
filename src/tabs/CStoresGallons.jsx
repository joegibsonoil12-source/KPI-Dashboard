// src/tabs/CStoresGallons.jsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { importCStoreGallons } from "../lib/imports/cStoreGallonsImport";
import { supabase } from "../lib/supabaseClient";

/**
 * C-Stores (Gallons) Tab
 * 
 * Features:
 * - Upload weekly Excel files with gallons per c-store (from NEW STORE SPREADSHEET format)
 * - Parses each store sheet to extract Total Gallons and W/E Date
 * - Saves to Supabase cstore_gallons table
 * - Display summary: total gallons, store count, top store
 * - Table view sorted by week ending (desc) then store (asc)
 */

export default function CStoresGallons() {
  const [rows, setRows] = useState([]);
  const [lastUploadedAt, setLastUploadedAt] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load data from Supabase on mount
  useEffect(() => {
    loadDataFromSupabase();
  }, []);

  const loadDataFromSupabase = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cstore_gallons')
        .select('*')
        .order('week_ending', { ascending: false });

      if (error) {
        console.error("Failed to load C-Stores data from Supabase:", error);
        setError("Failed to load data: " + error.message);
        return;
      }

      const formattedRows = (data || []).map(row => ({
        id: `${row.store_id}-${row.week_ending}`,
        store: row.store_id,
        storeId: row.store_id,
        weekEnding: row.week_ending,
        gallons: Number(row.total_gallons) || 0,
      }));

      setRows(formattedRows);
    } catch (err) {
      console.error("Failed to load C-Stores data:", err);
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Process uploaded file
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const fileName = file.name.toLowerCase();
      
      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
        throw new Error("Please upload an Excel file (.xlsx or .xls)");
      }

      // Parse Excel file using our C-Store import logic
      const arrayBuffer = await file.arrayBuffer();
      await importCStoreGallons(arrayBuffer);

      // Reload data from Supabase
      await loadDataFromSupabase();
      
      setLastUploadedAt(new Date().toISOString());
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
            <li>Excel file (.xlsx, .xls) - NEW STORE SPREADSHEET format</li>
            <li>Each store has its own sheet (e.g., "Laurel Hill Food Mart", "Old Wire", etc.)</li>
            <li>Each sheet contains a "Total Gallons" row with the numeric value</li>
            <li>Each sheet has a "W/E Date" header with the week ending date</li>
            <li>Data is automatically extracted and saved to database</li>
          </ul>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={uploading || loading}
            style={{
              padding: "10px 12px",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              cursor: uploading || loading ? "not-allowed" : "pointer",
              opacity: uploading || loading ? 0.6 : 1,
            }}
          />
          {uploading && (
            <span style={{ fontSize: 14, color: "#6B7280" }}>Processing...</span>
          )}
          {loading && (
            <span style={{ fontSize: 14, color: "#6B7280" }}>Loading data...</span>
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
