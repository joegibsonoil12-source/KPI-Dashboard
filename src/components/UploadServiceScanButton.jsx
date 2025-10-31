/**
 * Upload Service Scan Button Component
 * 
 * Provides a button to upload scanned service tickets directly to delivery tickets
 * Creates ticket_imports and processes them via the upload/process API
 */

import React, { useState, useRef } from 'react';

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
      
      // Convert files to base64
      const filePromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result.split(',')[1]; // Remove data:... prefix
            resolve({
              filename: file.name,
              mimeType: file.type,
              data: base64,
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });
      
      const fileData = await Promise.all(filePromises);
      
      // Call upload API
      const response = await fetch('/api/imports/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: fileData,
          meta: {
            source: 'delivery-tickets',
          },
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      const result = await response.json();
      console.debug('[UploadServiceScanButton] Upload success:', result);
      
      setUploading(false);
      
      // Optionally trigger processing immediately
      if (result.importId) {
        setProcessing(true);
        console.debug('[UploadServiceScanButton] Triggering processing for import:', result.importId);
        
        // Call process endpoint
        const processResponse = await fetch('/api/imports/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            importId: result.importId,
          }),
        });
        
        if (processResponse.ok) {
          console.debug('[UploadServiceScanButton] Processing complete');
          alert(`Successfully uploaded and processed ${result.files.length} file(s). Check Imports Review tab to review and accept.`);
        } else {
          console.warn('[UploadServiceScanButton] Processing failed, but upload succeeded');
          alert(`Successfully uploaded ${result.files.length} file(s). Processing will be attempted automatically.`);
        }
        
        setProcessing(false);
      } else {
        alert(`Successfully uploaded ${result.files?.length || 0} file(s).`);
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
