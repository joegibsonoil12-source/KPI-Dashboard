# KPI Dashboard — GitHub Pages (React + Vite)

Upload these files to your repo root. The GitHub Actions workflow will build and publish automatically to GitHub Pages.

## Features

### Videos
The dashboard includes a Videos feature that allows users to add and manage training videos and documentation. The Videos page supports:

- **URL-based videos**: Add external video links (YouTube, Vimeo, etc.)
- **File uploads**: Upload video files directly (requires Supabase configuration)
- **Local storage fallback**: Videos are stored in browser localStorage when Supabase is not configured
- **Supabase integration**: Optional integration with Supabase for persistent storage and file uploads

To configure Supabase uploads, ensure your Supabase client is properly configured and you have a public storage bucket named 'videos' (or pass a custom bucket name to the component).

## Local dev
```bash
npm install
npm run dev
```
Commit to main
