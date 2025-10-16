# Supabase Troubleshooting Guide

This guide helps diagnose and resolve Supabase configuration and connectivity issues in the KPI Dashboard application.

## How Credentials are Resolved

The Supabase client (`src/lib/supabaseClient.js`) resolves credentials in the following order:

1. **Environment Variables (highest priority)**
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Vite projects)
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Next.js)
   - `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` (Create React App)
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` (server-side fallback)

2. **localStorage Fallback (runtime)**
   - `SUPABASE_URL` from `localStorage`
   - `SUPABASE_ANON_KEY` from `localStorage`
   - Used when environment variables are not available (e.g., GitHub Pages, Netlify)

**Important:** Environment variables always take precedence. The localStorage fallback only applies when env vars are missing.

## Configuring Credentials via UI

If you're deploying to static hosting (GitHub Pages, Netlify, Vercel, etc.) without build-time environment variable injection, you can configure credentials at runtime:

1. **Navigate to the Supabase Settings Panel**
   - The application includes a `SupabaseSettings` component that allows runtime configuration
   - This component is typically available in the Settings or Admin section of the app

2. **Enter Your Credentials**
   - **Supabase URL**: Your project URL (e.g., `https://your-project.supabase.co`)
   - **Anon Key**: Your project's anonymous/public key (safe to expose in client-side code if RLS is properly configured)

3. **Save Settings**
   - Click "Save Settings" to store credentials in browser localStorage
   - These credentials will persist across browser sessions
   - The app will use these credentials if environment variables are not set

4. **Refresh the Page**
   - After saving, refresh the page to initialize the Supabase client with the new credentials
   - The app should now connect to your Supabase project

**Note:** Credentials stored in localStorage are browser-specific. Each user must configure their own credentials unless you deploy with environment variables.

## Quick Connectivity Check

If you're experiencing connection issues, you can run a quick diagnostic check from the browser console:

```javascript
// Open browser DevTools (F12), go to Console tab, and run:

// First, import the modules (if using ES modules)
const { checkSupabaseConnectivity } = await import('/src/lib/healthCheck.js');
const { default: supabase } = await import('/src/lib/supabaseClient.js');

// Run the connectivity check
const result = await checkSupabaseConnectivity(supabase);
console.log(result);
```

**Expected Output:**

```javascript
{
  ok: true,
  user: "user@example.com",  // or user ID, or "anonymous"
  canReadTickets: true,
  errorMessages: [
    "Successfully verified access to delivery_tickets (count: 42)"
  ]
}
```

**If there are problems**, the output will show:
- `ok: false` - Something went wrong
- `errorMessages: [...]` - Specific error messages to help diagnose the issue

## Common Issues and Solutions

### Issue: "Missing Supabase URL or anon key" Warning

**Symptoms:**
- Console warning: `[supabaseClient] Missing Supabase URL or anon key...`
- App fails to load data or authenticate users

**Solutions:**
1. **For Development/Local:**
   - Create a `.env` file in the project root with:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key-here
     ```
   - Restart the dev server (`npm run dev`)

2. **For Production/Static Hosting:**
   - Configure credentials via the Supabase Settings panel (see above)
   - Or set environment variables in your hosting platform's settings

### Issue: Auth Check Fails

**Symptoms:**
- `checkSupabaseConnectivity` returns `user: null` or auth error
- Users cannot sign in

**Solutions:**
1. **Verify URL is correct** - Should end with `.supabase.co` or your custom domain
2. **Check anon key** - Copy from Supabase Dashboard → Settings → API
3. **Check auth configuration** - Ensure auth providers are enabled in Supabase Dashboard
4. **Clear browser data** - Sometimes stale sessions cause issues

### Issue: Cannot Read delivery_tickets

**Symptoms:**
- `canReadTickets: false`
- Error message about RLS policies or permissions

**Solutions:**
1. **Check RLS Policies** - Verify Row Level Security policies on `delivery_tickets` table
   ```sql
   -- Example: Allow users to read their own tickets
   CREATE POLICY "Users can read own tickets"
   ON delivery_tickets
   FOR SELECT
   USING (auth.uid() = created_by);
   ```

2. **Sign in first** - Many operations require authentication
3. **Verify table exists** - Check that `delivery_tickets` table is created in your Supabase project
4. **Check database connection** - Ensure your Supabase project is active (not paused)

### Issue: Data Shows in Supabase but Not in App

**Symptoms:**
- Data visible in Supabase SQL Editor
- App shows empty state or "No tickets" message

**Possible Causes:**
1. **RLS Policies** - User doesn't have permission to read the data
2. **Wrong credentials** - App connected to different project or using outdated keys
3. **Filters applied** - App might be filtering out all data (check date/truck filters)

**Solutions:**
1. Check RLS policies allow the current user to read data
2. Verify credentials in localStorage match your project
3. Reset filters to "All" to see all data
4. Check browser console for error messages

## Testing RLS Policies

If you're having permission issues, test your RLS policies in the Supabase SQL Editor:

```sql
-- Test as the authenticated user
SELECT * FROM delivery_tickets 
WHERE created_by = auth.uid()
LIMIT 10;

-- Check RLS policies
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'delivery_tickets';
```

## Additional Resources

- **Database Schema & Setup**: See [DeliveryTickets_Setup.md](./DeliveryTickets_Setup.md)
- **Supabase Documentation**: [https://supabase.com/docs](https://supabase.com/docs)
- **RLS Policy Examples**: [https://supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security)

## Getting Help

If you've tried the above steps and still have issues:

1. **Check browser console** - Look for specific error messages
2. **Check Supabase Dashboard** - Look at Logs for API errors
3. **Run connectivity check** - Use `checkSupabaseConnectivity()` to get detailed diagnostics
4. **Verify credentials** - Double-check your URL and anon key are correct
5. **Check RLS policies** - Ensure your user has permission to access the data

Remember: The anon key is safe to expose in client-side code as long as your RLS policies are properly configured to restrict access.
