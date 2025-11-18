/**
 * Financial Health - Monthly Uploads Page
 * 
 * Allows upload of QuickBooks report files and displays upload history
 */

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const REPORT_TYPES = [
  { value: 'profit_loss', label: 'Profit and Loss' },
  { value: 'profit_loss_by_class', label: 'Profit and Loss by Class' },
  { value: 'profit_loss_by_location', label: 'Profit and Loss by Location' },
  { value: 'balance_sheet', label: 'Balance Sheet' },
  { value: 'cash_flow_statement', label: 'Statement of Cash Flows' },
  { value: 'ar_aging_summary', label: 'AR Aging Summary' },
  { value: 'ap_aging_summary', label: 'AP Aging Summary' },
  { value: 'sales_by_product', label: 'Sales by Product/Service' },
  { value: 'expenses_by_vendor', label: 'Expenses by Vendor' },
  { value: 'payroll_summary', label: 'Payroll Summary' },
];

export default function FinancialUploads() {
  const [uploading, setUploading] = useState(false);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('');
  const [period, setPeriod] = useState('');
  const fileInputRef = useRef(null);

  // Fetch existing imports
  useEffect(() => {
    fetchImports();
  }, []);

  async function fetchImports() {
    try {
      const { data, error } = await supabase
        .from('financial_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setImports(data || []);
    } catch (error) {
      console.error('Error fetching imports:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSelect(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const file = files[0];

      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result.split(',')[1];
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call upload endpoint
      const response = await fetch('/.netlify/functions/financial-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{
            filename: file.name,
            mimeType: file.type,
            data: base64,
          }],
          reportType: reportType || undefined,
          period: period || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const result = await response.json();
      alert(`✅ Successfully uploaded ${result.type} for period ${result.period}`);

      // Refresh imports list
      fetchImports();

      // Clear inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setReportType('');
      setPeriod('');
    } catch (error) {
      console.error('Upload error:', error);
      alert(`❌ Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  function formatReportType(type) {
    const report = REPORT_TYPES.find(r => r.value === type);
    return report ? report.label : type;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>📊 Financial Uploads</h1>
      <p style={{ color: '#6B7280', marginBottom: 24 }}>
        Upload QuickBooks reports (Excel/CSV) for automated financial KPI tracking
      </p>

      {/* Upload Form */}
      <div style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Upload New Report</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Report Type (optional - will auto-detect)
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
              }}
            >
              <option value="">Auto-detect</option>
              {REPORT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Period (optional - will auto-extract)
            </label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="YYYY-MM or YYYY-Q1"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #3B82F6',
              background: uploading ? '#9CA3AF' : '#3B82F6',
              color: 'white',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            {uploading ? '⏳ Uploading...' : '📤 Choose File'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <span style={{ marginLeft: 12, fontSize: 14, color: '#6B7280' }}>
            Accepts Excel (.xlsx, .xls) and CSV files
          </span>
        </div>

        <div style={{ fontSize: 13, color: '#6B7280', padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
          <strong>Tip:</strong> Export reports from QuickBooks using the "Export" button.
          The parser will automatically detect the report type and period from the file content.
        </div>
      </div>

      {/* Imports List */}
      <div style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: 24,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Upload History</h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
            Loading...
          </div>
        ) : imports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
            No uploads yet. Upload your first QuickBooks report to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600 }}>Period</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600 }}>Report Type</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600 }}>File</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600 }}>Uploaded</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>Rows</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((imp, idx) => (
                  <tr
                    key={imp.id}
                    style={{
                      borderBottom: idx < imports.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                  >
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontWeight: 500 }}>{imp.period}</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {formatReportType(imp.type)}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: 13, color: '#6B7280' }}>
                      {imp.file_metadata?.filename || 'N/A'}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: 13, color: '#6B7280' }}>
                      {new Date(imp.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13 }}>
                      {imp.parsed?.length || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
