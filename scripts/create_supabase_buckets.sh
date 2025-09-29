#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   export SUPABASE_URL="https://<project>.supabase.co"
#   export SUPABASE_SERVICE_ROLE_KEY="<your service role key>"
#   ./scripts/create_supabase_buckets.sh
#
# This script creates a public 'videos' bucket (id: videos). Modify BUCKET_ID/Bucket_NAME as desired.
#
# WARNING: keep SUPABASE_SERVICE_ROLE_KEY secret (do not commit it).

SUPABASE_URL="${SUPABASE_URL:-}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  echo "Example:"
  echo "  export SUPABASE_URL='https://abcd1234.supabase.co'"
  echo "  export SUPABASE_SERVICE_ROLE_KEY='<service_role_key>'"
  exit 1
fi

# Bucket config
BUCKET_ID="videos"
BUCKET_NAME="Videos"
PUBLIC=true   # set to false if you want private bucket and will use signed URLs

echo "Creating bucket '$BUCKET_ID' (public=$PUBLIC) on $SUPABASE_URL ..."

# Create bucket via Supabase Storage API
resp=$(curl -sS -X POST "${SUPABASE_URL}/storage/v1/bucket" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"${BUCKET_ID}\",\"name\":\"${BUCKET_NAME}\",\"public\":${PUBLIC}}")

echo "Response:"
echo "$resp" | jq || echo "$resp"

if echo "$resp" | jq -e 'has("id")' >/dev/null 2>&1; then
  echo "Bucket created (or already exists)."
else
  # If bucket exists, the API may return an error; attempt to continue.
  echo "Bucket creation response did not contain id. Inspect response above. Continuing..."
fi

# Create procedure-attachments bucket
ATTACHMENT_BUCKET_ID="procedure-attachments"
ATTACHMENT_BUCKET_NAME="Procedure Attachments"

echo
echo "Creating bucket '$ATTACHMENT_BUCKET_ID' (public=$PUBLIC) on $SUPABASE_URL ..."

resp2=$(curl -sS -X POST "${SUPABASE_URL}/storage/v1/bucket" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"${ATTACHMENT_BUCKET_ID}\",\"name\":\"${ATTACHMENT_BUCKET_NAME}\",\"public\":${PUBLIC}}")

echo "Response:"
echo "$resp2" | jq || echo "$resp2"

if echo "$resp2" | jq -e 'has("id")' >/dev/null 2>&1; then
  echo "Attachment bucket created (or already exists)."
else
  echo "Attachment bucket creation response did not contain id. Inspect response above. Continuing..."
fi

echo
echo "If your buckets are public you can now compose URLs like:"
echo "  https://<your-project-ref>.supabase.co/storage/v1/object/public/${BUCKET_ID}/<object_path>"
echo "  https://<your-project-ref>.supabase.co/storage/v1/object/public/${ATTACHMENT_BUCKET_ID}/<object_path>"
echo
echo "Next steps:"
echo "  1) Update storage_settings.project_url in the DB (run the SQL migration), e.g.:"
echo "       SELECT public.set_storage_settings('https://<your-project-ref>.supabase.co', 'videos', 3600);"
echo "  2) Upload test video (mp4 recommended), then verify the view public.procedures_with_video_urls shows playable URL."
echo "  3) Upload test attachments (images/files) to verify procedure_attachments functionality."