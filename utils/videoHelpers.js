// utils/videoHelpers.js
// Utility functions for video operations in the KPI Dashboard

/**
 * Check if a file is a supported video format
 * @param {File} file - The file to check
 * @returns {boolean} - True if supported video format
 */
export function isVideoFile(file) {
  if (!file) return false;
  const supportedTypes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/webm',
    'video/mkv'
  ];
  return supportedTypes.includes(file.type.toLowerCase());
}

/**
 * Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate a safe filename for storage
 * @param {string} originalName - Original filename
 * @returns {string} - Safe filename with timestamp
 */
export function generateSafeFilename(originalName) {
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${timestamp}-${safeName}`;
}

/**
 * Extract video metadata using HTML5 video element
 * @param {File} file - Video file
 * @returns {Promise<Object>} - Promise resolving to metadata object
 */
export function getVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        size: file.size,
        type: file.type,
        name: file.name
      });
    };
    
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video metadata'));
    };
    
    video.src = window.URL.createObjectURL(file);
  });
}

/**
 * Format duration in seconds to HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration string
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Create a video thumbnail from a file
 * @param {File} file - Video file
 * @param {number} timeOffset - Time offset in seconds for thumbnail
 * @returns {Promise<string>} - Promise resolving to base64 thumbnail
 */
export function createVideoThumbnail(file, timeOffset = 1) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = Math.min(timeOffset, video.duration / 2);
    };
    
    video.onseeked = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
      window.URL.revokeObjectURL(video.src);
      resolve(thumbnail);
    };
    
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error('Failed to create video thumbnail'));
    };
    
    video.src = window.URL.createObjectURL(file);
    video.muted = true;
    video.load();
  });
}

/**
 * Validate video file before upload
 * @param {File} file - Video file to validate
 * @param {Object} options - Validation options
 * @returns {Object} - Validation result with isValid and errors
 */
export function validateVideoFile(file, options = {}) {
  const {
    maxSize = 100 * 1024 * 1024, // 100MB default
    minDuration = 1, // 1 second minimum
    maxDuration = 3600, // 1 hour maximum
    allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mkv']
  } = options;

  const errors = [];

  if (!file) {
    errors.push('No file selected');
    return { isValid: false, errors };
  }

  if (!isVideoFile(file)) {
    errors.push('File must be a video');
  }

  if (!allowedTypes.includes(file.type.toLowerCase())) {
    errors.push(`Video type ${file.type} is not supported. Allowed types: ${allowedTypes.join(', ')}`);
  }

  if (file.size > maxSize) {
    errors.push(`File size ${formatFileSize(file.size)} exceeds maximum allowed size of ${formatFileSize(maxSize)}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Upload progress tracker
 */
export class VideoUploadTracker {
  constructor() {
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notifyProgress(progress) {
    this.listeners.forEach(callback => callback(progress));
  }

  async uploadWithProgress(file, uploadFunction) {
    const startTime = Date.now();
    
    this.notifyProgress({
      status: 'starting',
      progress: 0,
      file: file.name,
      size: file.size
    });

    try {
      const result = await uploadFunction(file, (progressEvent) => {
        const progress = progressEvent.loaded / progressEvent.total * 100;
        const elapsed = Date.now() - startTime;
        const estimated = elapsed / (progress / 100);
        const remaining = estimated - elapsed;

        this.notifyProgress({
          status: 'uploading',
          progress,
          elapsed,
          remaining,
          file: file.name,
          size: file.size
        });
      });

      this.notifyProgress({
        status: 'completed',
        progress: 100,
        file: file.name,
        result
      });

      return result;
    } catch (error) {
      this.notifyProgress({
        status: 'error',
        error: error.message,
        file: file.name
      });
      throw error;
    }
  }
}