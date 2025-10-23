# Vercel Runtime Config (Billboard API)

This document describes how to enable a runtime override for the Billboard API base URL and TV token so the front-end can be pointed to the Vercel-hosted API after the static site is deployed — without rebuilding.

Files:
- public/runtime-config.js.template — template for the runtime configuration.
  - Copy to `public/runtime-config.js` with real values before (or during) deploy.
  - Example content:

    ```javascript
    (function () {
      window.__ENV = {
        BILLBOARD_API_BASE: "https://kpi-dashboard-seven-eta.vercel.app",
        BILLBOARD_TV_TOKEN: "your-secret-token-here"
      };
    })();
    ```

- scripts/generate-runtime-config.cjs — Node.js script to generate `public/runtime-config.js` from environment variables.
  - Run as a pre-build step to inject runtime config from environment variables.
  - Usage:
    ```bash
    VERCEL_BILLBOARD_API_BASE=https://your-vercel-domain.vercel.app \
    VERCEL_BILLBOARD_TV_TOKEN=yourtoken \
    node scripts/generate-runtime-config.cjs
    ```

## How It Works

1. The template file `public/runtime-config.js.template` contains placeholders for configuration values.
2. The script `scripts/generate-runtime-config.cjs` reads environment variables and generates `public/runtime-config.js`.
3. The generated file is loaded by the HTML page before the main application bundle.
4. The application reads configuration from `window.__ENV` at runtime.

## Environment Variables

The script reads the following environment variables:

- `VERCEL_BILLBOARD_API_BASE` or `BILLBOARD_API_BASE` — Base URL for the Billboard API (no trailing slash)
- `VERCEL_BILLBOARD_TV_TOKEN` or `BILLBOARD_TV_TOKEN` — Optional TV token for TV mode

## Client-Side Usage

In your application code, read the configuration from `window.__ENV`:

```javascript
const apiBase = window.__ENV?.BILLBOARD_API_BASE || 'http://localhost:3000';
const tvToken = window.__ENV?.BILLBOARD_TV_TOKEN || '';
```

The client should prefer the runtime override from `window.__ENV` over any hardcoded or build-time configuration.

## Deployment

### Vercel

1. Add the environment variables to your Vercel project settings:
   - `VERCEL_BILLBOARD_API_BASE`
   - `VERCEL_BILLBOARD_TV_TOKEN` (optional)

2. Add a pre-build script to your `package.json`:
   ```json
   {
     "scripts": {
       "prebuild": "node scripts/generate-runtime-config.cjs",
       "build": "vite build"
     }
   }
   ```

3. Deploy to Vercel as normal. The script will run before the build and generate the config file.

### Manual Deployment

For manual deployments, you can either:

1. Run the script manually before building:
   ```bash
   BILLBOARD_API_BASE=https://your-api.com node scripts/generate-runtime-config.cjs
   npm run build
   ```

2. Copy the template and fill in values manually:
   ```bash
   cp public/runtime-config.js.template public/runtime-config.js
   # Edit public/runtime-config.js and replace placeholders
   npm run build
   ```

## Security Notes

- Never commit `public/runtime-config.js` with real secrets. Add it to `.gitignore`.
- The template file `public/runtime-config.js.template` should be committed.
- Use environment variables for sensitive values like API tokens.
