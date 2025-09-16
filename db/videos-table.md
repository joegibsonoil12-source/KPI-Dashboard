# Videos Table SQL Setup

This document contains the SQL commands needed to set up the videos table in your Supabase database.

## 1. Create the videos table

```sql
-- Create videos table
CREATE TABLE videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all videos
CREATE POLICY "Anyone can read videos" ON videos
    FOR SELECT USING (true);

-- Allow authenticated users to insert videos
CREATE POLICY "Authenticated users can insert videos" ON videos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to delete their own videos (if you want user-specific videos)
-- Uncomment and modify if you have user ownership:
-- CREATE POLICY "Users can delete own videos" ON videos
--     FOR DELETE USING (auth.uid()::text = user_id);

-- Allow users to update their own videos (if you want user ownership)
-- Uncomment and modify if you have user ownership:
-- CREATE POLICY "Users can update own videos" ON videos
--     FOR UPDATE USING (auth.uid()::text = user_id);
```

## 2. Create storage bucket for video files

```sql
-- Create a storage bucket for videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true);

-- Set up storage policies for the videos bucket
CREATE POLICY "Anyone can view videos" ON storage.objects
    FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Authenticated users can upload videos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own video files" ON storage.objects
    FOR DELETE USING (bucket_id = 'videos' AND auth.role() = 'authenticated');
```

## 3. Optional: Add user ownership

If you want to associate videos with specific users, add a user_id column:

```sql
-- Add user_id column (optional)
ALTER TABLE videos ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Update RLS policies to include user ownership
DROP POLICY IF EXISTS "Anyone can read videos" ON videos;
DROP POLICY IF EXISTS "Authenticated users can insert videos" ON videos;

-- New policies with user ownership
CREATE POLICY "Users can read all videos" ON videos
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert videos" ON videos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "Users can update own videos" ON videos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos" ON videos
    FOR DELETE USING (auth.uid() = user_id);
```

## 4. Sample data (optional)

```sql
-- Insert some sample videos for testing
INSERT INTO videos (id, title, description, url) VALUES
    ('vid_sample_1', 'Sample YouTube Video', 'A sample YouTube video for testing embeds', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ('vid_sample_2', 'Sample Vimeo Video', 'A sample Vimeo video for testing embeds', 'https://vimeo.com/147365861'),
    ('vid_sample_3', 'Direct Video Link', 'A sample direct video file link', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
```

## Database Schema

```
videos
├── id (TEXT, PRIMARY KEY) - Unique identifier for the video
├── title (TEXT, NOT NULL) - Video title
├── description (TEXT) - Optional video description
├── url (TEXT, NOT NULL) - Video URL (YouTube, Vimeo, direct file, etc.)
├── created_at (TIMESTAMPTZ) - Timestamp when video was added
└── user_id (UUID, OPTIONAL) - Reference to auth.users(id) for user ownership
```

## Storage Bucket Structure

```
videos/ (bucket)
├── {timestamp}_{original_filename}
├── 1702925234567_training_video.mp4
├── 1702925345678_safety_demo.webm
└── ...
```

## Notes

1. **Public Access**: The examples above assume you want videos to be publicly readable. Adjust RLS policies as needed for your security requirements.

2. **File Uploads**: The storage bucket is configured to accept uploads from authenticated users. Ensure your Supabase project has proper authentication set up.

3. **File Naming**: The Videos component automatically generates unique filenames using timestamps to prevent conflicts.

4. **Supported Formats**: The component accepts any video format, but for web playback, stick to MP4, WebM, and OGG formats.

5. **Size Limits**: Supabase has default file size limits. Check your project's storage settings if you need to upload large video files.