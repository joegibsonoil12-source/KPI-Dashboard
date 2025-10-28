````markdown name=migrations/README.md
# Migrations & Data cleanup — review notes

This folder contains SQL files to create aggregate views and safely populate missing job_amount values.

Important:
- Run `migrations/001_create_metrics_views.sql` in Supabase SQL Editor to create the daily/weekly/monthly views.
- Run the PREVIEW query in `migrations/002_populate_job_amounts_from_raw.sql` before applying the update. Inspect `parsed_amount` values.
- The safe update only writes positive parsed amounts and logs changes to `migrations.job_amount_update_log`.
- After applying migrations, re-run view vs base aggregation verification queries (see PR description).

If you need help applying these via the Supabase SQL Editor or want me to generate a runnable migration file for your migration tool, say so and I will prepare it.