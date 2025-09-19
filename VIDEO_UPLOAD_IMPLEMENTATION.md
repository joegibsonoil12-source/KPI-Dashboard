# Video Upload and Playback Implementation

This implementation adds comprehensive video upload and playback functionality to the KPI Dashboard using Supabase Storage. The solution is framework-agnostic but includes Next.js examples.

## Features

- ✅ Secure video upload to Supabase Storage with metadata
- ✅ Row Level Security (RLS) for owner-based access control
- ✅ Signed URL generation for private video access
- ✅ React VideoPlayer component with loading and error states
- ✅ Framework-agnostic design (supports both Vite and Next.js)
- ✅ Automatic cleanup on upload failures
- ✅ Video metadata extraction (duration, file size, etc.)

## Files Added

### 1. Database Migration
- **`supabase/migrations/0001_create_videos_table.sql`**
  - Creates `videos` table with comprehensive metadata fields
  - Sets up RLS policies for owner-based access
  - Includes indexes for performance
  - Auto-updating timestamps

### 2. Client Library
- **`src/lib/supabaseClient.js`** (updated)
  - Enhanced to support both Vite (`import.meta.env`) and Next.js (`process.env`) environments
  - Exports factory function for creating custom client instances

### 3. Upload Helper
- **`src/lib/uploadVideo.js`**
  - Browser-side video upload with automatic metadata extraction
  - Handles file validation, authentication, and error cleanup
  - Supports custom titles and descriptions
  - Extracts video duration when possible

### 4. URL Helper
- **`src/lib/getVideoUrl.js`**
  - Fetches signed URLs from the API for secure video access
  - Supports batch URL generation
  - Configurable expiration times

### 5. API Route (Next.js)
- **`pages/api/video-url.js`**
  - Server-side signed URL generation using service role key
  - Basic authentication structure (configurable for production)
  - Error handling and validation

### 6. React Components
- **`components/VideoPlayer.jsx`**
  - Complete video player with loading/error states
  - Auto-refresh for signed URLs
  - Customizable styling and controls
  - Event callbacks for load/error handling

- **`src/components/VideoUploadDemo.jsx`**
  - Complete demo component showing upload and playback
  - Can be integrated into existing components

### 7. Demo Page
- **`pages/video-demo.js`**
  - Full-featured demo page for testing functionality
  - Upload form with metadata fields
  - Video player integration

## Usage Examples

### Basic Upload
```javascript
import { uploadVideo } from '../src/lib/uploadVideo.js';

const handleUpload = async (file) => {
  const result = await uploadVideo(file, {
    title: 'My Video',
    description: 'Video description'
  });
  
  if (result.error) {
    console.error('Upload failed:', result.error);
  } else {
    console.log('Upload successful:', result.data);
  }
};
```

### Video Player
```jsx
import VideoPlayer from '../components/VideoPlayer.jsx';

function MyComponent({ videoPath }) {
  return (
    <VideoPlayer
      filePath={videoPath}
      controls={true}
      onLoad={(url) => console.log('Video loaded')}
      onError={(error) => console.error('Player error:', error)}
    />
  );
}
```

### Get Signed URL
```javascript
import { getVideoUrl } from '../src/lib/getVideoUrl.js';

const getUrl = async (filePath) => {
  const result = await getVideoUrl(filePath);
  if (result.url) {
    return result.url;
  } else {
    throw new Error(result.error);
  }
};
```

## Environment Variables

### Required for Production
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Vite Alternative
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Setup Instructions

### 1. Database Setup
Run the migration in your Supabase SQL editor:
```sql
-- Execute the contents of supabase/migrations/0001_create_videos_table.sql
```

### 2. Storage Bucket
Create a 'videos' bucket in Supabase Storage:
1. Go to Storage in Supabase Dashboard
2. Create new bucket named 'videos'
3. Set appropriate policies for your use case

### 3. Environment Variables
Set the required environment variables in your deployment platform.

### 4. API Route (Next.js)
If using Next.js, ensure the API route is accessible at `/api/video-url`.

## Security Considerations

### Row Level Security (RLS)
- Videos are automatically owned by the uploading user
- Users can only access their own videos
- All database operations respect RLS policies

### Authentication
- Upload requires authenticated user
- API route includes basic auth structure (enhance for production)
- Signed URLs provide secure, time-limited access

### Production Recommendations
1. Implement robust JWT token validation in API route
2. Add file type and size validation
3. Consider virus scanning for uploaded files
4. Implement rate limiting
5. Add comprehensive logging

## Integration with Existing Code

The implementation is designed to work alongside existing video functionality in `src/tabs/Procedures_v3.jsx`. You can:

1. Replace the existing `uploadVideoToSupabase` function with the new `uploadVideo` helper
2. Use the new `VideoPlayer` component instead of direct video tags
3. Store video metadata in the new `videos` table for better organization

## Testing

The implementation includes:
- Build verification (passes `npm run build`)
- Module import testing
- Error handling validation
- Component rendering tests

All components are framework-agnostic and can be used in any React application.