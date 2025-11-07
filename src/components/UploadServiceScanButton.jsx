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
import { saveLocalImport } from '../lib/localImports.js';

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
      
      // Enhanced diagnostics with URL truncation for security
      const truncateUrl = (url) => url ? `${url.substring(0, 30)}...` : 'missing';
      console.debug('[UploadServiceScanButton] Supabase URL (truncated):', truncateUrl(supabaseUrl));
      console.debug('[UploadServiceScanButton] Supabase Anon Key:', supabaseAnonKey ? '✓ present' : '✗ missing');
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      }
      
      // Create Supabase client
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.debug('[UploadServiceScanButton] Supabase client created');
      
      // Diagnostic: Test bucket access before upload
      console.debug('[UploadServiceScanButton] Testing bucket access...');
      try {
        const { data: bucketTest, error: bucketTestError } = await supabase.storage
          .from('ticket-scans')
          .list('', { limit: 1 });
        
        if (bucketTestError) {
          console.error('[UploadServiceScanButton] Bucket test error:', bucketTestError.message);
          if (bucketTestError.message?.includes('not found') || bucketTestError.message?.includes('Bucket not found')) {
            throw new Error(
              `Storage bucket 'ticket-scans' not found. ` +
              `Please create it in Supabase Dashboard or run: supabase storage create-bucket ticket-scans --public false. ` +
              `See SUPABASE_UPLOAD_SETUP.md for detailed instructions.`
            );
          }
        } else {
          console.debug('[UploadServiceScanButton] Bucket access test: ✓ OK');
        }
      } catch (testError) {
        // If it's already our formatted error, re-throw it
        if (testError.message?.includes('Storage bucket')) {
          throw testError;
        }
        console.warn('[UploadServiceScanButton] Bucket test failed (will retry on upload):', testError.message);
      }
      
      // Helper function to generate timestamp for file paths
      const generateTimestamp = () => {
        return new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
      };
      
      // Helper function to sanitize file names
      const sanitizeFileName = (fileName) => {
        // Remove path traversal patterns and special characters
        return fileName
          .replace(/\.\./g, '')
          .replace(/[\/\\]/g, '_')
          .replace(/[^a-zA-Z0-9._-]/g, '_');
      };
      
      // Helper function to convert file to base64
      const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };
      
      // Helper function to convert all files to base64 for local storage
      const convertFilesToBase64 = async (files) => {
        const filesWithBase64 = [];
        for (const f of Array.from(files)) {
          const base64 = await fileToBase64(f);
          filesWithBase64.push({
            name: f.name,
            mimetype: f.type,
            size: f.size,
            base64: base64,
          });
        }
        return filesWithBase64;
      };
      
      // Helper function to upload file via server endpoint
      const uploadViaServer = async (file) => {
        const base64 = await fileToBase64(file);
        
        // Get server upload endpoint URL from environment or use default relative path
        const uploadEndpoint = 
          (typeof window !== 'undefined' && window.__ENV?.VITE_UPLOADS_SIGNED_URL) ||
          import.meta.env.VITE_UPLOADS_SIGNED_URL ||
          '/api/uploads/signed';
        
        const serverResponse = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            base64: base64,
          }),
        });
        
        if (!serverResponse.ok) {
          const errorData = await serverResponse.json();
          throw new Error(errorData.error || `Server upload failed: ${serverResponse.status}`);
        }
        
        return await serverResponse.json();
      };
      
      // Upload files to 'ticket-scans' bucket
      const attached_files = [];
      const timestamp = generateTimestamp();
      let useServerUpload = false;
      
      for (const file of Array.from(files)) {
        const sanitizedName = sanitizeFileName(file.name);
        const dest = `upload_${timestamp}/${sanitizedName}`;
        
        console.debug(`[UploadServiceScanButton] Uploading file: ${file.name} -> ${dest}`);
        
        // Try direct client upload first
        let uploadData = null;
        let uploadError = null;
        
        if (!useServerUpload) {
          const result = await supabase.storage
            .from('ticket-scans')
            .upload(dest, file, {
              cacheControl: '3600',
              upsert: false
            });
          
          uploadData = result.data;
          uploadError = result.error;
        }
        
        if (uploadError) {
          console.error('[UploadServiceScanButton] Upload error:', uploadError);
          console.error('[UploadServiceScanButton] Upload error details:', {
            message: uploadError.message,
            status: uploadError.status,
            statusCode: uploadError.statusCode
          });
          
          // Handle specific error cases
          const errorMsg = uploadError.message || '';
          const errorStatus = uploadError.status || uploadError.statusCode;
          
          // Check if this is a bucket not found or permission error
          const isBucketError = errorMsg.includes('not found') || errorMsg.includes('Bucket not found') || errorStatus === 404;
          const isPermissionError = errorMsg.includes('permission') || errorMsg.includes('policy') || errorStatus === 403;
          
          if (isBucketError || isPermissionError) {
            // Try server-signed-upload fallback
            console.debug('[UploadServiceScanButton] Client upload failed, attempting server-signed-upload fallback...');
            useServerUpload = true;
            
            try {
              const serverResult = await uploadViaServer(file);
              console.debug('[UploadServiceScanButton] Server upload successful:', serverResult.storagePath);
              
              // Use server result
              attached_files.push({
                name: file.name,
                mimetype: file.type,
                storage_path: serverResult.storagePath,
                url: serverResult.signedViewUrl,
              });
              
              continue; // Skip to next file
            } catch (serverError) {
              console.error('[UploadServiceScanButton] Server upload fallback failed:', serverError);
              
              // If server upload also fails, try local fallback
              console.warn('[UploadServiceScanButton] Attempting local storage fallback...');
              
              // Convert files to base64 for local storage
              const filesWithBase64 = await convertFilesToBase64(files);
              
              // Save to local storage
              try {
                const localImportId = saveLocalImport({
                  src: 'upload',
                  attached_files: filesWithBase64,
                  status: 'local_pending',
                  meta: {
                    importType: 'service',
                    source: 'delivery_page_upload',
                    uploadFailed: true,
                    clientError: uploadError?.message,
                    serverError: serverError.message,
                  },
                });
                
                console.debug(`[imports/upload] source=delivery_page_upload id=${localImportId} files=${filesWithBase64.length} (saved locally)`);
                
                // Show info message and redirect to review
                setUploading(false);
                alert(
                  '⚠️ Upload to cloud storage failed. Your import has been saved locally.\n\n' +
                  'Note: Local imports are stored in your browser and will not sync across devices.\n' +
                  'Please ensure storage bucket is configured in Supabase for full functionality.'
                );
                
                // Navigate to imports review page with local import ID
                window.location.href = `/imports/review?id=${localImportId}`;
                return;
              } catch (localError) {
                console.error('[UploadServiceScanButton] Local storage fallback failed:', localError);
                
                // All three methods failed - show comprehensive error
                throw new Error(
                  `❌ Upload failed - all methods exhausted.\n\n` +
                  `Client upload: ${uploadError?.message || 'Failed'}\n` +
                  `Server upload: ${serverError.message}\n` +
                  `Local storage: ${localError.message}\n\n` +
                  `Please contact administrator to configure storage access.`
                );
              }
            }
          } else if (errorStatus === 400) {
            throw new Error(
              `❌ Bad request during upload.\n\n` +
              `Error: ${errorMsg}\n\n` +
              `This may indicate a configuration issue with the storage bucket or file validation.`
            );
          } else {
            throw new Error(`Failed to upload ${file.name}: ${errorMsg}`);
          }
        }
        
        // If using server upload for subsequent files after first fallback
        if (useServerUpload && !uploadError) {
          try {
            const serverResult = await uploadViaServer(file);
            console.debug('[UploadServiceScanButton] Server upload successful:', serverResult.storagePath);
            
            // Use server result
            attached_files.push({
              name: file.name,
              mimetype: file.type,
              storage_path: serverResult.storagePath,
              url: serverResult.signedViewUrl,
            });
            
            continue; // Skip to next file
          } catch (serverError) {
            console.error('[UploadServiceScanButton] Server upload failed:', serverError);
            
            // Try local fallback
            console.warn('[UploadServiceScanButton] Attempting local storage fallback...');
            
            // Convert files to base64 for local storage
            const filesWithBase64 = await convertFilesToBase64(files);
            
            // Save to local storage
            try {
              const localImportId = saveLocalImport({
                src: 'upload',
                attached_files: filesWithBase64,
                status: 'local_pending',
                meta: {
                  importType: 'service',
                  source: 'delivery_page_upload',
                  uploadFailed: true,
                  serverError: serverError.message,
                },
              });
              
              console.debug(`[imports/upload] source=delivery_page_upload id=${localImportId} files=${filesWithBase64.length} (saved locally)`);
              
              // Show info message and redirect to review
              setUploading(false);
              alert(
                '⚠️ Upload to cloud storage failed. Your import has been saved locally.\n\n' +
                'Note: Local imports are stored in your browser and will not sync across devices.\n' +
                'Please ensure storage bucket is configured in Supabase for full functionality.'
              );
              
              // Navigate to imports review page with local import ID
              window.location.href = `/imports/review?id=${localImportId}`;
              return;
            } catch (localError) {
              console.error('[UploadServiceScanButton] Local storage fallback failed:', localError);
              throw new Error(
                `❌ Upload failed - all methods exhausted.\n\n` +
                `Server upload: ${serverError.message}\n` +
                `Local storage: ${localError.message}\n\n` +
                `Please contact administrator.`
              );
            }
          }
        }
        
        // Client upload succeeded
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
      
      // Store import ID for highlighting (used by embedded ImportsReview component in App.jsx)
      sessionStorage.setItem('highlightImportId', importId);
      
      // Navigate to standalone imports review page
      // Note: Uses window.location.href instead of event-based navigation for GitHub Pages compatibility
      // The standalone page at /src/pages/imports/review.jsx reads the ID from URL params
      window.location.href = `/imports/review?id=${importId}`;
      
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
