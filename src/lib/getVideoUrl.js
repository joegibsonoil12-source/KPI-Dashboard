// Browser helper to call the server API to get a signed URL for private playback

/**
 * Get a signed URL for video playback by calling the server API
 * @param {string} filePath - The file path in storage
 * @param {Object} options - Request options
 * @param {string} options.bucket - Storage bucket name (default: 'videos')
 * @param {number} options.expiresIn - URL expiration in seconds (default: 3600)
 * @param {string} options.apiEndpoint - API endpoint (default: '/api/video-url')
 * @returns {Promise<{url: string|null, error: string|null}>}
 */
export async function getVideoUrl(filePath, options = {}) {
  const {
    bucket = 'videos',
    expiresIn = 3600,
    apiEndpoint = '/api/video-url'
  } = options;

  if (!filePath) {
    return { url: null, error: 'File path is required' };
  }

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for session
      body: JSON.stringify({
        filePath,
        bucket,
        expiresIn
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        url: null, 
        error: `API error ${response.status}: ${errorText}` 
      };
    }

    const data = await response.json();
    
    if (data.error) {
      return { url: null, error: data.error };
    }

    if (!data.signedUrl) {
      return { url: null, error: 'No signed URL returned from API' };
    }

    return { url: data.signedUrl, error: null };

  } catch (error) {
    return { 
      url: null, 
      error: `Network error: ${error.message}` 
    };
  }
}

/**
 * Get multiple signed URLs at once
 * @param {Array<string>} filePaths - Array of file paths
 * @param {Object} options - Request options (same as getVideoUrl)
 * @returns {Promise<{urls: Array<{path: string, url: string|null, error: string|null}>, error: string|null}>}
 */
export async function getMultipleVideoUrls(filePaths, options = {}) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return { urls: [], error: 'File paths array is required' };
  }

  try {
    const results = await Promise.all(
      filePaths.map(async (path) => {
        const result = await getVideoUrl(path, options);
        return {
          path,
          url: result.url,
          error: result.error
        };
      })
    );

    return { urls: results, error: null };
  } catch (error) {
    return { 
      urls: [], 
      error: `Batch request failed: ${error.message}` 
    };
  }
}