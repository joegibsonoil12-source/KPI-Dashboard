// Browser helper that uploads a File to the 'videos' bucket, 
// writes metadata to the videos table, and handles cleanup on failure.

import { supabase } from './supabaseClient.js';

/**
 * Upload a video file to Supabase Storage and save metadata
 * @param {File} file - The video file to upload
 * @param {Object} options - Upload options
 * @param {string} options.title - Optional title for the video
 * @param {string} options.description - Optional description
 * @param {string} options.bucket - Storage bucket name (default: 'videos')
 * @returns {Promise<{data: Object, error: string|null}>}
 */
export async function uploadVideo(file, options = {}) {
  const {
    title = file.name,
    description = '',
    bucket = 'videos'
  } = options;

  if (!file) {
    return { data: null, error: 'No file provided' };
  }

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { data: null, error: 'User must be authenticated to upload videos' };
  }

  // Generate unique filename
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${timestamp}_${sanitizedName}`;
  const filePath = `uploads/${user.id}/${fileName}`;

  try {
    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      return { data: null, error: `Upload failed: ${uploadError.message}` };
    }

    // Get video metadata
    const videoMetadata = {
      title: title || file.name,
      description,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      owner_id: user.id
    };

    // Try to get video duration and dimensions if possible
    if (file.type.startsWith('video/')) {
      try {
        const duration = await getVideoDuration(file);
        if (duration) {
          videoMetadata.duration_seconds = Math.round(duration);
        }
      } catch (err) {
        console.warn('Could not get video duration:', err);
      }
    }

    // Save metadata to database
    const { data: dbData, error: dbError } = await supabase
      .from('videos')
      .insert(videoMetadata)
      .select()
      .single();

    if (dbError) {
      // Cleanup: delete uploaded file if database insert fails
      try {
        await supabase.storage.from(bucket).remove([filePath]);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError);
      }
      return { data: null, error: `Database error: ${dbError.message}` };
    }

    return { 
      data: {
        ...dbData,
        storage_path: filePath,
        bucket
      }, 
      error: null 
    };

  } catch (error) {
    return { data: null, error: `Unexpected error: ${error.message}` };
  }
}

/**
 * Helper function to get video duration
 * @param {File} file 
 * @returns {Promise<number|null>}
 */
function getVideoDuration(file) {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        resolve(null);
      };
      
      video.src = URL.createObjectURL(file);
    } catch (error) {
      resolve(null);
    }
  });
}