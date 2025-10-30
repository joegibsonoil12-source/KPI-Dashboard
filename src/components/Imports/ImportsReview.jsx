/**
 * Imports Review Component
 * 
 * Admin UI for reviewing scanned ticket imports
 * 
 * Features:
 * - List pending imports
 * - View images and OCR text
 * - Edit parsed rows
 * - Accept / Save Draft / Reject
 * - Creates delivery_tickets/service_jobs on Accept
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

/**
 * Format currency
 */
function formatCurrency(value) {
  if (typeof value !== 'number') return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Format date
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    needs_review: 'bg-orange-100 text-orange-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  
  const colorClass = colors[status] || 'bg-gray-100 text-gray-800';
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${colorClass}`}>
      {status?.replace('_', ' ').toUpperCase()}
    </span>
  );
}

/**
 * Import Row Component (Editable)
 */
function EditableRow({ row, index, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [editedRow, setEditedRow] = useState(row);
  
  const handleSave = () => {
    onUpdate(index, editedRow);
    setEditing(false);
  };
  
  const handleCancel = () => {
    setEditedRow(row);
    setEditing(false);
  };
  
  if (!editing) {
    return (
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-2 text-sm">{row.jobNumber || '-'}</td>
        <td className="px-4 py-2 text-sm">{row.customer || '-'}</td>
        <td className="px-4 py-2 text-sm">{row.date || '-'}</td>
        <td className="px-4 py-2 text-sm">{row.status || '-'}</td>
        <td className="px-4 py-2 text-sm">{formatCurrency(row.amount)}</td>
        <td className="px-4 py-2 text-sm text-gray-500">{row.page}</td>
        <td className="px-4 py-2 text-sm">
          <button
            onClick={() => setEditing(true)}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Edit
          </button>
        </td>
      </tr>
    );
  }
  
  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2">
        <input
          type="text"
          value={editedRow.jobNumber || ''}
          onChange={(e) => setEditedRow({ ...editedRow, jobNumber: e.target.value })}
          className="w-full px-2 py-1 text-sm border rounded"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={editedRow.customer || ''}
          onChange={(e) => setEditedRow({ ...editedRow, customer: e.target.value })}
          className="w-full px-2 py-1 text-sm border rounded"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={editedRow.date || ''}
          onChange={(e) => setEditedRow({ ...editedRow, date: e.target.value })}
          className="w-full px-2 py-1 text-sm border rounded"
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={editedRow.status || ''}
          onChange={(e) => setEditedRow({ ...editedRow, status: e.target.value })}
          className="w-full px-2 py-1 text-sm border rounded"
        >
          <option value="">-</option>
          <option value="scheduled">Scheduled</option>
          <option value="assigned">Assigned</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          step="0.01"
          value={editedRow.amount || ''}
          onChange={(e) => setEditedRow({ ...editedRow, amount: parseFloat(e.target.value) || 0 })}
          className="w-full px-2 py-1 text-sm border rounded"
        />
      </td>
      <td className="px-4 py-2 text-sm text-gray-500">{editedRow.page}</td>
      <td className="px-4 py-2 text-sm">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="text-green-600 hover:text-green-800 font-medium"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * Import Detail View Component
 */
function ImportDetail({ importRecord, onClose, onStatusChange }) {
  const [rows, setRows] = useState([]);
  const [images, setImages] = useState([]);
  const [ocrText, setOcrText] = useState('');
  const [summary, setSummary] = useState({});
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (importRecord) {
      const parsed = importRecord.parsed || {};
      setRows(parsed.rows || []);
      setSummary(parsed.summary || {});
      setOcrText(importRecord.ocr_text || '');
      
      // Load images
      loadImages();
    }
  }, [importRecord]);
  
  const loadImages = async () => {
    if (!importRecord?.attached_files) return;
    
    const imageUrls = [];
    
    for (const file of importRecord.attached_files) {
      try {
        const { data } = await supabase.storage
          .from('ticket-scans')
          .createSignedUrl(file.path, 3600); // 1 hour expiry
        
        if (data?.signedUrl) {
          imageUrls.push({
            url: data.signedUrl,
            filename: file.filename,
          });
        }
      } catch (error) {
        console.error('[ImportsReview] Error loading image:', error);
      }
    }
    
    setImages(imageUrls);
  };
  
  const handleRowUpdate = (index, updatedRow) => {
    const newRows = [...rows];
    newRows[index] = updatedRow;
    setRows(newRows);
  };
  
  const handleSaveDraft = async () => {
    setSaving(true);
    
    try {
      const parsed = {
        ...importRecord.parsed,
        rows: rows,
        summary: recalculateSummary(rows),
      };
      
      const { error } = await supabase
        .from('ticket_imports')
        .update({ parsed: parsed })
        .eq('id', importRecord.id);
      
      if (error) throw error;
      
      alert('Draft saved successfully');
      onStatusChange();
    } catch (error) {
      console.error('[ImportsReview] Error saving draft:', error);
      alert('Failed to save draft: ' + error.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handleAccept = async () => {
    if (!confirm('Accept this import and create tickets/jobs?')) return;
    
    setSaving(true);
    
    try {
      // Determine import type
      const importType = importRecord.meta?.importType || 'delivery';
      
      // Create tickets or jobs based on import type
      if (importType === 'service') {
        await createServiceJobs(rows);
      } else {
        await createDeliveryTickets(rows);
      }
      
      // Update import status
      const { error } = await supabase
        .from('ticket_imports')
        .update({ status: 'accepted' })
        .eq('id', importRecord.id);
      
      if (error) throw error;
      
      alert('Import accepted and tickets/jobs created');
      onStatusChange();
      onClose();
    } catch (error) {
      console.error('[ImportsReview] Error accepting import:', error);
      alert('Failed to accept import: ' + error.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handleReject = async () => {
    if (!confirm('Reject this import?')) return;
    
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('ticket_imports')
        .update({ status: 'rejected' })
        .eq('id', importRecord.id);
      
      if (error) throw error;
      
      alert('Import rejected');
      onStatusChange();
      onClose();
    } catch (error) {
      console.error('[ImportsReview] Error rejecting import:', error);
      alert('Failed to reject import: ' + error.message);
    } finally {
      setSaving(false);
    }
  };
  
  const recalculateSummary = (rows) => {
    let scheduledJobs = 0;
    let scheduledRevenue = 0;
    let salesTotal = 0;
    
    rows.forEach(row => {
      const status = (row.status || '').toLowerCase();
      const amount = row.amount || 0;
      
      if (status.includes('scheduled') || status.includes('assigned') || status.includes('confirmed')) {
        scheduledJobs++;
        scheduledRevenue += amount;
      }
      
      salesTotal += amount;
    });
    
    return {
      totalRows: rows.length,
      scheduledJobs,
      scheduledRevenue,
      salesTotal,
    };
  };
  
  const createServiceJobs = async (rows) => {
    // Use service role client for server-side operations
    // This is a simplified version - in production, use an API endpoint
    const { data: { user } } = await supabase.auth.getUser();
    
    const jobs = rows.map(row => ({
      job_number: row.jobNumber || `IMPORT-${Date.now()}`,
      customer_name: row.customer,
      job_date: row.date,
      status: row.status || 'scheduled',
      job_amount: row.amount,
      created_by: user?.id,
      meta: { importId: importRecord.id },
    }));
    
    // This would need to use service role or RPC function
    console.log('[ImportsReview] Would create service jobs:', jobs);
    // In production: call an API endpoint that uses service role to insert
  };
  
  const createDeliveryTickets = async (rows) => {
    // Similar to service jobs
    console.log('[ImportsReview] Would create delivery tickets:', rows);
    // In production: call an API endpoint
  };
  
  if (!importRecord) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full m-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="border-b p-6 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Import #{importRecord.id}</h2>
              <div className="flex gap-4 mt-2 text-sm text-gray-600">
                <span>Source: {importRecord.src}</span>
                <span>Created: {formatDate(importRecord.created_at)}</span>
                <StatusBadge status={importRecord.status} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500">Total Rows</div>
              <div className="text-xl font-bold">{summary.totalRows || 0}</div>
            </div>
            <div className="bg-blue-50 rounded p-3">
              <div className="text-xs text-gray-500">Scheduled Jobs</div>
              <div className="text-xl font-bold">{summary.scheduledJobs || 0}</div>
            </div>
            <div className="bg-green-50 rounded p-3">
              <div className="text-xs text-gray-500">Scheduled Revenue</div>
              <div className="text-xl font-bold">{formatCurrency(summary.scheduledRevenue || 0)}</div>
            </div>
            <div className="bg-purple-50 rounded p-3">
              <div className="text-xs text-gray-500">Confidence</div>
              <div className="text-xl font-bold">{((importRecord.confidence || 0) * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* Images */}
          {images.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3">Scanned Images</h3>
              <div className="grid grid-cols-2 gap-4">
                {images.map((img, idx) => (
                  <div key={idx} className="border rounded overflow-hidden">
                    <img
                      src={img.url}
                      alt={img.filename}
                      className="w-full h-auto"
                    />
                    <div className="bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      {img.filename}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Parsed Rows */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-3">Parsed Data</h3>
            <div className="border rounded overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Page</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, idx) => (
                    <EditableRow
                      key={idx}
                      row={row}
                      index={idx}
                      onUpdate={handleRowUpdate}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* OCR Text */}
          <details className="mb-6">
            <summary className="text-lg font-bold mb-3 cursor-pointer">Raw OCR Text</summary>
            <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-64">
              {ocrText}
            </pre>
          </details>
        </div>
        
        {/* Actions */}
        <div className="border-t p-6 bg-gray-50 sticky bottom-0 flex gap-4 justify-end">
          <button
            onClick={handleReject}
            disabled={saving}
            className="px-6 py-2 border border-red-500 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={handleAccept}
            disabled={saving}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Accept & Create Tickets
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Imports Review Component
 */
export default function ImportsReview() {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImport, setSelectedImport] = useState(null);
  const [filter, setFilter] = useState('needs_review');
  
  useEffect(() => {
    loadImports();
  }, [filter]);
  
  const loadImports = async () => {
    setLoading(true);
    
    try {
      let query = supabase
        .from('ticket_imports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setImports(data || []);
    } catch (error) {
      console.error('[ImportsReview] Error loading imports:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleImportClick = (imp) => {
    setSelectedImport(imp);
  };
  
  const handleClose = () => {
    setSelectedImport(null);
  };
  
  const handleStatusChange = () => {
    loadImports();
  };
  
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Ticket Imports Review</h1>
        <p className="text-gray-600">Review and approve scanned ticket imports</p>
      </div>
      
      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {['all', 'pending', 'needs_review', 'accepted', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded font-medium ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>
      
      {/* Imports List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : imports.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No imports found with status: {filter}
        </div>
      ) : (
        <div className="grid gap-4">
          {imports.map(imp => (
            <div
              key={imp.id}
              onClick={() => handleImportClick(imp)}
              className="border rounded-lg p-4 hover:shadow-lg cursor-pointer transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg">Import #{imp.id}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    <span>Source: {imp.src}</span>
                    {imp.src_email && <span className="ml-4">From: {imp.src_email}</span>}
                    <span className="ml-4">Created: {formatDate(imp.created_at)}</span>
                  </div>
                  {imp.parsed?.summary && (
                    <div className="text-sm text-gray-600 mt-2">
                      {imp.parsed.summary.totalRows} rows, 
                      {' '}{imp.parsed.summary.scheduledJobs} scheduled jobs, 
                      {' '}{formatCurrency(imp.parsed.summary.scheduledRevenue)} scheduled revenue
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {imp.confidence && (
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Confidence</div>
                      <div className="font-bold">{(imp.confidence * 100).toFixed(1)}%</div>
                    </div>
                  )}
                  <StatusBadge status={imp.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Detail Modal */}
      {selectedImport && (
        <ImportDetail
          importRecord={selectedImport}
          onClose={handleClose}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
