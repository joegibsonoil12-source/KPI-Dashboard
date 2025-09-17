import React, { useState } from 'react';
import VideoUploader from './VideoUploader';

/*
Demo component showing how to integrate VideoUploader into existing forms.
This can be used as a reference for integrating video upload functionality
into the procedures management interface.
*/
export default function VideoUploaderDemo() {
  const [selectedProcedure, setSelectedProcedure] = useState('');
  const [uploads, setUploads] = useState([]);

  // These would typically come from your app configuration
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
  const transcoderWebhook = 'http://localhost:3001/transcode'; // Optional

  const handleUploadSuccess = (result) => {
    console.log('Upload successful:', result);
    setUploads(prev => [...prev, {
      ...result,
      timestamp: new Date().toLocaleString()
    }]);
  };

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h2>Video Upload Demo</h2>
      
      <div style={{ marginBottom: 20 }}>
        <label>
          Procedure ID:
          <input
            type="text"
            value={selectedProcedure}
            onChange={(e) => setSelectedProcedure(e.target.value)}
            placeholder="Enter procedure ID"
            style={{ marginLeft: 8, padding: 4 }}
          />
        </label>
      </div>

      {selectedProcedure && (
        <VideoUploader
          procedureId={selectedProcedure}
          supabaseUrl={supabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
          transcoderWebhook={transcoderWebhook}
          onSuccess={handleUploadSuccess}
        />
      )}

      {uploads.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Upload History</h3>
          <ul>
            {uploads.map((upload, index) => (
              <li key={index} style={{ marginBottom: 8 }}>
                <strong>Procedure {upload.procedureId}</strong>: {upload.objectPath}
                <br />
                <small>{upload.timestamp}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ 
        marginTop: 30, 
        padding: 15, 
        backgroundColor: '#f5f5f5', 
        borderRadius: 8,
        fontSize: 14 
      }}>
        <h4>Integration Notes:</h4>
        <ul>
          <li>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file</li>
          <li>Ensure the transcoder service is running if you want automatic transcoding</li>
          <li>The VideoUploader component can be easily integrated into existing procedure forms</li>
          <li>Check the browser console for detailed upload progress and error messages</li>
        </ul>
      </div>
    </div>
  );
}