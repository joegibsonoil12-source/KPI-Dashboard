// VideoUploader.jsx - React component for video uploads with MKV support
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const VideoUploader = ({ 
  onUploadComplete, 
  onError, 
  acceptMkv = true, 
  showProgress = true, 
  className = '',
  bucketName = 'videos' 
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Generate accepted file types
  const getAcceptedTypes = () => {
    const baseTypes = 'video/mp4,video/webm,video/ogg,video/avi,video/mov,video/wmv';
    return acceptMkv ? `${baseTypes},video/x-matroska,.mkv` : baseTypes;
  };

  // Check if file is MKV
  const isMkvFile = (file) => {
    return file.type === 'video/x-matroska' || file.name.toLowerCase().endsWith('.mkv');
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // Validate file size (limit to 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      onError?.('File size must be less than 500MB');
      return;
    }

    setSelectedFile(file);

    // Create preview URL for supported video types
    if (file.type.startsWith('video/') && !isMkvFile(file)) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Upload file to Supabase storage
  const uploadToSupabase = async (file) => {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedName}`;

    try {
      // Upload file
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            if (showProgress) {
              const percentage = (progress.loaded / progress.total) * 100;
              setProgress(Math.round(percentage));
            }
          }
        });

      if (error) throw error;

      // Get public URL
      const { data: publicData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filename);

      return {
        url: publicData.publicUrl,
        filename: filename,
        originalName: file.name,
        size: file.size,
        type: file.type,
        isMkv: isMkvFile(file)
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) {
      onError?.('Please select a file first');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const result = await uploadToSupabase(selectedFile);
      
      // Call success callback
      onUploadComplete?.(result);
      
      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setProgress(0);
      
      // Clear file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      console.error('Upload failed:', error);
      onError?.(error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Cleanup preview URL when component unmounts
  useState(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className={`video-uploader ${className}`}>
      <div className="upload-area" style={{ 
        border: '2px dashed #ddd', 
        borderRadius: '8px', 
        padding: '20px', 
        textAlign: 'center',
        backgroundColor: '#fafafa'
      }}>
        <input
          type="file"
          accept={getAcceptedTypes()}
          onChange={handleFileSelect}
          disabled={uploading}
          style={{
            margin: '10px 0',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            width: '100%',
            maxWidth: '400px'
          }}
        />
        
        {acceptMkv && (
          <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
            Supports MP4, WebM, MOV, AVI, and MKV files (max 500MB)
          </p>
        )}
        
        {selectedFile && (
          <div style={{ 
            marginTop: '15px', 
            padding: '10px', 
            backgroundColor: '#f0f8ff', 
            borderRadius: '6px',
            border: '1px solid #e1e5e9'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Selected file:</strong> {selectedFile.name}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Size: {formatFileSize(selectedFile.size)} | 
              Type: {selectedFile.type || 'Unknown'}
              {isMkvFile(selectedFile) && (
                <span style={{ color: '#ff6b35', fontWeight: 'bold' }}> (MKV)</span>
              )}
            </div>
            
            {isMkvFile(selectedFile) && (
              <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                backgroundColor: '#fff3cd', 
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                <strong>Note:</strong> MKV files may not play in all browsers. 
                Consider converting to MP4 using the provided script for better compatibility.
              </div>
            )}
          </div>
        )}
        
        {previewUrl && (
          <div style={{ marginTop: '15px' }}>
            <video 
              src={previewUrl} 
              controls 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '200px',
                borderRadius: '6px'
              }}
            />
          </div>
        )}
        
        {showProgress && uploading && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ marginBottom: '5px', fontSize: '14px' }}>
              Uploading... {progress}%
            </div>
            <div style={{ 
              width: '100%', 
              backgroundColor: '#e0e0e0', 
              borderRadius: '10px',
              height: '8px'
            }}>
              <div style={{ 
                width: `${progress}%`, 
                backgroundColor: '#4caf50', 
                height: '100%',
                borderRadius: '10px',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        )}
        
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          style={{
            marginTop: '15px',
            padding: '10px 20px',
            backgroundColor: selectedFile && !uploading ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: selectedFile && !uploading ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {uploading ? 'Uploading...' : 'Upload Video'}
        </button>
      </div>
    </div>
  );
};

export default VideoUploader;