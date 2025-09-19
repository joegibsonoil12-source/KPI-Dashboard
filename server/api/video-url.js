// Express router for video URL generation
// Adapted from Next.js API route to be Express-compatible
// Use with: app.use('/api', require('./server/api/video-url'));

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Create admin client with service role key
function createAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 
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

// POST /api/video-url - Generate signed URL for video access
router.post('/video-url', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filePath, bucket = 'videos', expiresIn = 3600 } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'filePath is required' });
  }

  try {
    // Basic auth check - in production, you'd want more robust authentication
    // For now, this allows public access for demo but includes auth structure
    let isAuthenticated = false;
    let userId = null;

    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // TODO: Verify JWT token for production use
      // Example: const user = await verifyJWT(authHeader.replace('Bearer ', ''));
      // if (user) { isAuthenticated = true; userId = user.id; }
      isAuthenticated = true;
    }

    // Check for session cookie (basic example)
    const sessionCookie = req.cookies?.supabase_session;
    if (sessionCookie) {
      // TODO: Verify session for production use
      // Example: const user = await verifySession(sessionCookie);
      // if (user) { isAuthenticated = true; userId = user.id; }
      isAuthenticated = true;
    }

    // For demo purposes, allow public access but log the auth state
    console.log('Auth check:', { isAuthenticated, hasAuthHeader: !!authHeader, hasSessionCookie: !!sessionCookie });

    // IMPORTANT: In production, you should enforce authentication and ownership:
    // if (!isAuthenticated) {
    //   return res.status(401).json({ error: 'Authentication required' });
    // }
    // 
    // // Verify user owns this video file
    // const ownershipCheck = await verifyVideoOwnership(userId, filePath);
    // if (!ownershipCheck) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    // Create admin client and generate signed URL
    const supabase = createAdminClient();
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

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
      filePath,
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

module.exports = router;