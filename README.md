# KPI Dashboard — GitHub Pages (React + Vite)

Upload these files to your repo root. The GitHub Actions workflow will build and publish automatically to GitHub Pages.

## Features

### Video Management
Video management is integrated into the **Procedures tab** for training and documentation purposes. The Procedures page supports:

- **URL-based videos**: Add external video links (YouTube, Vimeo, Loom) directly to procedures
- **File uploads**: Upload video files directly (requires Supabase configuration)  
- **Procedure-based organization**: Videos are attached to specific procedures for better organization
- **Supabase integration**: Optional integration with Supabase for persistent storage and file uploads

To configure Supabase uploads, ensure your Supabase client is properly configured and you have a public storage bucket named 'videos'.

**Note**: The standalone Videos tab has been removed. All video management is now done through the Procedures tab for better organization and workflow.

## Local dev
```bash
npm install
npm run dev
```
Commit to main
