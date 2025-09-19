# Video API Server Routes

This directory contains Express router modules for video-related server functionality.

## video-url.js

Express router that provides signed URL generation for private video access.

### Usage in Express app:

```javascript
const express = require('express');
const videoApiRouter = require('./server/api/video-url');

const app = express();

// Mount the video API routes
app.use('/api', videoApiRouter);

// Now /api/video-url endpoint will be available
```

### Environment Variables:

- `SUPABASE_SERVICE_ROLE_KEY` (required) - Service role key for admin access
- `VITE_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` or `REACT_APP_SUPABASE_URL` - Supabase project URL

### Security Notes:

- **IMPORTANT**: The SUPABASE_SERVICE_ROLE_KEY should NEVER be exposed to the client
- Current implementation allows demo access but includes TODOs for production auth
- In production, implement proper JWT verification and ownership checks
- Consider rate limiting and request validation

### Endpoints:

#### POST /api/video-url

Generates a signed URL for video file access.

**Request body:**
```json
{
  "filePath": "uploads/user123/video.mp4",
  "bucket": "videos",
  "expiresIn": 3600
}
```

**Response:**
```json
{
  "signedUrl": "https://...",
  "expiresAt": "2024-01-01T12:00:00.000Z",
  "filePath": "uploads/user123/video.mp4",
  "bucket": "videos"
}
```