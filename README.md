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

## Local dev
```bash
npm install
npm run dev
```
Commit to main
