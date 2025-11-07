# Upload Service Implementation with Local Fallback

This document describes the implementation of the robust upload service with server-signed-upload and local fallback capabilities.

## Overview

The upload system implements a **3-tier fallback strategy** to ensure reliability:

1. **Client Direct Upload** - Attempts upload using anonymous Supabase client (VITE_SUPABASE_ANON_KEY)
2. **Server-Signed Upload** - Falls back to server endpoint using service role credentials
3. **Local Storage Fallback** - Saves import data locally in browser's localStorage as last resort

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UploadServiceScanButton.jsx (Frontend)                     │
│  - Handles file selection and upload orchestration          │
│  - Implements 3-tier fallback strategy                      │
└──────────────┬─────────────────────────────┬────────────────┘
               │                              │
               ▼ (1) Try Client Upload        ▼ (2) Fallback to Server
    ┌──────────────────────┐      ┌──────────────────────────┐
    │  Supabase Storage    │      │  Server Upload Endpoint   │
    │  (anon credentials)  │      │  /api/uploads/signed      │
    │  - Direct upload     │      │  or local server :4001    │
    └──────────────────────┘      └──────────────────────────┘
                                              │
                                              ▼ Uses Service Role
                                   ┌──────────────────────────┐
                                   │  Supabase Storage        │
                                   │  (service role bypass)   │
                                   └──────────────────────────┘
               │
               ▼ (3) Final Fallback
    ┌──────────────────────────────────┐
    │  localStorage (Browser)          │
    │  - Saves import with base64      │
    │  - No server required            │
    └──────────────────────────────────┘
```

## Files

### Core Implementation

#### 1. `src/lib/localImports.js` (NEW)
localStorage helper for managing local imports when uploads fail.

**Key Functions:**
- `saveLocalImport(importData)` - Save import to localStorage with base64 files
- `getLocalImports()` - Retrieve all local imports
- `getLocalImport(id)` - Get specific import by ID
- `deleteLocalImport(id)` - Remove a local import
- `clearAllLocalImports()` - Clear all local storage
- `isLocalStorageAvailable()` - Check if localStorage is available
- `getStorageInfo()` - Get storage usage statistics

**Usage Example:**
```javascript
import { saveLocalImport } from '../lib/localImports.js';

const importId = saveLocalImport({
  src: 'upload',
  attached_files: [{ name: 'file.pdf', base64: '...', mimetype: 'application/pdf' }],
  meta: { source: 'delivery_page_upload' }
});
```

#### 2. `server/local_upload_server.js` (NEW)
Express server for local development and testing.

**Endpoints:**
- `POST /uploads/signed` - Upload files using service role credentials
- `GET /health` - Health check endpoint

**Environment Variables Required:**
- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Never commit this!)

**Running Locally:**
```bash
# Install dependencies (if not already done)
cd server
npm install express cors @supabase/supabase-js

# Run with environment variables
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your_key_here \
node local_upload_server.js
```

**Request Format:**
```bash
curl -X POST http://localhost:4001/uploads/signed \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "ticket.pdf",
    "contentType": "application/pdf",
    "base64": "JVBERi0xLjQKJeLjz9MKMy..."
  }'
```

**Response:**
```json
{
  "storagePath": "upload_2024-11-07-12-30-45/ticket.pdf",
  "signedViewUrl": "https://xxx.supabase.co/storage/v1/object/sign/...",
  "filename": "ticket.pdf",
  "contentType": "application/pdf"
}
```

#### 3. `src/pages/api/uploads/signed.js` (EXISTING - No Changes)
Already implements server-side upload correctly:
- Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env
- Supports both JSON (base64) and multipart/form-data
- Creates signed URLs for uploaded files
- Returns `{storagePath, signedViewUrl}`

#### 4. `src/components/UploadServiceScanButton.jsx` (UPDATED)
Main upload component with 3-tier fallback strategy.

**Changes Made:**
1. Added import: `import { saveLocalImport } from '../lib/localImports.js'`
2. Enhanced error handling with local fallback
3. Converts files to base64 when saving locally
4. Shows user-friendly messages for each scenario

**Upload Flow:**
```javascript
// 1. Try client upload
const { data, error } = await supabase.storage
  .from('ticket-scans')
  .upload(dest, file);

