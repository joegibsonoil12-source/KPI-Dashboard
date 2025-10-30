# Supabase Storage Setup for Ticket Scans

## Overview
This document describes the setup for the `ticket-scans` storage bucket used to store scanned delivery tickets and service reports.

## Bucket Configuration

### 1. Create Storage Bucket

Run this SQL in Supabase SQL Editor or create via Dashboard > Storage:

```sql
-- Create the ticket-scans bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-scans', 'ticket-scans', false)
ON CONFLICT (id) DO NOTHING;
```

### 2. Storage Policies

```sql
-- Allow authenticated users to upload ticket scans
CREATE POLICY "Authenticated users can upload ticket scans"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ticket-scans');

-- Allow authenticated users to view ticket scans
CREATE POLICY "Authenticated users can view ticket scans"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'ticket-scans');

-- Allow service role full access for server-side operations
CREATE POLICY "Service role can manage ticket scans"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'ticket-scans')
  WITH CHECK (bucket_id = 'ticket-scans');

-- Allow admins to delete ticket scans
CREATE POLICY "Admins can delete ticket scans"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ticket-scans'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND LOWER(role) = 'admin'
    )
  );
```

### 3. File Naming Convention

Files should be stored with a structured naming pattern:
```
{import_id}/{timestamp}_{original_filename}
```

Example:
```
123/2024-10-30T123456_delivery_report.pdf
123/2024-10-30T123456_page_1.jpg
```

### 4. Supported File Types

- **PDFs**: `.pdf`
- **Images**: `.jpg`, `.jpeg`, `.png`, `.gif`

### 5. File Size Limits

- Maximum file size: 50MB per file
- Maximum total size per import: 100MB

## Usage in Code

### Upload File
```javascript
const { data, error } = await supabase.storage
  .from('ticket-scans')
  .upload(`${importId}/${timestamp}_${filename}`, file);
```

### Download File
```javascript
const { data, error } = await supabase.storage
  .from('ticket-scans')
  .download(`${importId}/${filename}`);
```

### Get Public URL (for signed URL)
```javascript
const { data } = await supabase.storage
  .from('ticket-scans')
  .createSignedUrl(`${importId}/${filename}`, 3600); // 1 hour expiry
```

## Security Considerations

1. **Private Bucket**: Files are not publicly accessible
2. **Signed URLs**: Use signed URLs with expiry for temporary access
3. **RLS Policies**: All access controlled via Row Level Security
4. **Admin Only Deletion**: Only admins can permanently delete files
5. **Virus Scanning**: Consider adding virus scanning for uploaded files in production

## Verification

After setup, verify the bucket and policies:

```sql
-- Check bucket exists
SELECT * FROM storage.buckets WHERE id = 'ticket-scans';

-- Check policies
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%ticket-scans%';
```

## Troubleshooting

### Issue: Upload fails with permission error
- Verify user is authenticated
- Check RLS policies are created
- Verify bucket exists

### Issue: Cannot view uploaded files
- Verify SELECT policy exists
- Check user authentication
- Ensure file path is correct

### Issue: Service role operations fail
- Verify SUPABASE_SERVICE_ROLE_KEY is set
- Check service role policy exists
- Ensure using service role client, not anon key
