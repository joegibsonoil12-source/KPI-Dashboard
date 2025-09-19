# RLS Implementation Testing Guide

## Overview
This guide explains how to test the Row Level Security (RLS) implementation for the `procedure_videos` table.

## Quick Test
Run the automated test script:
```bash
./test-rls-implementation.sh
```

## Manual Testing Steps

### 1. Apply SQL Migration
Run the SQL migration in your Supabase SQL editor:
```sql
-- Copy and paste the contents of sql/policies/procedure_videos_rls.sql
```

### 2. Environment Setup

**Server Environment Variables:**
```bash
export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

**Client Environment Variables:**
```bash
export VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### 3. Server Setup
Mount the video URL API in your Express server:
```javascript
app.use('/api', require('./server/api/video-url'))
```

### 4. Test Authentication Flow
1. Start the application: `npm run dev`
2. Navigate to the app
3. You should see the authentication page (login required)
4. Sign in with a valid user account

### 5. Test Video Upload with RLS
1. After authentication, navigate to the Procedures tab
2. Try adding a video (both URL and file upload)
3. Verify that:
   - Video inserts include the current user's ID as owner
   - File uploads are cleaned up if database insert fails
   - Only authenticated users can insert videos
   - Users can only see/modify their own videos

### 6. Test Server API
1. Get an access token from your authenticated session
2. Test the video URL endpoint:
```bash
curl -X POST http://localhost:3000/api/video-url \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test-video.mp4", "video_id": "video-uuid"}'
```

## Expected Behavior

### Before RLS Implementation
- ❌ `procedure_videos` inserts fail due to RLS policy violations
- ❌ No ownership tracking
- ❌ No cleanup of failed uploads

### After RLS Implementation
- ✅ `procedure_videos` inserts succeed with proper ownership
- ✅ Storage cleanup on database failures
- ✅ Authenticated API endpoints with ownership validation
- ✅ Users can only access their own videos

## Troubleshooting

### Common Issues
1. **"new row violates row-level security policy"**
   - Ensure the SQL migration has been applied
   - Check that `owner` field is included in inserts

2. **"Authentication required"**
   - Verify environment variables are set
   - Check that user is properly authenticated

3. **"Access denied - you do not own this video"**
   - This is expected behavior when trying to access others' videos
   - Verify the video belongs to the authenticated user

## Files Changed
- `sql/policies/procedure_videos_rls.sql` - Database policies and schema
- `src/tabs/Procedures_v3.jsx` - Frontend with ownership and cleanup
- `server/api/video-url.js` - Server API with authentication
- `test-rls-implementation.sh` - Automated testing script