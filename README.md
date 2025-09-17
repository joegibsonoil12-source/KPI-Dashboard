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

### Row-Level Security (RLS) for Procedures Table

The application requires proper Supabase Row-Level Security (RLS) configuration for the procedures table to function correctly. Without proper RLS policies, users may encounter permission errors when trying to add procedures.

#### Required Database Setup

1. **Enable RLS on the procedures table:**
```sql
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
```

2. **Create a policy to allow authenticated users to insert procedures:**
```sql
CREATE POLICY "Allow authenticated users to insert procedures" 
ON procedures 
FOR INSERT 
TO authenticated 
WITH CHECK (true);
```

3. **Create a policy to allow authenticated users to read procedures:**
```sql
CREATE POLICY "Allow authenticated users to read procedures" 
ON procedures 
FOR SELECT 
TO authenticated 
USING (true);
```

4. **Create a policy to allow authenticated users to update their procedures:**
```sql
CREATE POLICY "Allow authenticated users to update procedures" 
ON procedures 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

5. **Create a policy to allow authenticated users to delete procedures:**
```sql
CREATE POLICY "Allow authenticated users to delete procedures" 
ON procedures 
FOR DELETE 
TO authenticated 
USING (true);
```

#### Similar setup for procedure_videos table:
```sql
ALTER TABLE procedure_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage procedure videos" 
ON procedure_videos 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

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
