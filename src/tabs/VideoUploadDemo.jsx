// VideoUploadDemo.jsx - Demo component to showcase VideoUploader functionality
import React, { useState } from 'react';
import VideoUploader from '../components/VideoUploader';

const VideoUploadDemo = () => {
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [lastError, setLastError] = useState(null);

  const handleUploadComplete = (result) => {
    console.log('Upload completed:', result);
    setUploadedVideos(prev => [...prev, result]);
    setLastError(null);
  };

  const handleUploadError = (error) => {
    console.error('Upload error:', error);
    setLastError(error);
  };

  const removeVideo = (index) => {
    setUploadedVideos(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>Video Upload Demo</h2>
      
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '15px', color: '#555' }}>Upload a Video</h3>
        <VideoUploader
          onUploadComplete={handleUploadComplete}
          onError={handleUploadError}
          acceptMkv={true}
          showProgress={true}
          bucketName="videos"
        />
      </div>

      {lastError && (
        <div style={{
          padding: '12px',
          backgroundColor: '#ffe6e6',
          border: '1px solid #ff9999',
          borderRadius: '6px',
          color: '#cc0000',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {lastError}
        </div>
      )}

      {uploadedVideos.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '15px', color: '#555' }}>
            Uploaded Videos ({uploadedVideos.length})
          </h3>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            {uploadedVideos.map((video, index) => (
              <div key={index} style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: '#fff'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '10px'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                      {video.originalName}
                      {video.isMkv && (
                        <span style={{ 
                          marginLeft: '8px',
                          padding: '2px 6px',
                          backgroundColor: '#ff6b35',
                          color: 'white',
                          fontSize: '10px',
                          borderRadius: '3px'
                        }}>
                          MKV
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Size: {(video.size / 1024 / 1024).toFixed(2)} MB | 
                      Type: {video.type}
                    </div>
                  </div>
                  <button
                    onClick={() => removeVideo(index)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Remove
                  </button>
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                    Supabase URL:
                  </div>
                  <input
                    type="text"
                    value={video.url}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: '#f9f9f9'
                    }}
                    onClick={(e) => e.target.select()}
                  />
                </div>

                {/* Show video preview for supported formats */}
                {!video.isMkv && video.type.startsWith('video/') && (
                  <video
                    src={video.url}
                    controls
                    style={{
                      width: '100%',
                      maxHeight: '300px',
                      borderRadius: '6px'
                    }}
                  />
                )}
                
                {video.isMkv && (
                  <div style={{
                    padding: '10px',
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    <strong>MKV Note:</strong> This file may not play in all browsers. 
                    Use the convert script to convert to MP4: 
                    <code style={{ 
                      backgroundColor: '#f8f9fa', 
                      padding: '2px 4px', 
                      marginLeft: '5px' 
                    }}>
                      ./scripts/convert_mkv_to_mp4.sh
                    </code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadedVideos.length === 0 && !lastError && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#666',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          No videos uploaded yet. Upload a video above to see it here!
        </div>
      )}
    </div>
  );
};

export default VideoUploadDemo;