if (error && (isBucketError || isPermissionError)) {
  // 2. Try server upload
  const serverResult = await uploadViaServer(file);
  
  if (serverError) {
    // 3. Save locally
    const localImportId = saveLocalImport({
      src: 'upload',
      attached_files: filesWithBase64,
      status: 'local_pending',
      meta: { uploadFailed: true }
    });
  }
}
```

## Environment Configuration

### Frontend (.env or window.__ENV)
```bash
# Required for all uploads
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional: Override server upload endpoint
# Default: /api/uploads/signed (works for Vercel/Netlify)
# For GitHub Pages + external API: https://your-api.vercel.app/api/uploads/signed
VITE_UPLOADS_SIGNED_URL=
```

### Backend (Serverless Functions / Local Server)
```bash
# Required for server-signed-upload
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ⚠️ NEVER commit SUPABASE_SERVICE_ROLE_KEY to version control!
# Set in deployment environment (Vercel/Netlify/etc.)
```

## Supabase Setup Requirements

### 1. Create Storage Bucket

**Option A: Supabase Dashboard**
1. Go to Supabase Dashboard → Storage
2. Click "Create bucket"
3. Name: `ticket-scans`
4. Public: **No** (private bucket)
5. File size limit: 50MB
6. Allowed MIME types: `image/jpeg, image/png, image/gif, application/pdf`

**Option B: Supabase CLI**
```bash
supabase storage create-bucket ticket-scans --public false
```

**Option C: SQL Script**
Run the SQL from `supabase/STORAGE_BUCKET_SETUP.sql`

### 2. Configure RLS Policies

The bucket needs RLS policies to allow uploads. Run this SQL:

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to upload
CREATE POLICY "Allow anon upload ticket-scans"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'ticket-scans');

-- Allow anonymous users to read (for signed URLs)
CREATE POLICY "Allow anon read ticket-scans"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'ticket-scans');

-- Allow service role all operations
CREATE POLICY "Allow service_role manage ticket-scans"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'ticket-scans')
  WITH CHECK (bucket_id = 'ticket-scans');
```

See `supabase/STORAGE_BUCKET_SETUP.sql` for complete setup.

## Testing

### Test 1: Client Direct Upload (Happy Path)
1. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
2. Ensure bucket 'ticket-scans' exists with RLS policies
3. Upload a file via UploadServiceScanButton
4. Check console for: `[UploadServiceScanButton] File uploaded successfully`

### Test 2: Server Upload Fallback
1. Remove anon upload policy (simulate permission error)
2. Ensure VITE_UPLOADS_SIGNED_URL points to working server
3. Upload a file
4. Check console for: `[UploadServiceScanButton] Client upload failed, attempting server-signed-upload fallback...`
5. Should succeed via server route

### Test 3: Local Storage Fallback
1. Remove bucket or disable both client and server uploads
2. Upload a file
3. Check console for: `[UploadServiceScanButton] Attempting local storage fallback...`
4. Should see alert: "⚠️ Upload to cloud storage failed. Your import has been saved locally."
5. Import ID will have prefix `local_`

### Test 4: Local Development Server
```bash
# Terminal 1: Start local upload server
cd /home/runner/work/KPI-Dashboard/KPI-Dashboard
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
node server/local_upload_server.js

# Terminal 2: Configure frontend to use local server
export VITE_UPLOADS_SIGNED_URL=http://localhost:4001/uploads/signed

# Start frontend
npm run dev
```

## Debugging

### Enable Debug Logging
All components use `console.debug` for detailed logging. Check browser console with filter: `[UploadServiceScanButton]` or `[local-upload-server]` or `[localImports]`

### Common Issues

**Issue: "Storage bucket 'ticket-scans' not found"**
- **Solution:** Create the bucket in Supabase Dashboard or run SQL setup script

**Issue: "Permission denied for storage upload"**
- **Solution:** Add RLS policies for anon and service_role roles

**Issue: "Server upload failed"**
- **Solution:** Verify SUPABASE_SERVICE_ROLE_KEY is set in server environment
- Check server logs for detailed error message

**Issue: "Local storage quota exceeded"**
- **Solution:** Clear old local imports using `clearAllLocalImports()`
- localStorage typically has 5-10MB limit per domain

## Security Considerations

✅ **Good Practices:**
- Service role key is NEVER committed to code
- All keys read from environment variables
- Signed URLs expire after 1 hour
- File names are sanitized to prevent path traversal
- Base64 encoding used for API transport

⚠️ **Important Notes:**
- Local storage is NOT encrypted - avoid storing sensitive data
- Local imports are browser-specific and not synced
- Service role key grants admin access - keep it secret!

## Monitoring

**Successful Upload Logs:**
```
[imports/upload] source=delivery_page_upload id=123 files=2
```

**Local Fallback Logs:**
```
[imports/upload] source=delivery_page_upload id=local_1699123456_abc123 files=2 (saved locally)
```

**Server Upload Logs:**
```
[local-upload-server] Uploading file: ticket.pdf (application/pdf)
[local-upload-server] Upload complete!
```

## Future Enhancements

- [ ] Add UI to view and manage local imports
- [ ] Implement retry mechanism for failed uploads
- [ ] Add batch upload progress indicator
- [ ] Support for drag-and-drop file upload
- [ ] Compress images before upload
- [ ] Add file type validation
- [ ] Implement upload resume for large files

## Related Documentation

- `supabase/STORAGE_BUCKET_SETUP.sql` - Complete SQL setup for storage
- `.env.example` - Environment variable reference
- `SUPABASE_UPLOAD_SETUP.md` - Detailed Supabase configuration guide
