// Vite/React demo page for video upload and playback

import { useState } from 'react';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { uploadVideo } from '../src/lib/uploadVideo.js';

export default function VideoDemo() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    if (file) {
      setVideoTitle(file.name.replace(/\.[^/.]+$/, '')); // Remove extension
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('Please select a video file');
      return;
    }

    setUploading(true);
    setUploadStatus('Uploading video...');

    try {
      const result = await uploadVideo(selectedFile, {
        title: videoTitle || selectedFile.name,
        description: videoDescription
      });

      if (result.error) {
        setUploadStatus(`Upload failed: ${result.error}`);
      } else {
        setUploadStatus('Upload successful!');
        setUploadedVideo(result.data);
        setSelectedFile(null);
        setVideoTitle('');
        setVideoDescription('');
        // Reset file input
        const fileInput = document.getElementById('video-file-input');
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      setUploadStatus(`Upload error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem', fontWeight: 'bold' }}>
        Video Upload Demo
      </h1>

      {/* Upload Section */}
      <div style={{ 
        background: 'white', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px', 
        padding: '1.5rem', 
        marginBottom: '2rem' 
      }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>
          Upload Video
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="video-file-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Select Video File:
          </label>
          <input
            id="video-file-input"
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px'
            }}
          />
        </div>

        {selectedFile && (
          <div style={{ 
            background: '#f9fafb', 
            border: '1px solid #e5e7eb', 
            borderRadius: '4px', 
            padding: '1rem', 
            marginBottom: '1rem' 
          }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}>
              Selected File:
            </h3>
            <p><strong>Name:</strong> {selectedFile.name}</p>
            <p><strong>Size:</strong> {formatFileSize(selectedFile.size)}</p>
            <p><strong>Type:</strong> {selectedFile.type}</p>
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="video-title" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Title:
          </label>
          <input
            id="video-title"
            type="text"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            placeholder="Enter video title"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px'
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="video-description" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Description:
          </label>
          <textarea
            id="video-description"
            value={videoDescription}
            onChange={(e) => setVideoDescription(e.target.value)}
            placeholder="Enter video description (optional)"
            rows={3}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              resize: 'vertical'
            }}
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          style={{
            padding: '0.75rem 1.5rem',
            background: !selectedFile || uploading ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '500'
          }}
        >
          {uploading ? 'Uploading...' : 'Upload Video'}
        </button>

        {uploadStatus && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            background: uploadStatus.includes('failed') || uploadStatus.includes('error') ? '#fef2f2' : '#f0f9ff',
            border: `1px solid ${uploadStatus.includes('failed') || uploadStatus.includes('error') ? '#fecaca' : '#bae6fd'}`,
            borderRadius: '4px',
            color: uploadStatus.includes('failed') || uploadStatus.includes('error') ? '#dc2626' : '#0369a1'
          }}>
            {uploadStatus}
          </div>
        )}
      </div>

      {/* Video Player Section */}
      {uploadedVideo && (
        <div style={{ 
          background: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '1.5rem' 
        }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>
            Uploaded Video
          </h2>

          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              {uploadedVideo.title}
            </h3>
            {uploadedVideo.description && (
              <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>
                {uploadedVideo.description}
              </p>
            )}
            <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
              <span>File: {uploadedVideo.file_name}</span>
              {uploadedVideo.file_size && (
                <span style={{ marginLeft: '1rem' }}>
                  Size: {formatFileSize(uploadedVideo.file_size)}
                </span>
              )}
              {uploadedVideo.duration_seconds && (
                <span style={{ marginLeft: '1rem' }}>
                  Duration: {Math.round(uploadedVideo.duration_seconds)}s
                </span>
              )}
            </div>
          </div>

          <VideoPlayer
            filePath={uploadedVideo.file_path}
            bucket={uploadedVideo.bucket}
            style={{ maxWidth: '100%', height: 'auto' }}
            onLoad={(url) => console.log('Video loaded:', url)}
            onError={(error) => console.error('Video error:', error)}
          />
        </div>
      )}
    </div>
  );
}