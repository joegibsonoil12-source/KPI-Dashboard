# KPI Dashboard — GitHub Pages (React + Vite)

Upload these files to your repo root. The GitHub Actions workflow will build and publish automatically to GitHub Pages.

## Features

### Video Management via Procedures
The dashboard includes video management capabilities integrated into the Procedures tab. Video features include:

- **URL-based videos**: Add external video links (YouTube, Vimeo, Loom, etc.) to procedures
- **File uploads**: Upload video files directly (requires Supabase configuration) 
- **Video attachments**: Associate videos with specific training procedures
- **Supabase integration**: Video files are stored in Supabase Storage with metadata in the database
- **Admin controls**: Only administrators can add, edit, and delete procedures and videos

**Note**: The standalone Videos tab has been removed. All video management is now handled within the Procedures tab where videos can be properly associated with training documentation.

To configure Supabase uploads, ensure your Supabase client is properly configured and you have a public storage bucket named 'videos' (or pass a custom bucket name to the component).

## Local dev
```bash
npm install
npm run dev
```
Commit to main
