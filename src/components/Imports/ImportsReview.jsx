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
function EditableRow({ row, index, onUpdate, included, onIncludeChange, importType }) {
  const [editing, setEditing] = useState(false);
  const [editedRow, setEditedRow] = useState(row);
  const [showRaw, setShowRaw] = useState(false);
  
  const handleSave = () => {
    onUpdate(index, editedRow);
    setEditing(false);
  };
  
  const handleCancel = () => {
    setEditedRow(row);
    setEditing(false);
  };
  
  // Determine which fields to show based on import type
  const isDelivery = importType === 'delivery';
  
  if (!editing) {
    return (
      <>
        <tr className={included ? "hover:bg-gray-50" : "bg-gray-100 text-gray-400 hover:bg-gray-100"}>
          <td className="px-4 py-2 text-sm">
            <input
              type="checkbox"
              checked={included}
              onChange={(e) => onIncludeChange(index, e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </td>
          {isDelivery ? (
            <>
              <td className="px-4 py-2 text-sm">{row.customerName || row.customer || '-'}</td>
              <td className="px-4 py-2 text-sm">{row.truck || row.driver || '-'}</td>
              <td className="px-4 py-2 text-sm">{row.qty || row.gallons || '-'}</td>
            </>
          ) : (
            <>
              <td className="px-4 py-2 text-sm">{row.jobNumber || '-'}</td>
              <td className="px-4 py-2 text-sm">{row.customer || '-'}</td>
            </>
          )}
          <td className="px-4 py-2 text-sm">{row.date || '-'}</td>
          <td className="px-4 py-2 text-sm">{row.status || '-'}</td>
          <td className="px-4 py-2 text-sm">{formatCurrency(row.amount)}</td>
          <td className="px-4 py-2 text-sm text-gray-500">{row.page}</td>
          <td className="px-4 py-2 text-sm">
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="text-blue-600 hover:text-blue-800 font-medium text-xs"
              >
                Edit
              </button>
              {row.rawColumns && (
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-gray-600 hover:text-gray-800 font-medium text-xs"
                >
                  {showRaw ? 'Hide' : 'Raw'}
                </button>
              )}
            </div>
          </td>
        </tr>
        {showRaw && row.rawColumns && (
          <tr className="bg-gray-50">
            <td colSpan={isDelivery ? 9 : 8} className="px-4 py-2 text-xs text-gray-600">
              <div className="font-medium mb-1">Raw Columns:</div>
              <div className="font-mono">{JSON.stringify(row.rawColumns)}</div>
            </td>
          </tr>
        )}
      </>
    );
  }
  
  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2">
        <input
          type="checkbox"
          checked={included}
          onChange={(e) => onIncludeChange(index, e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
        />
      </td>
      {isDelivery ? (
        <>
          <td className="px-4 py-2">
            <input
              type="text"
              value={editedRow.customerName || editedRow.customer || ''}
              onChange={(e) => setEditedRow({ ...editedRow, customerName: e.target.value, customer: e.target.value })}
              className="w-full px-2 py-1 text-sm border rounded"
              placeholder="Customer"
            />
          </td>
          <td className="px-4 py-2">
            <input
              type="text"
              value={editedRow.truck || editedRow.driver || ''}
              onChange={(e) => setEditedRow({ ...editedRow, truck: e.target.value })}
              className="w-full px-2 py-1 text-sm border rounded"
              placeholder="Truck/Driver"
            />
          </td>
          <td className="px-4 py-2">
            <input
              type="number"
              step="0.01"
              value={editedRow.qty || editedRow.gallons || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setEditedRow({ ...editedRow, qty: val });
              }}
              className="w-full px-2 py-1 text-sm border rounded"
              placeholder="Qty/Gallons"
            />
          </td>
        </>
      ) : (
        <>
          <td className="px-4 py-2">
            <input
              type="text"
              value={editedRow.jobNumber || ''}
              onChange={(e) => setEditedRow({ ...editedRow, jobNumber: e.target.value })}
              className="w-full px-2 py-1 text-sm border rounded"
              placeholder="Job #"
            />
          </td>
          <td className="px-4 py-2">
            <input
              type="text"
              value={editedRow.customer || ''}
              onChange={(e) => setEditedRow({ ...editedRow, customer: e.target.value })}
              className="w-full px-2 py-1 text-sm border rounded"
              placeholder="Customer"
            />
          </td>
        </>
      )}
      <td className="px-4 py-2">
        <input
          type="text"
          value={editedRow.date || ''}
          onChange={(e) => setEditedRow({ ...editedRow, date: e.target.value })}
          className="w-full px-2 py-1 text-sm border rounded"
          placeholder="Date"
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
          placeholder="Amount"
        />
      </td>
      <td className="px-4 py-2 text-sm text-gray-500">{editedRow.page}</td>
      <td className="px-4 py-2 text-sm">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="text-green-600 hover:text-green-800 font-medium text-xs"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="text-gray-600 hover:text-gray-800 font-medium text-xs"
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
  const [includedRows, setIncludedRows] = useState([]);
  const [images, setImages] = useState([]);
  const [failedImages, setFailedImages] = useState([]);
  const [ocrText, setOcrText] = useState('');
  const [summary, setSummary] = useState({});
  const [detection, setDetection] = useState(null);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (importRecord) {
      const parsed = importRecord.parsed || {};
      const parsedRows = parsed.rows || [];
      setRows(parsedRows);
      // Initialize all rows as included
      setIncludedRows(parsedRows.map(() => true));
      setSummary(parsed.summary || {});
      setOcrText(importRecord.ocr_text || '');
      setDetection(importRecord.meta?.detection || null);
      
      // Load images
      loadImages();
    }
  }, [importRecord]);
  
  const handleAddRow = () => {
    const newRow = {
      jobNumber: '',
      customer: '',
      date: '',
      status: '',
      amount: '',
      gallons: '',
      page: 1,
      y: 0,
    };

    setRows(prev => [...prev, newRow]);
    setIncludedRows(prev => [...prev, true]);
  };
  
  const loadImages = async () => {
    try {
      // Defensive check: ensure attached_files is an array
      const files = Array.isArray(importRecord?.attached_files)
        ? importRecord.attached_files
        : [];
      
      // Filter out invalid files early
      const validFiles = files.filter(
        (f) => f && typeof f.path === 'string' && f.path.trim() !== ''
      );
      
      if (validFiles.length === 0) {
        console.warn('[ImportsReview] No valid attached_files for import', importRecord?.id);
        setImages([]);
        setFailedImages(files.length > 0 ? ['Invalid file entries found'] : []);
        return;
      }
      
      const imageUrls = [];
      const failedImagesList = [];
      
      for (const file of validFiles) {
        try {
          const rawPath = file.path;
          const cleanPath = rawPath.replace(/^public\//, '');
          
          const { data, error } = await supabase.storage
            .from('ticket-scans')
            .createSignedUrl(cleanPath, 3600); // 1 hour expiry
          
          if (error) {
            console.error('[ImportsReview] Error loading image:', file.filename || cleanPath, error);
            failedImagesList.push(file.filename || cleanPath);
            continue;
          }
          
          if (data?.signedUrl) {
            imageUrls.push({
              url: data.signedUrl,
              filename: file.filename || file.name || cleanPath,
            });
          } else {
            console.warn('[ImportsReview] No signed URL for image:', file.filename || cleanPath);
            failedImagesList.push(file.filename || cleanPath);
          }
        } catch (err) {
          console.error('[ImportsReview] Error handling file', file, err);
          failedImagesList.push(file.filename || file.path || 'unknown');
        }
      }
      
      if (failedImagesList.length > 0) {
        console.warn('[ImportsReview] Failed to load images:', failedImagesList.join(', '));
      }
      
      setImages(imageUrls);
      setFailedImages(failedImagesList);
    } catch (err) {
      console.error('[ImportsReview] Failed to load images', err);
      setImages([]);
      setFailedImages(['Failed to load images. Check console logs for details.']);
    }
  };
  
  const handleRowUpdate = (index, updatedRow) => {
    const newRows = [...rows];
    newRows[index] = updatedRow;
    setRows(newRows);
  };
  
  const handleIncludeChange = (index, included) => {
    const newIncludedRows = [...includedRows];
    newIncludedRows[index] = included;
    setIncludedRows(newIncludedRows);
  };
  
  const getIncludedRowsCount = () => {
    return includedRows.filter(Boolean).length;
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
    const includedCount = getIncludedRowsCount();
    if (includedCount === 0) {
      alert('No rows selected. Please select at least one row to import.');
      return;
    }
    
    if (!confirm(`Accept this import and create ${includedCount} ticket(s)/job(s)?`)) return;
    
    setSaving(true);
    
    try {
      // Filter to only included rows
      const rowsToImport = rows.filter((_, idx) => includedRows[idx]);
      
      // IMPORTANT: Update the import record with filtered rows first
      // This ensures the backend processes only the selected rows
      const parsed = {
        ...importRecord.parsed,
        rows: rowsToImport,
        summary: recalculateSummary(rowsToImport),
      };
      
      const { error: updateError } = await supabase
        .from('ticket_imports')
        .update({ parsed: parsed })
        .eq('id', importRecord.id);
      
      if (updateError) {
        throw new Error(`Failed to update import with selected rows: ${updateError.message}`);
      }
      
      // Now call the netlify function to accept and create records
      const response = await fetch('/.netlify/functions/imports-accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          importId: importRecord.id,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to accept import');
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to accept import');
      }
      
      // Build success message with details
      let successMessage = `Import accepted successfully!\n\nCreated: ${result.inserted || 0} record(s)`;
      
      if (result.failed > 0) {
        successMessage += `\nFailed: ${result.failed} record(s)`;
        
        // Show details of first few failed rows if available
        if (result.failedRows && result.failedRows.length > 0) {
          successMessage += '\n\nFailed rows:';
          result.failedRows.slice(0, 3).forEach(failed => {
            successMessage += `\n  Row ${failed.index + 1}: ${failed.reason}`;
          });
          
          if (result.failedRows.length > 3) {
            successMessage += `\n  ... and ${result.failedRows.length - 3} more`;
          }
        }
      }
      
      alert(successMessage);
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
  
  if (!importRecord) return null;
  
  const hasNoRows = !rows || rows.length === 0;
  const isLowConfidence =
    typeof importRecord?.parsed?.confidence === 'number'
      ? importRecord.parsed.confidence === 0
      : !importRecord?.parsed?.confidence;
  
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
              {detection && (
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    detection.type === 'delivery' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {detection.type?.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-600">
                    Confidence: {((detection.confidence || 0) * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-gray-600">
                    ({detection.hits?.length || 0} tokens matched)
                  </span>
                  {detection.hits && detection.hits.length > 0 && (
                    <span className="text-xs text-gray-500">
                      [{detection.hits.join(', ')}]
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          
          {/* Summary */}
          <div className="grid grid-cols-5 gap-4 mt-4">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500">Total Rows</div>
              <div className="text-xl font-bold">{summary.totalRows || 0}</div>
            </div>
            <div className="bg-blue-50 rounded p-3">
              <div className="text-xs text-gray-500">Selected to Import</div>
              <div className="text-xl font-bold text-blue-600">{getIncludedRowsCount()}</div>
            </div>
            <div className="bg-green-50 rounded p-3">
              <div className="text-xs text-gray-500">Scheduled Jobs</div>
              <div className="text-xl font-bold">{summary.scheduledJobs || 0}</div>
            </div>
            <div className="bg-green-50 rounded p-3">
              <div className="text-xs text-gray-500">Scheduled Revenue</div>
              <div className="text-xl font-bold">{formatCurrency(summary.scheduledRevenue || 0)}</div>
            </div>
            <div className="bg-purple-50 rounded p-3">
              <div className="text-xs text-gray-500">OCR Confidence</div>
              <div className="text-xl font-bold">{((importRecord.confidence || 0) * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* Warning banner for failed images */}
          {failedImages.length > 0 && (
            <div className="mb-6 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">
                    {failedImages.length} image(s) failed to load
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Files: {failedImages.join(', ')}
                  </p>
                  <p className="text-xs text-yellow-600 mt-2">
                    This may be due to expired storage URLs or missing files. Contact your administrator if this persists.
                  </p>
                </div>
              </div>
            </div>
          )}
          
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
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold">
                Parsed Data 
                <span className="ml-2 text-sm font-normal text-gray-600">
                  (Type: {importRecord.meta?.importType || 'service'})
                </span>
              </h3>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Add Row
              </button>
            </div>
            
            {/* Warning banner for empty rows */}
            {hasNoRows && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">
                      No rows were parsed from this file. This usually means OCR couldn't read the scan or isn't fully configured. 
                      You can type rows manually below, or re-upload a clearer scan.
                    </p>
                    {isLowConfidence && (
                      <p className="text-sm text-yellow-700 mt-2">
                        Ask your admin to check GOOGLE_VISION_API_KEY on the server if this happens often.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="border rounded overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <input
                        type="checkbox"
                        checked={includedRows.length > 0 && includedRows.every(Boolean)}
                        ref={(el) => {
                          if (el) {
                            const someChecked = includedRows.some(Boolean);
                            const allChecked = includedRows.every(Boolean);
                            el.indeterminate = someChecked && !allChecked;
                          }
                        }}
                        onChange={(e) => setIncludedRows(rows.map(() => e.target.checked))}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        title="Select/Deselect All"
                      />
                    </th>
                    {importRecord.meta?.importType === 'delivery' ? (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Truck/Driver</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      </>
                    )}
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
                      included={includedRows[idx]}
                      onIncludeChange={handleIncludeChange}
                      importType={importRecord.meta?.importType || 'service'}
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
  const [highlightId, setHighlightId] = useState(null);
  
  useEffect(() => {
    loadImports();
    
    // Check if there's a highlighted import ID from upload
    const highlightImportId = sessionStorage.getItem('highlightImportId');
    if (highlightImportId) {
      setHighlightId(parseInt(highlightImportId, 10));
      sessionStorage.removeItem('highlightImportId');
    }
  }, [filter]);
  
  // Auto-select highlighted import after data is loaded
  useEffect(() => {
    if (highlightId && imports.length > 0 && !loading) {
      const imp = imports.find(i => i.id === highlightId);
      if (imp) {
        setSelectedImport(imp);
        setHighlightId(null); // Clear after selection
      }
    }
  }, [imports, highlightId, loading]);
  
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
              className={`border rounded-lg p-4 hover:shadow-lg cursor-pointer transition-shadow ${
                highlightId === imp.id ? 'border-green-500 border-2 bg-green-50' : ''
              }`}
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
