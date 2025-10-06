#!/usr/bin/env bash
set -euo pipefail

# apply_video_migrations.sh
# Usage:
#  - set DATABASE_URL (Postgres connection string) and run: ./scripts/apply_video_migrations.sh
#  - or paste the combined SQL into Supabase SQL editor

COMBINED_SQL="sql/combined_procedure_video_migrations.sql"

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Running combined migration against DATABASE_URL"
  psql "$DATABASE_URL" -f "$COMBINED_SQL"
  echo "Migration applied via psql."
else
  echo "DATABASE_URL not set. Open $COMBINED_SQL and run it in the Supabase SQL editor instead."
fi
