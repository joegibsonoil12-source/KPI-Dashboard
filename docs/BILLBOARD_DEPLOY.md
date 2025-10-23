# Billboard Deployment Guide

This guide explains how to deploy the Billboard feature with serverless functions for production use.

## Table of Contents

1. [Overview](#overview)
2. [Deployment Options](#deployment-options)
3. [Vercel Deployment](#vercel-deployment)
4. [Netlify Deployment](#netlify-deployment)
5. [Environment Variables](#environment-variables)
6. [TV Kiosk Mode](#tv-kiosk-mode)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

## Overview

The Billboard feature provides a real-time operations dashboard displaying:
- Service tracking metrics (completed, scheduled, deferred)
- Delivery ticket metrics (tickets, gallons, revenue)
- Week-over-week performance comparison

The application consists of:
- **Frontend**: React/Vite application (static HTML/JS/CSS)
- **Backend**: Serverless function at `/api/billboard-summary`

The serverless function aggregates data from your services and caches it for 15 seconds to reduce database load.

## Deployment Options

The Billboard can be deployed in several ways:

### Option 1: Vercel (Recommended)
- ✅ Zero configuration - works out of the box
- ✅ Auto-detects `api/` folder for serverless functions
- ✅ Global CDN with edge caching
- ✅ Free tier available

### Option 2: Netlify
- ✅ Simple configuration via `netlify.toml`
- ✅ Functions folder support
- ✅ Good free tier
- ✅ Easy redirects for API routes

### Option 3: GitHub Pages + External API
- Frontend on GitHub Pages (static)
- Serverless function on Vercel/Netlify
- Configure `VITE_BILLBOARD_API_BASE` to point to serverless function URL

## Vercel Deployment

### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Vite configuration

### Step 2: Configure Build Settings

Vercel should auto-detect these settings:

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Set Environment Variables

In Vercel dashboard → Project Settings → Environment Variables:

**Required for Backend API:**
```
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BILLBOARD_TV_TOKEN=your-secret-token-here
```

**Optional for Frontend (only if needed):**
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BILLBOARD_API_BASE=
VITE_BILLBOARD_TV_TOKEN=your-secret-token-here
```

**Important Notes:**
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used by the serverless function to query the database
- `BILLBOARD_TV_TOKEN` is used by the serverless function to validate TV mode access
- `VITE_BILLBOARD_TV_TOKEN` should match `BILLBOARD_TV_TOKEN` so the frontend can append the correct token
- Generate a secure token: `openssl rand -base64 32`

### Step 4: Deploy

1. Click "Deploy"
2. Vercel will:
   - Install dependencies
   - Build the frontend
   - Deploy the `api/billboard-summary.js` function
   - Assign a URL (e.g., `https://your-app.vercel.app`)

### Step 5: Test

Visit `https://your-app.vercel.app/billboard` to see the dashboard.

The API will be available at `https://your-app.vercel.app/api/billboard-summary`.

## Netlify Deployment

### Step 1: Connect Repository

1. Go to [netlify.com](https://netlify.com) and sign in
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select your repository

### Step 2: Configure Build Settings

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Functions directory**: `netlify/functions` (auto-detected from netlify.toml)

### Step 3: Set Environment Variables

In Netlify dashboard → Site Settings → Environment Variables:

**Required for Backend API:**
```
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BILLBOARD_TV_TOKEN=your-secret-token-here
```

**Optional for Frontend (only if needed):**
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BILLBOARD_API_BASE=
VITE_BILLBOARD_TV_TOKEN=your-secret-token-here
```

**Important Notes:**
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used by the serverless function to query the database
- `BILLBOARD_TV_TOKEN` is used by the serverless function to validate TV mode access
- `VITE_BILLBOARD_TV_TOKEN` should match `BILLBOARD_TV_TOKEN` so the frontend can append the correct token
- Generate a secure token: `openssl rand -base64 32`

### Step 4: Deploy

1. Click "Deploy site"
2. Netlify will:
   - Install dependencies
   - Build the frontend
   - Deploy functions from `netlify/functions/`
   - The `netlify.toml` file redirects `/api/*` to functions

### Step 5: Test

Visit `https://your-app.netlify.app/billboard` to see the dashboard.

The API will be available at `https://your-app.netlify.app/api/billboard-summary`.

## Environment Variables

### Frontend Variables (VITE_* prefix)

These are embedded in the frontend build and accessible via `import.meta.env`:

```bash
# Optional: Override API base URL
# Leave empty to use relative path (default - works for Vercel/Netlify and local dev)
# Set to external API URL only if deploying frontend separately (e.g., GitHub Pages)
VITE_BILLBOARD_API_BASE=

# Billboard refresh interval in seconds
VITE_BILLBOARD_REFRESH_SEC=30

# TV Mode Token (must match backend BILLBOARD_TV_TOKEN)
# Used by frontend to append ?token=... when opening TV mode
VITE_BILLBOARD_TV_TOKEN=your-secret-token-here

# Supabase (if using database features in frontend)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Backend Variables (serverless function)

These are only accessible to serverless functions and NOT exposed to the frontend:

```bash
# Required: Supabase credentials for data queries
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Token for TV mode access control
# When set, /api/billboard-summary?tv=1 will require matching token
BILLBOARD_TV_TOKEN=your-secret-token-here
```

**Security Notes:**
- `SUPABASE_SERVICE_ROLE_KEY` has elevated permissions - NEVER expose to frontend
- Set backend variables in Vercel/Netlify deployment settings, NOT in .env files
- Frontend variables (VITE_*) are embedded in the build and publicly accessible

## TV Kiosk Mode

The Billboard includes a TV/kiosk mode for displaying on large screens in your office.

### Accessing TV Mode

Navigate to: `/billboard?tv=1`

Or use the "📺 Pop Out TV" button in the regular view to open TV mode in a centered window.

Use the "📋 Copy TV URL" button to copy the TV mode URL to clipboard for easy sharing or bookmarking.

TV mode features:
- Fullscreen display
- No header/footer clutter
- Auto-refresh at configured interval
- Optimized for readability from distance

### With Token Protection

If you set `BILLBOARD_TV_TOKEN` in your serverless function environment and `VITE_BILLBOARD_TV_TOKEN` in your frontend environment:

```
/billboard?tv=1&token=YOUR_SECRET_TOKEN
```

The frontend will automatically append the token when you use the "Pop Out TV" or "Copy TV URL" buttons.

### Hardware Options for TV Display

#### Option 1: Chromecast
1. Cast browser tab from laptop/desktop
2. Navigate to TV mode URL
3. Chromecast will display full-screen

#### Option 2: Raspberry Pi Kiosk

Setup a dedicated Raspberry Pi:

```bash
# Install Chromium in kiosk mode
sudo apt-get install chromium-browser unclutter

# Create autostart script at ~/.config/lxsession/LXDE-pi/autostart
@chromium-browser --kiosk --noerrdialogs --disable-infobars \
  https://your-app.vercel.app/billboard?tv=1

# Disable screen blanking
sudo nano /etc/lightdm/lightdm.conf
# Add: xserver-command=X -s 0 -dpms
```

#### Option 3: Smart TV Browser

Most modern smart TVs have a web browser:

1. Open browser on TV
2. Navigate to `/billboard?tv=1`
3. Enable fullscreen (varies by TV model)

**Tip**: Bookmark the URL for quick access

#### Option 4: Old Laptop/Desktop

Repurpose an old computer:

1. Install lightweight Linux (e.g., Ubuntu)
2. Set browser to launch at startup in kiosk mode
3. Connect to TV via HDMI

### Auto-Refresh Configuration

The billboard auto-refreshes data at configurable intervals.

Default: 30 seconds

Override via environment variable:
```bash
VITE_BILLBOARD_REFRESH_SEC=60  # Refresh every 60 seconds
```

Override via URL parameter (for testing):
```
/billboard?tv=1&refresh=10  # Refresh every 10 seconds
```

## Security Considerations

### Token Protection

The `BILLBOARD_TV_TOKEN` provides basic access control:

**Generate a secure token:**
```bash
# On Linux/Mac
openssl rand -base64 32

# Or use a password generator
# Recommendation: 32+ characters
```

**Set the token:**

1. In your serverless function environment (Vercel/Netlify)
2. NOT in frontend environment variables (would be exposed)
3. Share with authorized users only

**Access with token:**
```
/billboard?tv=1&token=YOUR_SECRET_TOKEN
```

⚠️ **Important**: 
- Do not commit tokens to Git
- Rotate tokens periodically
- Use HTTPS in production (Vercel/Netlify provide this by default)
- Token is passed in URL, so avoid sharing URLs with token in public channels

### Additional Security

For more robust security, consider:

1. **IP Whitelisting**: Configure in Vercel/Netlify to allow only office IPs
2. **VPN**: Put dashboard behind company VPN
3. **Authentication**: Add OAuth/SSO (requires more setup)

## Troubleshooting

### Issue: API returns 404

**Symptom**: Billboard loads but shows "Failed to load billboard data"

**Solution**: 
- Verify serverless function deployed correctly
- Check function logs in Vercel/Netlify dashboard
- Ensure `api/billboard-summary.js` (Vercel) or `netlify/functions/billboard-summary.js` (Netlify) exists

### Issue: Shows mock data instead of real data

**Symptom**: API returns data but it's always the same mock numbers

**Solution**: 

1. Verify environment variables are set correctly in deployment:
   - `SUPABASE_URL` 
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Check serverless function logs for errors:
   - Vercel: Project → Deployments → Function Logs
   - Netlify: Site → Functions → Function logs

3. Test the API endpoint directly:
   ```bash
   curl https://your-app.vercel.app/api/billboard-summary
   ```

4. If you see "Missing SUPABASE_URL" errors:
   - Environment variables are not configured
   - Add them in deployment settings (not .env file)

5. If you see Supabase errors:
   - Check table and column names match your schema
   - Verify service role key has read permissions
   - Test query in Supabase SQL editor

6. The frontend will fall back to mock data if:
   - API returns 404 (not deployed)
   - API returns 500 (server error)
   - Network error (offline, timeout)
   This is intentional so GitHub Pages deployment still works

### Issue: CORS errors

**Symptom**: Browser console shows CORS errors

**Solution**:
- CORS headers are included in both Vercel and Netlify functions
- If using custom domain, ensure CORS allows your domain
- Check `Access-Control-Allow-Origin` in function code

### Issue: Stale data

**Symptom**: Data doesn't update for 15+ seconds

**Explanation**: This is by design. The function caches data for 15 seconds to reduce database load.

**To reduce cache time**: Edit `CACHE_TTL_MS` in the serverless function:
```javascript
const CACHE_TTL_MS = 5000; // 5 seconds instead of 15
```

### Issue: Token not working

**Symptom**: "Invalid access token" error

**Solution**:
- Ensure `BILLBOARD_TV_TOKEN` is set in serverless function environment (not frontend)
- Check token value matches exactly (no extra spaces)
- Try without token to verify function works
- Check function logs for token validation messages

## Wiring Real Data

The serverless functions now connect to Supabase to fetch real data from your database.

### Database Schema

The Billboard API queries these tables:

**service_jobs** (Service Tracking):
- `status`: Job status (completed, scheduled, deferred, etc.)
- `job_amount`: Revenue amount
- `job_date`: Date of the job

**delivery_tickets** (Delivery Tracking):
- `qty`: Gallons delivered
- `amount`: Revenue
- `date`: Date of the delivery

### Customizing Queries

If your table or column names differ, update the serverless functions:

**For Vercel:** Edit `api/billboard-summary.js`
**For Netlify:** Edit `netlify/functions/billboard-summary.js`

Look for TODO comments in these files that mark where to update:
- Table names
- Column names
- Status value mappings

### Testing with Real Data

1. Ensure your Supabase tables have data for the current and previous week
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your deployment environment
3. Deploy and visit `/api/billboard-summary` to see the JSON response
4. Visit `/billboard` to see the dashboard with live data

### Troubleshooting Data Issues

If the API returns errors or unexpected data:

1. Check serverless function logs in Vercel/Netlify dashboard
2. Verify table and column names match your schema
3. Ensure service role key has permissions to read the tables
4. Test queries directly in Supabase SQL editor

Common issues:
- **"Missing SUPABASE_URL"**: Environment variables not set in deployment
- **"Failed to fetch service jobs"**: Table doesn't exist or permissions issue
- **Shows mock data**: API is falling back due to errors (check logs)

## Support

For additional help:
- Check function logs in Vercel/Netlify dashboard
- Review browser console for frontend errors
- Verify environment variables are set correctly
- Test API endpoint directly: `curl https://your-app.vercel.app/api/billboard-summary`
