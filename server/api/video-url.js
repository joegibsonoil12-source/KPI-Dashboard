// Express router for video URL generation
// Adapted from Next.js API route to be Express-compatible
// Use with: app.use('/api', require('./server/api/video-url'));
// TODO: This server must not expose service role key in production and must be mounted under an authenticated backend

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Create admin client with service role key
// TODO: Server must not expose service role key - use secure environment variables and proper key management
function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || 
                      process.env.VITE_SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL ||
                      process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration. Ensure SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL are set.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// POST /api/video-url - Generate signed URL for video access with ownership validation
router.post('/video-url', async (req, res) => {
  try {
    // Accept either JSON body or query parameters
    const { video_id, filename } = req.method === 'GET' ? req.query : req.body;
    const bucket = 'videos';
    const expiresIn = 60; // 60 seconds

    // Validate required parameters
    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }

    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header with Bearer token required' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create admin client for token validation and database queries
    const supabase = createAdminClient();
    
    // Validate token using service role key client
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Token validation error:', userError);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // If video_id is provided, check ownership of the video record
    if (video_id) {
      const { data: videoRecord, error: videoError } = await supabase
        .from('procedure_videos')
        .select('owner')
        .eq('id', video_id)
        .single();

      if (videoError) {
        console.error('Database error checking video ownership:', videoError);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!videoRecord) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Check if the authenticated user owns this video
      if (videoRecord.owner !== user.id) {
        return res.status(403).json({ error: 'Access denied - you do not own this video' });
      }
    }

    // Generate signed URL using service role key
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filename, expiresIn);

    if (error) {
      console.error('Supabase storage error:', error);
      return res.status(500).json({ error: `Storage error: ${error.message}` });
    }

    if (!data?.signedUrl) {
      return res.status(500).json({ error: 'Failed to generate signed URL' });
    }

    return res.status(200).json({
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + (expiresIn * 1000)).toISOString(),
      filename,
      bucket
    });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// TODO: Add middleware to ensure this router is only accessible from authenticated backend services
// TODO: Implement proper rate limiting and request validation
// TODO: Add logging for security auditing

module.exports = router;