/**
 * Service Upload Button Component
 * 
 * Provides a button to upload scanned service tickets directly
 * Creates ticket_imports and lets worker detect importType after upload
 */

import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ServiceUploadButton() {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    
    try {
      console.debug('[ServiceUploadButton] Uploading files:', files.length);
      
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
          meta: {},
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      const result = await response.json();
      console.debug('[ServiceUploadButton] Upload success:', result);
      
      // Optionally trigger processing immediately
      if (result.importId) {
        console.debug('[ServiceUploadButton] Triggering processing for import:', result.importId);
        
        // Call process endpoint
        fetch('/api/imports/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            importId: result.importId,
          }),
        }).catch(err => {
          console.error('[ServiceUploadButton] Processing error:', err);
        });
      }
      
      alert(`Successfully uploaded ${result.files.length} file(s). Processing started.`);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('[ServiceUploadButton] Error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <>
      <button
        className="rounded-lg border px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        title="Upload scanned service tickets (PDF/Image)"
      >
        {uploading ? '⏳ Uploading...' : '📄 Upload Service Scan'}
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
