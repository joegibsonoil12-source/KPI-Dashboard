# Video Storage Implementation Guide

This document explains the video storage schema and helper files added to the KPI Dashboard.

## Files Overview

### 1. `sql/procedure_video_storage_setup.sql`
**Purpose**: Database schema for video storage settings and URL generation

**What it does**:
- Creates a `storage_settings` table to store Supabase project URL and default bucket configuration
- Provides a `get_public_video_url()` function to generate public URLs for video files
- Creates a `procedures_with_video_urls` view that automatically includes computed video URLs
- Includes a convenience function `set_storage_settings()` to update configuration

**How to run**:
```sql
-- Execute the entire SQL file in your Supabase SQL editor or via psql
\i sql/procedure_video_storage_setup.sql

-- Then configure your project settings
SELECT public.set_storage_settings('https://your-project.supabase.co', 'videos', 3600);
```

### 2. `scripts/create_supabase_buckets.sh`
**Purpose**: Shell script to create Supabase storage buckets

**What it does**:
- Creates a public 'videos' bucket in your Supabase project
- Uses the Storage API with service role authentication
- Provides feedback on bucket creation status

**How to run**:
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
./scripts/create_supabase_buckets.sh
```

### 3. `services/transcoder.js`
**Purpose**: Node.js service for video transcoding using FFmpeg

**What it does**:
- Downloads videos from Supabase Storage
- Transcodes them to web-optimized MP4 format (H.264/AAC)
- Uploads transcoded videos back to storage
- Updates procedure records with playable video paths
- Cleans up temporary files

**How to run**:
```bash
cd services
npm install
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
npm start
```

**API Usage**:
```bash
curl -X POST http://localhost:3001/transcode \
  -H "Content-Type: application/json" \
  -d '{"bucket":"videos","object_path":"uploads/video.mov","procedure_id":"123"}'
```

### 4. `frontend/src/components/VideoUploader.jsx`
**Purpose**: React component for video uploads

**What it does**:
- Provides a user-friendly interface for video file selection
- Uploads videos directly to Supabase Storage
- Updates procedure records with video paths
- Optionally triggers transcoding via webhook
- Includes error handling and upload status feedback

**How to use**:
```jsx
import VideoUploader from './components/VideoUploader';

<VideoUploader
  procedureId="123"
  supabaseUrl="https://your-project.supabase.co"
  supabaseAnonKey="your-anon-key"
  transcoderWebhook="http://localhost:3001/transcode"
  onSuccess={(result) => console.log('Upload complete:', result)}
/>
```

### 5. `utils/videoHelpers.js`
**Purpose**: Utility functions for video operations

**What it provides**:
- `isVideoFile(file)`: Check if file is a supported video format
- `formatFileSize(bytes)`: Human-readable file size formatting
- `generateSafeFilename(name)`: Create safe filenames for storage
- `getVideoMetadata(file)`: Extract video duration, dimensions, etc.
- `formatDuration(seconds)`: Format duration as HH:MM:SS
- `createVideoThumbnail(file)`: Generate thumbnail from video
- `validateVideoFile(file, options)`: Comprehensive video validation
- `VideoUploadTracker`: Class for tracking upload progress

**How to use**:
```javascript
import { isVideoFile, getVideoMetadata, validateVideoFile } from './utils/videoHelpers';

// Validate file
const validation = validateVideoFile(file, { maxSize: 50 * 1024 * 1024 });
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}

// Get metadata
const metadata = await getVideoMetadata(file);
console.log('Duration:', metadata.duration, 'Size:', metadata.width + 'x' + metadata.height);
```

## Complete Setup Workflow

1. **Database Setup**:
   ```sql
   \i sql/procedure_video_storage_setup.sql
   SELECT public.set_storage_settings('https://your-project.supabase.co', 'videos', 3600);
   ```

2. **Create Storage Bucket**:
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ./scripts/create_supabase_buckets.sh
   ```

3. **Start Transcoding Service** (optional):
   ```bash
   cd services
   npm install
   npm start
   ```

4. **Use in React Application**:
   ```jsx
   import VideoUploader from './frontend/src/components/VideoUploader';
   // Use VideoUploader component in your forms
   ```

## Requirements

- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage with public bucket
- **Transcoding**: Node.js 16+, FFmpeg
- **Frontend**: React 18+

## Security Considerations

- Keep service role keys secure and never commit them
- Use environment variables for configuration
- Consider implementing file size limits and virus scanning
- Validate file types on both client and server side
- Use RLS policies to control access to procedure records

## Troubleshooting

- **Upload fails**: Check bucket permissions and RLS policies
- **Transcoding fails**: Ensure FFmpeg is installed and accessible
- **URLs not generated**: Verify storage_settings are configured correctly
- **Authentication errors**: Check service role key and permissions