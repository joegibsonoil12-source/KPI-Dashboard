// src/components/UploadAvgMilesButton.jsx
import React, { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";

/**
 * UploadAvgMilesButton
 * - Accepts CSV/Excel with columns: truck_number, avg_miles, week_start (YYYY-MM-DD) or date
 * - Inserts rows into 'avg_miles_per_stop' Supabase table using the client
 * - Returns success / error
 */
export default function UploadAvgMilesButton() {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setUploading(true);
    try {
      const data = await f.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

      // Normalize into records: { truck_number, avg_miles, week_start }
      const records = rows.map(r => ({
        truck_number: String(r.truck_number || r.truck || r.truck_id || "").trim(),
        avg_miles: Number(r.avg_miles || r.avg || r.miles || 0) || 0,
        week_start: r.week_start || r.date || null,
        created_at: new Date().toISOString(),
      }));

      // Insert into supabase table 'avg_miles_per_stop'
      const { data: inserted, error } = await supabase.from("avg_miles_per_stop").insert(records);
      if (error) throw error;
      alert(`Uploaded ${inserted.length} avg miles records.`);
    } catch (err) {
      console.error("[UploadAvgMilesButton] upload failed:", err);
      alert("Upload failed: " + (err.message || String(err)));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <label style={{display:"inline-flex",alignItems:"center",gap:8}}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{display:"inline-block"}} />
        <button className="btn btn-primary" style={{marginLeft:8}} disabled={uploading}>{uploading ? "Uploading..." : "Upload Avg Miles"}</button>
      </label>
      <div style={{fontSize:12,color:"#6B7280",marginTop:6}}>CSV columns: truck_number, avg_miles, week_start (YYYY-MM-DD)</div>
    </div>
  );
}
