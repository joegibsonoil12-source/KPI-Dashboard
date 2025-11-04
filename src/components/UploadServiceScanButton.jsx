/**
 * Upload Service Scan Button Component
 * 
 * Provides a button to upload scanned service tickets directly to delivery tickets
 * Creates ticket_imports and processes them via client-side Supabase flow
 * 
 * GitHub Pages compatible - uses Supabase client directly instead of server endpoints
 */

import React, { useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function UploadServiceScanButton() {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorModal, setErrorModal] = useState(null);
  const fileInputRef = useRef(null);
  
  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setErrorModal(null);
    
    try {
      // Pre-upload diagnostics
      console.debug('[UploadServiceScanButton] === Upload Diagnostics ===');
      console.debug('[UploadServiceScanButton] Files selected:', files.length);
      console.debug('[UploadServiceScanButton] File details:', Array.from(files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      })));
      
      // Get Supabase credentials (support window.__ENV override for GitHub Pages)
      const supabaseUrl = 
        (typeof window !== 'undefined' && window.__ENV?.VITE_SUPABASE_URL) ||
        import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = 
        (typeof window !== 'undefined' && window.__ENV?.VITE_SUPABASE_ANON_KEY) ||
        import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      console.debug('[UploadServiceScanButton] Supabase URL:', supabaseUrl ? '✓ configured' : '✗ missing');
      console.debug('[UploadServiceScanButton] Supabase Anon Key:', supabaseAnonKey ? '✓ configured' : '✗ missing');
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      }
      
      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.debug('[UploadServiceScanButton] Supabase client created');
      
      // Helper function to generate timestamp for file paths
      const generateTimestamp = () => {
        return new Date().toISOString().replace(/[:T.]/g, '-').slice(0, 19);
      };
      
      // Helper function to sanitize file names
      const sanitizeFileName = (fileName) => {
        // Remove path traversal patterns and special characters
        return fileName
          .replace(/\.\./g, '')
          .replace(/[\/\\]/g, '_')
          .replace(/[^a-zA-Z0-9._-]/g, '_');
      };
      
      // Upload files to 'ticket-scans' bucket
      const attached_files = [];
      const timestamp = generateTimestamp();
      
      for (const file of Array.from(files)) {
        const sanitizedName = sanitizeFileName(file.name);
        const dest = `upload_${timestamp}/${sanitizedName}`;
        
        console.debug(`[UploadServiceScanButton] Uploading file: ${file.name} -> ${dest}`);
        
        // Upload file to storage with robust error handling
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('ticket-scans')
          .upload(dest, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) {
          console.error('[UploadServiceScanButton] Upload error:', uploadError);
          
          // Handle specific error cases
          if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket not found')) {
            throw new Error(
              `Storage bucket 'ticket-scans' not found. Please create the bucket in Supabase Dashboard. ` +
              `See SUPABASE_UPLOAD_SETUP.md for instructions.`
            );
          } else if (uploadError.message?.includes('permission') || uploadError.message?.includes('policy')) {
            throw new Error(
              `Permission denied for storage upload. Please verify RLS policies are configured. ` +
              `Run the SQL from STORAGE_BUCKET_SETUP.sql in Supabase SQL Editor.`
            );
          } else {
            throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
          }
        }
        
        console.debug(`[UploadServiceScanButton] File uploaded successfully: ${dest}`);
        
        // Create signed URL for the uploaded file
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('ticket-scans')
          .createSignedUrl(dest, 3600);
        
        if (signedUrlError) {
          console.error('[UploadServiceScanButton] Signed URL error:', signedUrlError);
          // Non-fatal, continue without signed URL
        } else {
          console.debug(`[UploadServiceScanButton] Signed URL created: ${signedUrlData?.signedUrl ? '✓' : '✗'}`);
        }
        
        // Build attached file metadata
        attached_files.push({
          name: file.name,
          mimetype: file.type,
          storage_path: dest,
          url: signedUrlData?.signedUrl || null
        });
      }
      
      console.debug('[UploadServiceScanButton] Files uploaded:', attached_files.length);
      
      // Insert ticket_imports draft row
      console.debug('[UploadServiceScanButton] Creating ticket_imports record...');
      const { data: importRecord, error: insertError } = await supabase
        .from('ticket_imports')
        .insert({
          src: 'upload',
          attached_files: attached_files,
          status: 'pending',
          meta: {
            importType: 'service',
            source: 'delivery_page_upload'
          }
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('[UploadServiceScanButton] Insert error:', insertError);
        
        // Handle specific error cases
        if (insertError.message?.includes('permission') || insertError.message?.includes('policy')) {
          throw new Error(
            `Permission denied for creating import record. Please verify anon RLS policies. ` +
            `Run the SQL from supabase/migrations/0005_enable_anon_ticket_imports.sql`
          );
        } else {
          throw new Error(`Failed to create import record: ${insertError.message}`);
        }
      }
      
      const importId = importRecord.id;
      console.debug(`[imports/upload] source=delivery_page_upload id=${importId} files=${attached_files.length}`);
      
      setUploading(false);
      
      // Best-effort POST to /api/imports/process/:id (ignore failure)
      setProcessing(true);
      try {
        const processResponse = await fetch(`/api/imports/process/${importId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (processResponse.ok) {
          console.debug('[UploadServiceScanButton] Processing triggered successfully');
        } else {
          console.warn('[UploadServiceScanButton] Processing trigger failed (non-fatal)');
        }
      } catch (processError) {
        console.debug('[UploadServiceScanButton] Processing trigger failed (non-fatal):', processError.message);
      }
      setProcessing(false);
      
      // Navigate to imports review tab
      // Store import ID for highlighting in the review page
      sessionStorage.setItem('highlightImportId', importId);
      
      // Dispatch custom event to trigger tab navigation
      // The App component will listen for this event
      window.dispatchEvent(new CustomEvent('navigateToImports', { 
        detail: { importId } 
      }));
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('[UploadServiceScanButton] Error:', error);
      console.error('[UploadServiceScanButton] Error stack:', error.stack);
      
      // Show user-friendly error modal (without sensitive stack trace)
      setErrorModal({
        title: 'Upload Failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
      
      setUploading(false);
      setProcessing(false);
    }
  };
  
  const closeErrorModal = () => {
    setErrorModal(null);
  };
  
  const buttonText = () => {
    if (uploading) return '⏳ Uploading...';
    if (processing) return '🔄 Processing...';
    return '📄 Upload Service Scan';
  };
  
  return (
    <>
      <button
        className="rounded-lg border px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || processing}
        title="Upload scanned service tickets (PDF/Image) for processing"
      >
        {buttonText()}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.gif"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      
      {/* Error Modal */}
      {errorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <span className="text-2xl mr-2">⚠️</span>
                <h3 className="text-lg font-semibold text-gray-900">{errorModal.title}</h3>
              </div>
              <button
                onClick={closeErrorModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-700 whitespace-pre-wrap">{errorModal.message}</p>
            </div>
            
            {errorModal.timestamp && (
              <p className="text-xs text-gray-500 mb-4">
                Time: {new Date(errorModal.timestamp).toLocaleString()}
              </p>
            )}
            
            <div className="flex justify-end gap-2">
              <button
                onClick={closeErrorModal}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
