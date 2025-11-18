/**
 * Ticket Import Upload Page
 * 
 * Drag/drop interface for uploading scanned tickets
 * Supports PDF and image files
 */

import React, { useState, useRef } from 'react';

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  /**
   * Handle file selection
   */
  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
    setError(null);
  };

  /**
   * Handle drag over
   */
  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  /**
   * Handle drop
   */
  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const droppedFiles = Array.from(event.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
    setError(null);
  };

  /**
   * Remove file from list
   */
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Convert file to base64
   */
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Upload files
   */
  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      // Convert files to base64
      const filesData = await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          data: await fileToBase64(file),
          mimeType: file.type,
        }))
      );

      // Get API base from environment
      const apiBase = 
        (typeof window !== 'undefined' && window.__ENV?.NEXT_PUBLIC_API_BASE) ||
        (typeof window !== 'undefined' && window.__ENV?.VITE_API_BASE) ||
        import.meta.env.NEXT_PUBLIC_API_BASE ||
        import.meta.env.VITE_API_BASE ||
        '';
      
      const uploadEndpoint = apiBase 
        ? `${apiBase}/api/imports/upload`
        : `/.netlify/functions/imports-upload`;
      
      console.debug('[upload] Upload endpoint:', uploadEndpoint);

      // Upload to API
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: filesData,
          meta: {},
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Upload failed');
      }

      setUploadResult(result);
      setFiles([]);

      // Auto-process the import
      if (result.importId) {
        try {
          const processEndpoint = apiBase 
            ? `${apiBase}/api/imports/process/${result.importId}`
            : `/.netlify/functions/imports-process`;
          
          const processPayload = apiBase 
            ? {} // API endpoint expects empty body
            : { importId: result.importId }; // Netlify function expects importId in body
          
          console.debug('[upload] Process endpoint:', processEndpoint);
          
          const processResponse = await fetch(processEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(processPayload),
          });

          const processResult = await processResponse.json();
          
          if (processResult.success) {
            setUploadResult(prev => ({
              ...prev,
              processed: true,
              parsed: processResult.parsed,
              confidence: processResult.confidence,
              isScanned: processResult.isScanned,
              ocrEngine: processResult.ocrEngine,
            }));
          } else {
            // Processing failed - show error but keep upload result
            setError(processResult.message || 'Failed to process the uploaded file');
            setUploadResult(prev => ({
              ...prev,
              processed: false,
              processingError: processResult.message || 'Processing failed',
            }));
          }
        } catch (processError) {
          console.error('[upload] Error processing import:', processError);
          setError(`Processing error: ${processError.message}`);
          setUploadResult(prev => ({
            ...prev,
            processed: false,
            processingError: processError.message,
          }));
        }
      }
    } catch (err) {
      console.error('[upload] Upload error:', err);
      setError(err.message || 'Upload failed');
      setUploadResult(null); // Clear any partial results
    } finally {
      setUploading(false);
    }
  };

  /**
   * Navigate to review page
   */
  const goToReview = () => {
    const basePath = (window.__ENV && window.__ENV.BASE_PATH) || '/KPI-Dashboard';
    if (uploadResult && uploadResult.importId) {
      window.location.href = `${basePath}/imports/review?id=${uploadResult.importId}`;
    } else {
      window.location.href = `${basePath}/imports/review`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Upload Scanned Tickets</h1>

      {/* Help Text */}
      <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded">
        <p className="text-sm mb-2">
          <strong>OCR-Powered Import:</strong> This uploader accepts scanned PDFs and images and will automatically perform OCR to extract delivery ticket data.
        </p>
        <p className="text-sm mb-2">
          <strong>Supported Formats:</strong> PDF (scanned or digital), JPG, PNG, GIF
        </p>
        <p className="text-sm">
          <strong>For Best Results:</strong> Use high-contrast scans with readable text. Ensure the document is properly aligned and not blurry.
        </p>
      </div>

      <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded">
        <p className="text-sm">
          <strong>Auto-Detection:</strong> Upload your scanned tickets (service or delivery). 
          The system will automatically detect the type based on content.
        </p>
      </div>

      {/* Drag/Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="text-gray-600">
          <svg
            className="mx-auto h-12 w-12 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-lg font-medium">Drop files here or click to browse</p>
          <p className="text-sm mt-2">Supports PDF, JPG, PNG, GIF</p>
        </div>
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3">Selected Files ({files.length})</h2>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-100 p-3 rounded"
              >
                <div className="flex items-center gap-3">
                  <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <div className="mt-6">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload and Process'}
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded">
          <p className="font-medium mb-2">Upload or Processing Error</p>
          <p className="text-sm whitespace-pre-wrap">{error}</p>
          {uploadResult?.processingError && (
            <div className="mt-3">
              <p className="text-sm font-medium">Possible causes:</p>
              <ul className="list-disc list-inside text-sm mt-1">
                <li>The PDF may be a low-quality scan</li>
                <li>The image contrast may be too low</li>
                <li>The document may not contain recognizable delivery ticket data</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Success Message */}
      {uploadResult && !error && (
        <div className="mt-6 bg-green-50 border border-green-200 text-green-800 p-4 rounded">
          <p className="font-medium mb-2">Upload Successful!</p>
          <div className="space-y-1 text-sm">
            <p>Import ID: <span className="font-mono">{uploadResult.importId}</span></p>
            {uploadResult.processed && (
              <>
                <p>OCR Engine: <span className="font-medium">{uploadResult.ocrEngine === 'google_vision' ? 'Google Vision' : 'Tesseract'}</span></p>
                {uploadResult.isScanned !== undefined && (
                  <p>Document Type: <span className="font-medium">{uploadResult.isScanned ? 'Scanned Image' : 'Digital Text'}</span></p>
                )}
                <p>Confidence: <span className="font-medium">{(uploadResult.confidence * 100).toFixed(1)}%</span></p>
                <p>Rows Detected: <span className="font-medium">{uploadResult.parsed?.rows?.length || 0}</span></p>
                {uploadResult.parsed?.summary?.validationErrors?.length > 0 && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="font-medium text-yellow-800">Validation Warnings:</p>
                    <ul className="list-disc list-inside text-xs text-yellow-700 mt-1">
                      {uploadResult.parsed.summary.validationErrors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                      {uploadResult.parsed.summary.validationErrors.length > 5 && (
                        <li>... and {uploadResult.parsed.summary.validationErrors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
          <button
            onClick={goToReview}
            className="mt-4 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          >
            Review Import
          </button>
        </div>
      )}
    </div>
  );
}
