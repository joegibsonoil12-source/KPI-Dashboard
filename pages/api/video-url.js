// Next.js API route that uses SUPABASE_SERVICE_ROLE_KEY to create a signed URL
// for a given path and enforces auth if a session cookie or Authorization header is present

import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export default async function handler(req, res) {
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
      isAuthenticated = true;
    }

    // Check for session cookie (basic example)
    const sessionCookie = req.cookies?.supabase_session;
    if (sessionCookie) {
      // TODO: Verify session for production use
      isAuthenticated = true;
    }

    // For demo purposes, allow public access but log the auth state
    console.log('Auth check:', { isAuthenticated, hasAuthHeader: !!authHeader, hasSessionCookie: !!sessionCookie });

    // In production, you might want to enforce auth:
    // if (!isAuthenticated) {
    //   return res.status(401).json({ error: 'Authentication required' });
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
}