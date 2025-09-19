// Demo component showing how to use the new video functionality
// This can be imported and used in any React component

import React, { useState } from 'react';
import { uploadVideo } from '../src/lib/uploadVideo.js';
import VideoPlayer from '../components/VideoPlayer.jsx';

export default function VideoUploadDemo() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [message, setMessage] = useState('');

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files[0]);
    setMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Please select a video file');
      return;
    }

    setUploading(true);
    setMessage('Uploading...');

    try {
      const result = await uploadVideo(selectedFile, {
        title: selectedFile.name.replace(/\.[^/.]+$/, ''),
        description: 'Test upload from demo component'
      });

      if (result.error) {
        setMessage(`Error: ${result.error}`);
      } else {
        setMessage('Upload successful!');
        setUploadedVideo(result.data);
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '2rem auto', 
      padding: '1.5rem',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      background: 'white'
    }}>
      <h3 style={{ marginBottom: '1rem' }}>Video Upload Demo</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          style={{ marginBottom: '0.5rem' }}
        />
        
        {selectedFile && (
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
          </div>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={!selectedFile || uploading}
        style={{
          padding: '0.5rem 1rem',
          background: !selectedFile || uploading ? '#9ca3af' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer',
          marginBottom: '1rem'
        }}
      >
        {uploading ? 'Uploading...' : 'Upload Video'}
      </button>

      {message && (
        <div style={{ 
          padding: '0.75rem',
          marginBottom: '1rem',
          background: message.includes('Error') ? '#fef2f2' : '#f0f9ff',
          border: `1px solid ${message.includes('Error') ? '#fecaca' : '#bae6fd'}`,
          borderRadius: '4px',
          color: message.includes('Error') ? '#dc2626' : '#0369a1',
          fontSize: '0.875rem'
        }}>
          {message}
        </div>
      )}

      {uploadedVideo && (
        <div>
          <h4 style={{ marginBottom: '0.5rem' }}>Uploaded Video:</h4>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
            {uploadedVideo.title} - {uploadedVideo.file_name}
          </div>
          <VideoPlayer
            filePath={uploadedVideo.file_path}
            style={{ width: '100%', maxHeight: '300px' }}
            onError={(error) => setMessage(`Player error: ${error}`)}
          />
        </div>
      )}
    </div>
  );
}