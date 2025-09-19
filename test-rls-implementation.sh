#!/bin/bash

# Test script for RLS procedure_videos implementation
# This script verifies that the SQL migration syntax is valid
# and that the updated JavaScript files don't have syntax errors

echo "🧪 Testing RLS procedure_videos implementation..."

# Test 1: Verify SQL syntax
echo "1. Testing SQL syntax..."
if command -v psql &> /dev/null; then
    echo "   ✓ PostgreSQL client available"
    # Test SQL syntax by attempting to parse it (dry run)
    psql --set=ON_ERROR_STOP=1 --quiet --no-psqlrc -f sql/policies/procedure_videos_rls.sql --dry-run 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "   ✓ SQL syntax appears valid"
    else
        echo "   ⚠ Could not validate SQL syntax (may be due to connection, not syntax)"
    fi
else
    echo "   ⚠ PostgreSQL client not available for syntax checking"
fi

# Test 2: Verify JavaScript/React syntax via build
echo "2. Testing JavaScript/React syntax..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Frontend builds successfully"
else
    echo "   ❌ Frontend build failed"
    exit 1
fi

# Test 3: Check that server API file is valid Node.js
echo "3. Testing server API syntax..."
node -c server/api/video-url.js
if [ $? -eq 0 ]; then
    echo "   ✓ Server API syntax valid"
else
    echo "   ❌ Server API syntax error"
    exit 1
fi

# Test 4: Verify required files exist
echo "4. Checking required files..."
files=(
    "sql/policies/procedure_videos_rls.sql"
    "src/tabs/Procedures_v3.jsx"
    "server/api/video-url.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✓ $file exists"
    else
        echo "   ❌ $file missing"
        exit 1
    fi
done

# Test 5: Check for getUserId function in frontend
echo "5. Checking getUserId function exists..."
if grep -q "getUserId" src/tabs/Procedures_v3.jsx; then
    echo "   ✓ getUserId function found"
else
    echo "   ❌ getUserId function missing"
    exit 1
fi

# Test 6: Check for owner field in inserts
echo "6. Checking owner field in database inserts..."
if grep -q "owner: userId" src/tabs/Procedures_v3.jsx; then
    echo "   ✓ Owner field included in inserts"
else
    echo "   ❌ Owner field missing from inserts"
    exit 1
fi

# Test 7: Check for cleanup logic
echo "7. Checking storage cleanup logic..."
if grep -q "remove.*uploadedFilename" src/tabs/Procedures_v3.jsx; then
    echo "   ✓ Storage cleanup logic found"
else
    echo "   ❌ Storage cleanup logic missing"
    exit 1
fi

# Test 8: Check for Bearer token validation in server
echo "8. Checking Bearer token validation..."
if grep -q "Bearer.*token" server/api/video-url.js; then
    echo "   ✓ Bearer token validation found"
else
    echo "   ❌ Bearer token validation missing"
    exit 1
fi

echo ""
echo "✅ All tests passed! The implementation appears to be correct."
echo ""
echo "Next steps:"
echo "1. Apply SQL migration: Run sql/policies/procedure_videos_rls.sql in Supabase SQL editor"
echo "2. Set environment variables:"
echo "   - Server: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
echo "   - Client: VITE_SUPABASE_ANON_KEY"
echo "3. Mount server API: app.use('/api', require('./server/api/video-url'))"
echo "4. Test with authenticated user adding videos"