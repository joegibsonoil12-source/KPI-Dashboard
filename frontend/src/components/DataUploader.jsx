import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';

// DataUploader: parse Excel/CSV/text files, preview, mapping, Save/Autosave.
// Props:
//  - apiBase: backend API base URL (e.g. http://localhost:4000)
//  - autosaveDefault: boolean (default true)
export default function DataUploader({ apiBase = 'http://localhost:4000', autosaveDefault = true }) {
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]); // { name, headers, rows }
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [mapping, setMapping] = useState({}); // src -> target
  const [targetTable, setTargetTable] = useState('');
  const [status, setStatus] = useState('');
  const [autosave, setAutosave] = useState(autosaveDefault);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!autosave || !dirty) return;
    const t = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => clearTimeout(t);
  }, [autosave, dirty, mapping, targetTable, sheets, selectedSheetIndex]);

  function readFileToSheets(fileBlob) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const parsed = workbook.SheetNames.map(name => {
        const ws = workbook.Sheets[name];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
        const headers = json[0] ? json[0].map(h => (h === undefined ? '' : String(h))) : [];
        const rows = json.slice(1).map(r => {
          const rowObj = {};
          headers.forEach((h, i) => rowObj[h || `col${i+1}`] = r[i]);
          return rowObj;
        });
        return { name, headers, rows };
      });
      setSheets(parsed);
      setSelectedSheetIndex(0);
      setStatus('Parsed file locally. Sending preview request to server...');
      fetch(`${apiBase}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileBlob.name, sheets: parsed })
      })
      .then(r => r.json())
      .then(data => {
        if (data && data.previews && data.previews[0]) {
          const p = data.previews[0];
          setTargetTable(p.suggestedTable || '');
          setMapping(p.suggestedMapping || {});
          setStatus('Preview received. Review and save.');
        } else {
          setStatus('Preview endpoint returned no suggestions.');
        }
      })
      .catch(err => {
        console.error(err);
        setStatus('Preview request failed — you can still edit mapping and save locally.');
      });
    };
    reader.readAsBinaryString(fileBlob);
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    readFileToSheets(f);
  }

  function updateMapping(src, target) {
    setMapping(m => ({ ...m, [src]: target }));
    setDirty(true);
  }

  function updateTargetTable(t) {
    setTargetTable(t);
    setDirty(true);
  }

  const handleSave = useCallback(async () => {
    if (!sheets || !sheets[selectedSheetIndex]) {
      setStatus('No sheet selected');
      return;
    }
    setStatus('Saving...');
    const sheet = sheets[selectedSheetIndex];
    try {
      const payload = {
        filename: file ? file.name : 'upload',
        sheetName: sheet.name,
        mapping,
        targetTable,
        rows: sheet.rows
      };
      const resp = await fetch(`${apiBase}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!resp.ok) {
        setStatus(`Save failed: ${json.error || resp.statusText}`);
        return;
      }
      setDirty(false);
      if (json.sql) {
        setStatus('Save complete — SQL returned. Copy it to your DB if desired.');
        console.log('SQL returned by backend:', json.sql);
      } else {
        setStatus('Save complete.');
        console.log('Save result:', json);
      }
    } catch (err) {
      console.error(err);
      setStatus('Save error: ' + err.message);
    }
  }, [apiBase, file, mapping, sheets, selectedSheetIndex, targetTable]);

  if (!sheets || sheets.length === 0) {
    return (
      <div>
        <h3>Data Uploader &amp; KPI Import</h3>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
        <p>Select an Excel or CSV file to begin parsing.</p>
      </div>
    );
  }

  const current = sheets[selectedSheetIndex];

  return (
    <div>
      <h3>Data Uploader &amp; KPI Import</h3>
      <div>
        <strong>File:</strong> {file ? file.name : 'n/a'}
      </div>
      <div>
        <label>Sheet:
          <select value={selectedSheetIndex} onChange={e => setSelectedSheetIndex(Number(e.target.value))}>
            {sheets.map((s, idx) => <option key={s.name} value={idx}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <div>
        <label>Target Table:
          <input value={targetTable} onChange={e => updateTargetTable(e.target.value)} placeholder="eg budgets, financials" />
        </label>
      </div>

      <h4>Column mapping (source -&gt; target)</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ccc' }}>Source Column</th>
            <th style={{ borderBottom: '1px solid #ccc' }}>Target Column</th>
          </tr>
        </thead>
        <tbody>
          {current.headers.map(h => (
            <tr key={h}>
              <td style={{ padding: '4px', borderBottom: '1px solid #eee' }}>{h}</td>
              <td style={{ padding: '4px', borderBottom: '1px solid #eee' }}>
                <input value={mapping[h] || ''} onChange={e => updateMapping(h, e.target.value)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Preview (first 5 rows)</h4>
      <div style={{ maxHeight: '220px', overflow: 'auto', border: '1px solid #ddd', padding: '8px' }}>
        <table>
          <thead>
            <tr>
              {current.headers.map(h => <th key={h} style={{ padding: '4px' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {current.rows.slice(0, 5).map((r, i) => (
              <tr key={i}>
                {current.headers.map(h => <td key={h} style={{ padding: '4px' }}>{String(r[h] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '12px' }}>
        <button onClick={handleSave} disabled={!targetTable}>Save</button>
        <label style={{ marginLeft: '12px' }}>
          <input type="checkbox" checked={autosave} onChange={e => setAutosave(e.target.checked)} /> Autosave
        </label>
        <span style={{ marginLeft: '12px' }}>{status}</span>
      </div>
    </div>
  );
}