/**
 * Ticket Import Review Page
 * 
 * Lists pending/needs_review imports
 * Shows images, OCR text, and editable parsed rows
 * Allows Accept/Save Draft/Reject actions
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ReviewPage() {
  const [imports, setImports] = useState([]);
  const [selectedImport, setSelectedImport] = useState(null);
  const [editedRows, setEditedRows] = useState([]);
  const [includedRows, setIncludedRows] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signedUrls, setSignedUrls] = useState({});

  /**
   * Load imports on mount
   */
  useEffect(() => {
    loadImports();
    
    // Check if specific import ID in URL
    const params = new URLSearchParams(window.location.search);
    const importId = params.get('id');
    if (importId) {
      loadImport(parseInt(importId));
    }
  }, []);

  /**
   * Load list of pending imports
   */
  const loadImports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ticket_imports')
        .select('*')
        .in('status', ['pending', 'needs_review'])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setImports(data || []);
    } catch (err) {
      console.error('[review] Error loading imports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load specific import and generate signed URLs
   */
  const loadImport = async (importId) => {
    try {
      const { data, error } = await supabase
        .from('ticket_imports')
        .select('*')
        .eq('id', importId)
        .single();

      if (error) {
        throw error;
      }

      setSelectedImport(data);
      setEditedRows(data.parsed?.rows || []);
      // Initialize all rows as included by default
      setIncludedRows(new Array(data.parsed?.rows?.length || 0).fill(true));
      // Initialize column map
      setColumnMap(data.parsed?.columnMap || {});

      // Generate signed URLs for attached files
      if (data.attached_files && data.attached_files.length > 0) {
        const urls = {};
        for (const file of data.attached_files) {
          const { data: urlData, error: urlError } = await supabase.storage
            .from('ticket-scans')
            .createSignedUrl(file.path, 3600); // 1 hour expiry

          if (!urlError && urlData) {
            urls[file.path] = urlData.signedUrl;
          }
        }
        setSignedUrls(urls);
      }
    } catch (err) {
      console.error('[review] Error loading import:', err);
      setError(err.message);
    }
  };

  /**
   * Handle row edit
   */
  const handleRowEdit = (index, field, value) => {
    setEditedRows(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  /**
   * Toggle row inclusion
   */
  const handleRowToggle = (index) => {
    setIncludedRows(prev => {
      const updated = [...prev];
      updated[index] = !updated[index];
      return updated;
    });
  };

  /**
   * Toggle all rows
   */
  const handleToggleAll = () => {
    const allIncluded = includedRows.every(v => v);
    setIncludedRows(new Array(includedRows.length).fill(!allIncluded));
  };

  /**
   * Save draft (update parsed data)
   */
  const handleSaveDraft = async () => {
    if (!selectedImport) return;

    try {
      // Filter to only included rows
      const rowsToSave = editedRows.filter((row, idx) => includedRows[idx]);
      
      const { error } = await supabase
        .from('ticket_imports')
        .update({
          parsed: {
            ...selectedImport.parsed,
            rows: rowsToSave,
          },
        })
        .eq('id', selectedImport.id);

      if (error) {
        throw error;
      }

      alert('Draft saved successfully');
      loadImports();
    } catch (err) {
      console.error('[review] Error saving draft:', err);
      alert('Failed to save draft: ' + err.message);
    }
  };

  /**
   * Accept import (create tickets/jobs)
   */
  const handleAccept = async () => {
    if (!selectedImport) return;

    const includedCount = includedRows.filter(v => v).length;
    
    if (includedCount === 0) {
      alert('No rows selected for import');
      return;
    }

    if (!confirm(`Accept this import and create ${includedCount} record(s)?`)) {
      return;
    }

    try {
      // First save any edits (this filters to included rows)
      await handleSaveDraft();

      // Call accept API
      const response = await fetch('/.netlify/functions/imports-accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          importId: selectedImport.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Accept failed');
      }

      let message = `Successfully created ${result.inserted || includedCount} record(s)`;
      if (result.failed > 0) {
        message += `\n${result.failed} row(s) failed validation`;
      }
      alert(message);
      
      setSelectedImport(null);
      loadImports();
    } catch (err) {
      console.error('[review] Error accepting import:', err);
      alert('Failed to accept import: ' + err.message);
    }
  };

  /**
   * Reject import
   */
  const handleReject = async () => {
    if (!selectedImport) return;

    if (!confirm('Reject this import? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ticket_imports')
        .update({
          status: 'rejected',
        })
        .eq('id', selectedImport.id);

      if (error) {
        throw error;
      }

      alert('Import rejected');
      setSelectedImport(null);
      loadImports();
    } catch (err) {
      console.error('[review] Error rejecting import:', err);
      alert('Failed to reject import: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Loading imports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Review Ticket Imports</h1>

      {!selectedImport ? (
        /* List View */
        <div>
          {imports.length === 0 ? (
            <p className="text-gray-600">No imports pending review</p>
          ) : (
            <div className="space-y-4">
              {imports.map(imp => (
                <div
                  key={imp.id}
                  onClick={() => loadImport(imp.id)}
                  className="border border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Import #{imp.id}</p>
                      <p className="text-sm text-gray-600">
                        Created: {new Date(imp.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Source: {imp.src} {imp.src_email && `(${imp.src_email})`}
                      </p>
                      {imp.parsed && (
                        <p className="text-sm text-gray-600">
                          Rows: {imp.parsed.rows?.length || 0} | 
                          Confidence: {(imp.confidence * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                      imp.status === 'needs_review' 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {imp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Detail View */
        <div>
          <button
            onClick={() => setSelectedImport(null)}
            className="mb-4 text-blue-600 hover:text-blue-800"
          >
            ← Back to list
          </button>

          <div className="space-y-6">
            {/* Import Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Import #{selectedImport.id}</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Created:</span> {new Date(selectedImport.created_at).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Source:</span> {selectedImport.src}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {selectedImport.status}
                </div>
                <div>
                  <span className="font-medium">Confidence:</span> {(selectedImport.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Detection Info */}
            {selectedImport.meta?.detection && (
              <div className={`p-4 rounded-lg border-2 ${
                selectedImport.meta.detection.type === 'delivery'
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-green-50 border-green-300'
              }`}>
                <h3 className="text-lg font-semibold mb-2">
                  Import Type Detection
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Detected Type:</span>{' '}
                    <span className={`px-2 py-1 rounded font-bold ${
                      selectedImport.meta.detection.type === 'delivery'
                        ? 'bg-blue-200 text-blue-900'
                        : 'bg-green-200 text-green-900'
                    }`}>
                      {selectedImport.meta.detection.type.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Detection Confidence:</span>{' '}
                    {(selectedImport.meta.detection.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">Matched Tokens:</span>{' '}
                    {selectedImport.meta.detection.hits?.join(', ') || 'None'}
                    {' '}({selectedImport.meta.detection.tokenCount || 0} matches)
                  </div>
                </div>
                {selectedImport.meta.importType && (
                  <div className="mt-2 text-sm">
                    <span className="font-medium">Import Type Set:</span>{' '}
                    <span className="text-blue-700 font-semibold">
                      {selectedImport.meta.importType}
                    </span>
                  </div>
                )}
                {selectedImport.meta.reclassified_at && (
                  <div className="mt-2 text-sm text-orange-700">
                    <span className="font-medium">⚠ Reclassified:</span>{' '}
                    {new Date(selectedImport.meta.reclassified_at).toLocaleString()}
                    {' '}by {selectedImport.meta.reclassified_by || 'unknown'}
                  </div>
                )}
              </div>
            )}

            {/* Column Mapping */}
            {selectedImport.parsed?.columnMap && (
              <div className="border border-gray-300 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Column Mapping</h3>
                  <button
                    onClick={() => setShowColumnMapper(!showColumnMapper)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {showColumnMapper ? 'Hide' : 'Show'} Mapper
                  </button>
                </div>
                
                {showColumnMapper && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-3">
                      Adjust how parsed columns map to database fields:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(columnMap).map(([colIdx, fieldName]) => (
                        <div key={colIdx} className="flex items-center gap-2 text-sm">
                          <label className="font-medium w-24">Column {colIdx}:</label>
                          <select
                            value={fieldName}
                            onChange={(e) => setColumnMap(prev => ({
                              ...prev,
                              [colIdx]: e.target.value
                            }))}
                            className="flex-1 border rounded px-2 py-1"
                          >
                            <option value="jobNumber">Job Number</option>
                            <option value="customer">Customer</option>
                            <option value="address">Address</option>
                            <option value="date">Date</option>
                            <option value="status">Status</option>
                            <option value="amount">Amount</option>
                            <option value="gallons">Gallons</option>
                            <option value="qty">Quantity</option>
                            <option value="driver">Driver</option>
                            <option value="truck">Truck</option>
                            <option value="tech">Technician</option>
                            <option value="description">Description</option>
                            <option value={`column${colIdx}`}>Generic (column{colIdx})</option>
                          </select>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        // Apply remapping to all rows using the updated columnMap
                        const remapped = editedRows.map(row => {
                          const newRow = { ...row }; // Keep existing fields
                          
                          // If row has rawColumns, remap them using new columnMap
                          if (row.rawColumns && Array.isArray(row.rawColumns)) {
                            row.rawColumns.forEach((value, idx) => {
                              const fieldName = columnMap[idx];
                              if (fieldName) {
                                // Update the field with the raw value
                                newRow[fieldName] = value;
                              }
                            });
                          }
                          
                          return newRow;
                        });
                        setEditedRows(remapped);
                        
                        // Also update the import's parsed data
                        setSelectedImport(prev => ({
                          ...prev,
                          parsed: {
                            ...prev.parsed,
                            columnMap: columnMap,
                            rows: remapped,
                          }
                        }));
                        
                        alert('Column mapping applied. Click Save Draft to persist changes.');
                      }}
                      className="mt-3 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                    >
                      Apply Mapping
                    </button>
                  </div>
                )}
                
                {!showColumnMapper && (
                  <div className="text-sm text-gray-600">
                    {Object.entries(columnMap).slice(0, 3).map(([idx, name]) => (
                      <span key={idx} className="inline-block mr-3">
                        Col {idx}: <strong>{name}</strong>
                      </span>
                    ))}
                    {Object.keys(columnMap).length > 3 && '...'}
                  </div>
                )}
              </div>
            )}

            {/* Attached Images */}
            {selectedImport.attached_files && selectedImport.attached_files.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Attached Files</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedImport.attached_files.map((file, idx) => (
                    <div key={idx} className="border rounded p-2">
                      {signedUrls[file.path] && file.mimeType.startsWith('image/') && (
                        <img
                          src={signedUrls[file.path]}
                          alt={file.filename}
                          className="w-full h-auto"
                        />
                      )}
                      <p className="text-sm mt-2">{file.filename}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OCR Text */}
            {selectedImport.ocr_text && (
              <div>
                <h3 className="text-lg font-semibold mb-3">OCR Text</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-60">
                  {selectedImport.ocr_text}
                </pre>
              </div>
            )}

            {/* Parsed Rows */}
            {editedRows.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">
                    Parsed Data ({editedRows.length} rows)
                  </h3>
                  <div className="text-sm">
                    <span className="font-medium">Estimated Insert Count:</span>{' '}
                    <span className="text-blue-600 font-bold text-lg">
                      {includedRows.filter(v => v).length}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-2 py-2 text-center text-sm">
                          <input
                            type="checkbox"
                            checked={includedRows.every(v => v)}
                            onChange={handleToggleAll}
                            title="Toggle All"
                          />
                        </th>
                        <th className="border px-3 py-2 text-left text-sm">Job #</th>
                        <th className="border px-3 py-2 text-left text-sm">Customer</th>
                        <th className="border px-3 py-2 text-left text-sm">Date</th>
                        <th className="border px-3 py-2 text-left text-sm">Status</th>
                        <th className="border px-3 py-2 text-left text-sm">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editedRows.map((row, idx) => (
                        <tr key={idx} className={!includedRows[idx] ? 'bg-gray-100 opacity-50' : ''}>
                          <td className="border px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={includedRows[idx] || false}
                              onChange={() => handleRowToggle(idx)}
                            />
                          </td>
                          <td className="border px-3 py-2">
                            <input
                              type="text"
                              value={row.jobNumber || ''}
                              onChange={(e) => handleRowEdit(idx, 'jobNumber', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="border px-3 py-2">
                            <input
                              type="text"
                              value={row.customer || ''}
                              onChange={(e) => handleRowEdit(idx, 'customer', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="border px-3 py-2">
                            <input
                              type="text"
                              value={row.date || ''}
                              onChange={(e) => handleRowEdit(idx, 'date', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="border px-3 py-2">
                            <input
                              type="text"
                              value={row.status || ''}
                              onChange={(e) => handleRowEdit(idx, 'status', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="border px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={row.amount || 0}
                              onChange={(e) => handleRowEdit(idx, 'amount', parseFloat(e.target.value))}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Raw Columns Display */}
                <details className="mt-4 border border-gray-300 rounded p-3">
                  <summary className="cursor-pointer font-medium text-sm text-gray-700 hover:text-gray-900">
                    Show Raw Column Values (for debugging)
                  </summary>
                  <div className="mt-3 space-y-2">
                    {editedRows.slice(0, 5).map((row, idx) => (
                      <div key={idx} className="text-xs bg-gray-50 p-2 rounded border">
                        <span className="font-medium">Row {idx + 1}:</span>{' '}
                        {row.rawColumns ? (
                          <pre className="whitespace-pre-wrap">{JSON.stringify(row.rawColumns, null, 2)}</pre>
                        ) : (
                          <span className="text-gray-500">No raw data available</span>
                        )}
                      </div>
                    ))}
                    {editedRows.length > 5 && (
                      <p className="text-xs text-gray-500 italic">
                        Showing first 5 rows only. Total: {editedRows.length} rows
                      </p>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleAccept}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
              >
                Accept & Create Records
              </button>
              <button
                onClick={handleSaveDraft}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                Save Draft
              </button>
              <button
                onClick={handleReject}
                className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
