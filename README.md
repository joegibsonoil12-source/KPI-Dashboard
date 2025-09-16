# KPI Dashboard — GitHub Pages (React + Vite)

Upload these files to your repo root. The GitHub Actions workflow will build and publish automatically to GitHub Pages.

## CI/CD Workflow

The repository includes a robust CI workflow (`.github/workflows/ci.yml`) that:

- ✅ **Safe script execution**: Uses environment variables and proper quoting to prevent shell injection
- ✅ **Smart script detection**: Uses `jq` to parse `package.json` directly, with fallback methods
- ✅ **No command execution errors**: Only runs npm scripts that actually exist
- ✅ **Validates builds**: Checks that build artifacts are created successfully
- ✅ **PR readiness checks**: Validates pull request metadata safely

### Security Features
- **Shell injection prevention**: PR descriptions and other user input are handled via environment variables
- **Command existence verification**: Scripts are checked before execution to prevent "command not found" errors
- **No non-executable execution**: Only valid shell commands and npm scripts are executed

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
