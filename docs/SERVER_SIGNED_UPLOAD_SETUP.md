# Server-Signed Upload Implementation

## Overview
This document describes the server-signed-upload implementation for Supabase storage, which provides a fallback mechanism when direct client uploads fail due to permission or bucket access issues.

## Components

### API Endpoint: `/api/uploads/signed`
**Location:** `src/pages/api/uploads/signed.js`

The server-side endpoint handles file uploads to Supabase storage using service role credentials.

**Features:**
- Supports both `multipart/form-data` and JSON with base64 encoded files
- Uses Supabase service role key for elevated permissions
- Uploads to `ticket-scans` bucket
- Returns storage path and signed URL (1 hour expiry)
- Sanitizes filenames to prevent path traversal attacks

**Request Format (JSON):**
```json
{
  "filename": "scan.pdf",
  "contentType": "application/pdf",
  "base64": "JVBERi0xLjQKJ..."
}
```

**Response Format:**
```json
{
  "storagePath": "upload_2025-11-05-20-00-00/scan.pdf",
  "signedViewUrl": "https://...",
  "filename": "scan.pdf",
  "contentType": "application/pdf"
}
```

### Client Component
**Location:** `src/components/UploadServiceScanButton.jsx`

**Upload Flow:**
1. Attempts direct client upload to Supabase storage (primary method)
2. If client upload fails with bucket/permission errors (404/403):
   - Converts file to base64
   - Calls `/api/uploads/signed` endpoint
   - Uses server response for ticket_imports record
3. All subsequent files in the same batch use server upload if fallback was triggered
4. Creates ticket_imports record with status='pending'
5. Best-effort POST to `/api/imports/process/:id`
6. Navigates to imports review page

## Prerequisites

### 1. Supabase Storage Bucket
Create the `ticket-scans` bucket (private):

**Option A: Supabase CLI**
```bash
supabase login
supabase link --project-ref jskajkwulaaakhaolzdu
supabase storage create-bucket ticket-scans --public false
```

**Option B: Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Navigate to Storage
3. Create new bucket: name=`ticket-scans`, public=`false`

**Option C: SQL Script**
Run the SQL from `supabase/STORAGE_BUCKET_SETUP.sql` in Supabase SQL Editor

### 2. Environment Variables
Configure in your deployment environment (Vercel/Netlify):

**Required for API endpoint:**
- `SUPABASE_URL` or `VITE_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (DO NOT commit to repo)

**Required for client:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Anonymous key for client access

### 3. RLS Policies (Optional)
The server-signed-upload bypasses RLS using service role credentials. However, for direct client uploads, you can optionally enable these policies:

```sql
-- Allow anon users to upload to ticket-scans bucket
CREATE POLICY "Allow anon upload ticket-scans"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'ticket-scans');
```

See `supabase/STORAGE_BUCKET_SETUP.sql` for complete RLS setup.

## Security Considerations

1. **Service Role Key Protection**
   - Never commit service role key to repository
   - Only configure in deployment environment variables
   - Service role has elevated permissions - handle with care

2. **Filename Sanitization**
   - Automatically removes path traversal patterns (`../`)
   - Replaces special characters with underscores
   - Prevents directory traversal attacks

3. **Signed URLs**
   - Generated URLs expire after 1 hour
   - Bucket remains private (not publicly accessible)
   - Each file requires a signed URL for access

4. **Upload Path**
   - Files organized by timestamp: `upload_YYYY-MM-DD-HH-MM-SS/filename`
   - Prevents filename collisions
   - Makes file organization predictable

## Testing

To test the implementation:

1. Ensure `ticket-scans` bucket exists in Supabase
2. Configure environment variables in your deployment
3. Deploy the application
4. Navigate to delivery page and click "Upload Service Scan"
5. Select PDF or image files
6. Verify uploads appear in Supabase Storage under `ticket-scans` bucket
7. Check browser console for diagnostic logs

## Troubleshooting

**Error: "Storage bucket 'ticket-scans' not found"**
- Create the bucket using one of the methods in Prerequisites

**Error: "Permission denied for storage upload"**
- Client upload will automatically fall back to server-signed-upload
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is configured in deployment

**Error: "Failed to create signed URL"**
- Check that service role key is correct
- Verify bucket exists and is accessible

**Server endpoint not found (404)**
- Ensure deployment includes API routes
- Verify `/api/uploads/signed` endpoint is deployed
- Check serverless function logs for errors

## Deployment Notes

### Vercel
- API routes automatically deployed as serverless functions
- Configure environment variables in Vercel dashboard
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set

### Netlify
- API routes need Netlify Functions configuration
- May require copying API routes to `netlify/functions/`
- Configure environment variables in Netlify dashboard

### GitHub Pages
- Server-signed-upload requires external API endpoint
- Cannot deploy serverless functions with GitHub Pages
- Consider using Vercel/Netlify for API routes separately
