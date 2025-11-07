# Server Directory

This directory contains server-side components and utilities for the KPI Dashboard.

## Structure

```
server/
├── api/                    # API utilities
├── lib/                    # Shared libraries
├── parser/                 # Data parser service (separate Node app)
└── local_upload_server.js  # Local development upload server (NEW)
```

## local_upload_server.js

Express server for testing server-signed uploads locally during development.

### Prerequisites

The server requires these npm packages:
- `express`
- `cors`
- `@supabase/supabase-js`

### Installation Option 1: Use existing parser dependencies
```bash
cd server/parser
npm ci
cd ..
node local_upload_server.js
```

### Installation Option 2: Install at root level
```bash
# From repository root
npm install express cors @supabase/supabase-js
node server/local_upload_server.js
```

### Installation Option 3: Create server/package.json
```bash
cd server
cat > package.json << 'EOF'
{
  "name": "kpi-upload-server",
  "version": "1.0.0",
  "type": "commonjs",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "@supabase/supabase-js": "^2.45.0"
  }
}
EOF
npm install
node local_upload_server.js
```

### Running the Server

**Set environment variables:**
```bash
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

⚠️ **IMPORTANT:** Never commit `SUPABASE_SERVICE_ROLE_KEY` to version control!

**Start the server:**
```bash
node server/local_upload_server.js
```

**Or with inline environment variables:**
```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
node server/local_upload_server.js
```

The server will start on port 4001 (or PORT environment variable).

### Using the Server

**Configure frontend to use local server:**
```bash
export VITE_UPLOADS_SIGNED_URL=http://localhost:4001/uploads/signed
npm run dev
```

**Or add to .env:**
```
VITE_UPLOADS_SIGNED_URL=http://localhost:4001/uploads/signed
```

**Test endpoint directly:**
```bash
curl -X POST http://localhost:4001/uploads/signed \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test.pdf",
    "contentType": "application/pdf",
    "base64": "JVBERi0xLjQKJe..."
  }'
```

### Endpoints

- `POST /uploads/signed` - Upload files with service role credentials
- `GET /health` - Health check

See `UPLOAD_SERVICE_IMPLEMENTATION.md` for complete documentation.

## parser/

Separate Node.js service for parsing uploaded spreadsheets and CSVs.

See `parser/package.json` and parser documentation for details.

## Production Deployment

⚠️ `local_upload_server.js` is for **local development only**.

For production, use serverless functions:
- Vercel/Netlify: `src/pages/api/uploads/signed.js` (already implemented)
- Other platforms: Deploy equivalent serverless function

Set `SUPABASE_SERVICE_ROLE_KEY` in your deployment platform's environment variables (never commit to code).
