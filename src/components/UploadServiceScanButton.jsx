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
  const fileInputRef = useRef(null);
  
  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    
    try {
      console.debug('[UploadServiceScanButton] Uploading files:', files.length);
      
      // Get Supabase credentials (support window.__ENV override for GitHub Pages)
      const supabaseUrl = 
        (typeof window !== 'undefined' && window.__ENV?.VITE_SUPABASE_URL) ||
        import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = 
        (typeof window !== 'undefined' && window.__ENV?.VITE_SUPABASE_ANON_KEY) ||
        import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      }
      
      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // Upload files to 'ticket-scans' bucket
      const attached_files = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
      
      for (const file of Array.from(files)) {
        const dest = `upload_${timestamp}/${file.name}`;
        
        // Upload file to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('ticket-scans')
          .upload(dest, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) {
          console.error('[UploadServiceScanButton] Upload error:', uploadError);
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }
        
        // Create signed URL for the uploaded file
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('ticket-scans')
          .createSignedUrl(dest, 3600);
        
        if (signedUrlError) {
          console.error('[UploadServiceScanButton] Signed URL error:', signedUrlError);
          // Non-fatal, continue without signed URL
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
        throw new Error(`Failed to create import record: ${insertError.message}`);
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
      
      // Navigate to imports review - switch to imports tab and pass id parameter
      // For now, just show success and let user navigate manually
      alert(`Successfully uploaded ${attached_files.length} file(s). Switching to Imports Review...`);
      
      // Switch to imports tab by simulating tab click
      // Find the imports tab button and click it
      const importsTabs = document.querySelectorAll('[data-tab-key="imports"]');
      if (importsTabs.length > 0) {
        importsTabs[0].click();
      }
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('[UploadServiceScanButton] Error:', error);
      alert('Upload failed: ' + error.message);
      setUploading(false);
      setProcessing(false);
    }
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
    </>
  );
}
