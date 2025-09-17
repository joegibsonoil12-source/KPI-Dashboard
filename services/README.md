# Video Transcoder Service

This service provides video transcoding capabilities for the KPI Dashboard, converting uploaded videos to web-optimized MP4 format.

## Requirements

- Node.js 16+ 
- FFmpeg installed on the system
- Supabase project with Storage enabled

## Installation

```bash
cd services
npm install
```

## Configuration

Set the following environment variables:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export PORT=3001  # optional, defaults to 3001
export TMP_DIR="/tmp"  # optional, defaults to /tmp
```

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## API Endpoints

### POST /transcode

Transcodes a video file stored in Supabase Storage to web-optimized MP4.

**Request Body:**
```json
{
  "bucket": "videos",
  "object_path": "uploads/video.mov",
  "procedure_id": "123"
}
```

**Response:**
```json
{
  "success": true,
  "playable_path": "videos/uploads/video.playable.mp4"
}
```

## How it works

1. Downloads the original video from Supabase Storage
2. Transcodes it to MP4 using FFmpeg with web-optimized settings:
   - H.264 video codec
   - AAC audio codec
   - Fast start for streaming
   - Reasonable quality/size balance
3. Uploads the transcoded video back to Storage
4. Updates the procedure record with the playable video path
5. Cleans up temporary files

## FFmpeg Installation

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg
```

### macOS
```bash
brew install ffmpeg
```

### Docker
```dockerfile
FROM node:16-alpine
RUN apk add --no-cache ffmpeg
# ... rest of your Dockerfile
```

## Error Handling

The service includes comprehensive error handling and logging. Check the console output for detailed error messages during transcoding operations.

## Security Notes

- Keep your SUPABASE_SERVICE_ROLE_KEY secure and never commit it to version control
- The service requires service role permissions to read/write Storage and update procedure records
- Consider running this service in a secure environment with appropriate access controls