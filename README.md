# KPI Dashboard — GitHub Pages (React + Vite)

Upload these files to your repo root. The GitHub Actions workflow will build and publish automatically to GitHub Pages.

## Features

### Video Management via Procedures
Video content is managed through the **Procedures** tab, which provides integrated video management capabilities:

- **Procedure Documentation**: Create step-by-step procedures with text descriptions
- **Video Attachments**: Add training videos to procedures using:
  - **URL-based videos**: YouTube, Vimeo, Loom, and other external video links
  - **File uploads**: Direct video file uploads (requires Supabase configuration) 
  - **Inline video management**: Add videos directly to existing procedures
- **Supabase integration**: Persistent storage for procedures and video metadata

All video content is organized within procedures to maintain context and improve training workflows. Videos are embedded directly within procedure cards for easy access during training.

## Local dev
```bash
npm install
npm run dev
```
Commit to main
