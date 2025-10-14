# GitHub Copilot Agent Guidelines

This file provides guidance for GitHub Copilot agents working on this repository.

## Build Instructions

### Standard Build Process
```bash
npm ci && npm run build
```

### Local Development
```bash
npm install
npm run dev
```

### Environment Variables
Ensure these variables are set (via `.env.local` or environment):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous/public key

**NEVER** commit service role keys or secrets to the repository.

## SQL Migration Conventions

### File Naming
SQL migrations should follow this pattern:
```
sql/YYYY-MM-DD_description.sql
```

Example: `sql/2025-10-16_safe_roles_permissions_extension.sql`

### Safety Requirements

#### Idempotency
All migrations MUST be idempotent (safe to run multiple times):
- Use `CREATE TABLE IF NOT EXISTS`
- Use `CREATE EXTENSION IF NOT EXISTS`
- Use `CREATE INDEX IF NOT EXISTS`
- Use `CREATE OR REPLACE` for functions and views
- Use `ON CONFLICT DO NOTHING` for seed data
- Wrap policy creation in `DO $$` blocks that check `pg_policies`
- Wrap trigger creation in `DO $$` blocks that check `pg_trigger`

#### Additive Only
- **NO** destructive DDL operations
- **NO** `DROP TABLE` or `TRUNCATE` on existing user data tables
- **NO** `ALTER TABLE ... DROP COLUMN`
- **NO** changing existing column types that could cause data loss
- Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for new columns
- Use `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (idempotent, non-destructive)

#### RLS Policy Creation
Policies must be created conditionally to avoid errors on re-run:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'your_table' 
      AND policyname = 'your_policy_name'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY your_policy_name
        ON public.your_table
        FOR SELECT
        TO authenticated
        USING (true);
    $sql$;
  END IF;
END$$;
```

#### Trigger Creation
Triggers must be created conditionally:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'your_trigger_name' 
    AND tgrelid = 'public.your_table'::regclass
  ) THEN
    CREATE TRIGGER your_trigger_name
      AFTER INSERT ON public.your_table
      FOR EACH ROW
      EXECUTE FUNCTION your_function();
  END IF;
END$$;
```

## Code Style

### JavaScript/React
- Use ES6+ syntax
- Prefer named exports for utilities
- Default exports for React components
- Use the existing Supabase client from `src/lib/supabaseClient.js`
- Handle errors gracefully with try/catch
- Avoid committing console.log statements (except for warnings/errors)

### SQL
- Use explicit schema names: `public.table_name`
- Include comments for major sections
- Use `SECURITY DEFINER` for functions that need elevated privileges
- Always specify `LANGUAGE plpgsql` for PL/pgSQL functions
- Use `timestamptz` instead of `timestamp` for timezone awareness

## Testing

### Before Submitting Changes
1. Run `npm run build` to ensure no build errors
2. Check for console errors in the browser (if UI changes)
3. Verify SQL migrations are idempotent (can run multiple times)
4. Test RLS policies work as expected with different user roles

## Common Patterns

### Fetching Data with Supabase
```javascript
import { supabase } from './supabaseClient';

export async function fetchData() {
  const { data, error } = await supabase
    .from('your_table')
    .select('*');
  
  if (error) throw error;
  return data || [];
}
```

### Creating Views
```sql
CREATE OR REPLACE VIEW public.your_view AS
SELECT 
  -- your columns
FROM public.your_table;
```

### Creating Functions
```sql
CREATE OR REPLACE FUNCTION public.your_function()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- your logic
  RETURN jsonb_build_object('key', 'value');
END;
$$;
```

## Troubleshooting

### Build Failures
- Check for syntax errors in JavaScript files
- Ensure all imports are correct
- Verify `package.json` has all required dependencies

### RLS Policy Conflicts
- Check for duplicate policy names in `pg_policies`
- Ensure policies are created conditionally
- Test policies with different user roles

### Migration Errors
- Verify the table/function/trigger doesn't already exist
- Check for proper idempotency guards
- Test migration on a clean database first

## Repository Structure

```
├── sql/                    # Database migrations
├── src/
│   ├── components/        # React components
│   ├── lib/              # Utility modules and API helpers
│   └── App.jsx           # Main application component
├── public/               # Static assets
├── package.json          # Dependencies and scripts
└── vite.config.js        # Vite configuration
```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
