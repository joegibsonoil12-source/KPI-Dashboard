# KPI Dashboard — GitHub Pages (React + Vite)

Upload these files to your repo root. The GitHub Actions workflow will build and publish automatically to GitHub Pages.

## Features

### Video Management via Procedures
The dashboard includes video functionality integrated within the Procedures tab. Users can add and manage training videos and documentation directly attached to specific procedures. The video management supports:

- **URL-based videos**: Add external video links (YouTube, Vimeo, Loom, etc.)
- **File uploads**: Upload video files directly (requires Supabase configuration)
- **Procedure integration**: Videos are attached to specific procedure documents for better organization
- **Supabase integration**: Integration with Supabase for persistent storage and file uploads

To configure Supabase uploads, ensure your Supabase client is properly configured and you have a public storage bucket named 'videos'.

## Local dev
```bash
npm install
npm run dev
```
Commit to main
