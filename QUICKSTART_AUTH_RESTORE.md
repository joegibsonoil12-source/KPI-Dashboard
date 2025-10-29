# Quick Start: Restore Auth & Create Admin User

## 🚨 IMMEDIATE ACTION REQUIRED

Your Supabase project is experiencing 500 errors because the `auth.identities` table is missing. Follow these steps to fix it:

## Step 1: Apply the Migration (Choose One Method)

### Method A: Via Supabase Dashboard (EASIEST - Do This First!)

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql

2. **Run the Migration**
   - Click "New Query"
   - Copy the entire contents of `sql/2025-10-29_restore_auth_identities.sql`
   - Paste into the editor
   - Click **"RUN"** button
   - Wait for success message: `status: ok, identities_count: 0`

### Method B: Via GitHub Actions Workflow

1. **Go to GitHub Actions**
   - Navigate to: https://github.com/joegibsonoil12-source/KPI-Dashboard/actions/workflows/apply-supabase-migrations.yml

2. **Run the Workflow**
   - Click "Run workflow" dropdown
   - In the "migration_file" input, enter: `sql/2025-10-29_restore_auth_identities.sql`
   - Click "Run workflow" button
   - Wait for the workflow to complete (green checkmark)

**Note:** This method requires the `SUPABASE_DB_URL` secret to be configured in your repository settings.

### Method C: Via Supabase CLI (If you have CLI installed)

```bash
# In your local repository
cd /path/to/KPI-Dashboard

# Link to your project (if not already)
supabase link --project-ref jskajkwulaaakhaolzdu

# Apply the migration
supabase db execute --file sql/2025-10-29_restore_auth_identities.sql
```

## Step 2: Create Your Admin User

After the migration is applied, create your admin user using the Supabase Admin API:

### Get Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/settings/api
2. Find the **"service_role"** key (this is a secret - don't share it!)
3. Copy the key

### Create Admin User via cURL

Replace `<YOUR_SERVICE_ROLE_KEY>`, `<YOUR_EMAIL>`, and `<YOUR_PASSWORD>` with your actual values:

```bash
curl -X POST 'https://jskajkwulaaakhaolzdu.supabase.co/auth/v1/admin/users' \
  -H "apikey: <YOUR_SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <YOUR_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "<YOUR_EMAIL>",
    "password": "<YOUR_PASSWORD>",
    "email_confirm": true,
    "user_metadata": {
      "role": "admin",
      "full_name": "Site Owner"
    }
  }'
```

**Windows PowerShell version:**
```powershell
$headers = @{
    "apikey" = "<YOUR_SERVICE_ROLE_KEY>"
    "Authorization" = "Bearer <YOUR_SERVICE_ROLE_KEY>"
    "Content-Type" = "application/json"
}

$body = @{
    email = "<YOUR_EMAIL>"
    password = "<YOUR_PASSWORD>"
    email_confirm = $true
    user_metadata = @{
        role = "admin"
        full_name = "Site Owner"
    }
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://jskajkwulaaakhaolzdu.supabase.co/auth/v1/admin/users" -Headers $headers -Body $body
```

## Step 3: Grant Admin Privileges in the App

After creating your user, grant admin role in the KPI Dashboard:

1. **Open Supabase SQL Editor**
   - https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/sql

2. **Run this SQL** (replace with your actual email):
```sql
INSERT INTO public.app_roles (user_id, role, created_at, updated_at)
SELECT 
  id, 
  'admin', 
  now(), 
  now()
FROM auth.users
WHERE email = '<YOUR_EMAIL>'
ON CONFLICT (user_id) DO UPDATE 
SET role = 'admin', updated_at = now();
```

## Step 4: Verify Everything Works

1. **Check the user was created:**
```sql
SELECT 
  u.id,
  u.email,
  u.created_at,
  ar.role
FROM auth.users u
LEFT JOIN public.app_roles ar ON u.id = ar.user_id
WHERE u.email = '<YOUR_EMAIL>';
```

2. **Try logging into your application**
   - Use the email and password you just created
   - You should now have admin access!

## Troubleshooting

### Still getting 500 errors?

1. **Verify the migration ran successfully:**
```sql
SELECT COUNT(*) FROM auth.identities;
```
Should return `0` or more (not an error).

2. **Check if auth.identities table exists:**
```sql
SELECT * FROM information_schema.tables 
WHERE table_schema = 'auth' AND table_name = 'identities';
```
Should return 1 row.

3. **Check table structure:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'identities';
```

### Can't create user via API?

- Double-check your service_role key is correct
- Verify the URL is correct: `https://jskajkwulaaakhaolzdu.supabase.co`
- Make sure you're using HTTPS (not HTTP)
- Check Supabase logs for errors: https://supabase.com/dashboard/project/jskajkwulaaakhaolzdu/logs

## Additional Documentation

For complete details, see:
- **Full Instructions:** `docs/SUPABASE_AUTH_RESTORE_INSTRUCTIONS.md`
- **User Creation Examples:** `sql/2025-10-29_add_user_example.sql`
- **Migration File:** `sql/2025-10-29_restore_auth_identities.sql`

## Need Help?

If you're still having issues:
1. Check the Supabase Dashboard logs
2. Review the full documentation in `docs/SUPABASE_AUTH_RESTORE_INSTRUCTIONS.md`
3. Contact Supabase support with project ref: `jskajkwulaaakhaolzdu`

---

**TL;DR:**
1. Run `sql/2025-10-29_restore_auth_identities.sql` in Supabase SQL Editor
2. Use the cURL command above (with your service_role key) to create your admin user
3. Run the app_roles SQL to grant admin privileges
4. Done! ✅
