# KPI Dashboard — GitHub Pages (React + Vite)

Upload these files to your repo root. The GitHub Actions workflow will build and publish automatically to GitHub Pages.

## Features

### Video Management
The dashboard includes video management functionality through the **Procedures** tab only. The standalone Videos tab has been removed from the application. Video management features include:

- **Procedure-integrated videos**: Add training videos directly to specific procedures
- **URL-based videos**: Add external video links (YouTube, Vimeo, Loom, etc.)
- **File uploads**: Upload video files directly through the Procedures tab (requires Supabase configuration)
- **Embedded video players**: YouTube, Vimeo, and Loom videos are automatically embedded
- **Supabase integration**: Videos are stored and managed through Supabase with the procedures they belong to

**Note**: Video management is now exclusively available through the Procedures tab. The standalone Videos tab has been removed to consolidate video management with procedure documentation.

To configure Supabase uploads, ensure your Supabase client is properly configured and you have a public storage bucket named 'videos'.

## Supabase Configuration

### Complete Database Setup

This application requires a comprehensive Supabase database setup including tables for KPIs, procedures, and video management. Follow these steps to configure your Supabase project:

#### 1. Quick Setup with Demo Schema (Recommended for Development)

For development and testing, you can use the provided complete schema file that includes all tables, demo data, and RLS policies:

1. **Download and run the schema file:**
   - Copy the SQL from `sql/kpi_dashboard_schema_demo.sql`
   - Open your Supabase Dashboard → SQL Editor
   - Paste and execute the SQL

⚠️ **Warning:** This schema file will drop and recreate tables. Only use in development environments.

#### 2. Manual Database Setup (Production)

For production environments, set up tables individually:

##### Core Tables Setup
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create core business tables
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  address_line text,
  city text,
  state text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now(),
  is_primary boolean DEFAULT true
);

-- Additional tables: tanks, products, jobs, deliveries, invoices, payments, employees, expenses
-- See sql/kpi_dashboard_schema_demo.sql for complete schema
```

##### Procedures and Video Tables
```sql
-- Procedures table
CREATE TABLE procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Procedure videos table
CREATE TABLE procedure_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid REFERENCES procedures(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

#### 3. Row-Level Security (RLS) Setup

Enable RLS and create policies for proper access control:

```sql
-- Enable RLS on procedures table
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to insert procedures" 
ON procedures FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read procedures" 
ON procedures FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to update procedures" 
ON procedures FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete procedures" 
ON procedures FOR DELETE TO authenticated USING (true);

-- Enable RLS on procedure_videos table
ALTER TABLE procedure_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage procedure videos" 
ON procedure_videos FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

#### 4. Storage Configuration

Set up file storage for video uploads:

1. **Create storage bucket:**
   - Go to Supabase Dashboard → Storage
   - Create a new bucket named `videos`
   - Set it as public for easier access

2. **Configure storage policies (if needed):**
```sql
-- Allow authenticated users to upload videos
CREATE POLICY "Allow authenticated users to upload videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'videos');

-- Allow public access to videos
CREATE POLICY "Allow public access to videos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'videos');
```

#### 5. Environment Variables

Create a `.env.local` file in your project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### 6. Authentication Setup

1. **Enable authentication providers** in Supabase Dashboard → Authentication → Providers
2. **Configure email templates** if using email auth
3. **Set up redirect URLs** for your domain

### Video Upload Features

The application supports comprehensive video management:

- **MKV Support**: Upload .mkv files using the VideoUploader component
- **Format Conversion**: Use the provided `scripts/convert_mkv_to_mp4.sh` script to convert MKV files to MP4 for better browser compatibility
- **Multiple Sources**: Support for file uploads and external URLs (YouTube, Vimeo, Loom)
- **Storage Integration**: Automatic upload to Supabase Storage with public URLs

#### Converting MKV to MP4

For better browser compatibility, convert MKV files to MP4 using the included script:

```bash
# Make script executable (first time only)
chmod +x scripts/convert_mkv_to_mp4.sh

# Convert single file
./scripts/convert_mkv_to_mp4.sh input.mkv output.mp4

# Convert with auto-generated name
./scripts/convert_mkv_to_mp4.sh input.mkv

# Convert multiple files
./scripts/convert_mkv_to_mp4.sh *.mkv
```

**Requirements:**
- FFmpeg must be installed on your system
- Script optimizes videos for web playback with H.264/AAC encoding

**Installation:**
- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt install ffmpeg`
- Windows: Download from https://ffmpeg.org/download.html

### Troubleshooting Common Supabase Permission Errors

#### Error: "new row violates row-level security policy"
**Cause:** RLS is enabled but no INSERT policy exists for the current user role.
**Solution:** 
- Ensure you have created the INSERT policy shown above
- Verify the user is authenticated (check `supabase.auth.getUser()`)
- Check that the policy conditions match your use case

#### Error: "permission denied for table procedures"
**Cause:** RLS is not properly configured or user lacks table permissions.
**Solution:**
- Enable RLS on the table: `ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;`
- Create appropriate policies for SELECT, INSERT, UPDATE, DELETE operations
- Ensure your Supabase service role has proper permissions

#### Error: "Failed to add procedure: [supabase error]"
**Cause:** Various Supabase configuration issues.
**Solution:**
- Check browser console for detailed error messages
- Verify Supabase URL and anon key in environment variables
- Test database connection using Supabase dashboard
- Ensure the procedures table exists with correct schema

#### Error: Video upload failures
**Cause:** Storage bucket not configured or RLS issues.
**Solution:**
- Create a public storage bucket named 'videos'
- Configure storage RLS policies if needed
- Verify storage URL configuration

#### General debugging steps:
1. Open browser developer tools and check console for errors
2. Verify authentication status in the application
3. Test queries directly in Supabase SQL editor
4. Check RLS policies in Supabase dashboard under Authentication > Policies
5. Ensure environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are correctly set

## Local dev
```bash
npm install
npm run dev
```
Commit to main
