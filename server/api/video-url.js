// server/api/video-url.js
// Express router: POST /video-url
// Body: { video_id, filename } or query params
// Header: Authorization: Bearer <access_token>
// Requires env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (server-only, DO NOT COMMIT)

const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in env — /video-url will fail without them.')
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

router.post('/video-url', async (req, res) => {
  try {
    const tokenHeader = req.headers.authorization || ''
    const match = tokenHeader.match(/^Bearer (.*)$/)
    const token = match ? match[1] : null

    if (!token) return res.status(401).json({ error: 'Missing Authorization Bearer token' })

    // Validate token using the admin client
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData || !userData.user) {
      console.warn('Invalid token in /video-url', userErr)
      return res.status(401).json({ error: 'Invalid token' })
    }
    const userId = userData.user.id

    const video_id = req.body?.video_id || req.query?.video_id
    const filename = req.body?.filename || req.query?.filename

    if (!filename) return res.status(400).json({ error: 'filename is required' })

    // If video_id provided, verify ownership: either procedure_videos.owner = userId OR parent procedure.created_by = userId
    if (video_id) {
      const { data: rows, error: selErr } = await supabaseAdmin
        .from('procedure_videos')
        .select('id, owner, procedure_id')
        .eq('id', video_id)
        .limit(1)

      if (selErr) {
        console.error('DB error when fetching procedure_videos', selErr)
        return res.status(500).json({ error: 'DB error' })
      }
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Video not found' })

      const row = rows[0]
      if (row.owner && row.owner === userId) {
        // authorized
      } else {
        const { data: pRows, error: pErr } = await supabaseAdmin
          .from('procedures')
          .select('id, created_by')
          .eq('id', row.procedure_id)
          .limit(1)

        if (pErr) {
          console.error('DB error fetching parent procedure', pErr)
          return res.status(500).json({ error: 'DB error' })
        }
        if (!pRows || pRows.length === 0) return res.status(403).json({ error: 'Not authorized' })
        const p = pRows[0]
        if (p.created_by !== userId) {
          return res.status(403).json({ error: 'Not authorized' })
        }
      }
    }

    // Create signed URL (short TTL)
    const { data: signedData, error: signedErr } = await supabaseAdmin.storage
      .from('videos')
      .createSignedUrl(filename, 60)

    if (signedErr) {
      console.error('Error creating signed url', signedErr)
      return res.status(500).json({ error: 'Failed to create signed url' })
    }

    return res.json({ signedUrl: signedData?.signedUrl })
  } catch (err) {
    console.error('/video-url unexpected error', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
