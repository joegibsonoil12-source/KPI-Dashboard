# Delivery Tickets Setup and Configuration

This document describes the database schema, storage configuration, and environment setup for the Delivery Tickets feature.

## Database Schema

### delivery_tickets Table

The main table storing delivery ticket information with the following columns:

**Core Fields:**
- `id` - Primary key (UUID)
- `created_by` - User ID who created the ticket (UUID, FK to auth.users)
- `date` - Delivery date (date)
- `driver` - Driver name (text)
- `truck` - Truck identifier (text)
- `truck_id` - Legacy truck identifier (text)
- `ticket_id` - External ticket reference (text)
- `customerName` - Customer name (text)
- `account` - Account identifier (text)
- `status` - Ticket status: 'draft' or 'posted' (text)
- `notes` - Additional notes (text)

**Quantity and Pricing:**
- `qty` - Quantity ordered (numeric)
- `price` - Unit price (numeric)
- `tax` - Tax amount (numeric)
- `hazmat_fee` - Hazardous material fee (numeric)
- `amount` - Total amount (qty * price + tax + hazmat_fee) (numeric)
- `gallons` - Legacy gallons field (numeric)
- `gallons_delivered` - Actual gallons delivered (numeric)

**Scheduling and Timing:**
- `scheduled_window_start` - Scheduled arrival time (timestamptz)
- `arrival_time` - Actual arrival time (timestamptz)
- `departure_time` - Departure time (timestamptz)
- `on_time_flag` - On-time indicator: 1 (on-time), 0 (late), null (not calculated) (integer)

**Odometer and Mileage:**
- `odometer_start` - Starting odometer reading (numeric)
- `odometer_end` - Ending odometer reading (numeric)
- `miles_driven` - Calculated miles (odometer_end - odometer_start) (numeric)

**Timestamps:**
- `created_at` - Record creation timestamp (timestamptz, default: now())
- `updated_at` - Record update timestamp (timestamptz, default: now())

### ticket_attachments Table

Stores metadata for file attachments associated with tickets:

- `id` - Primary key (UUID)
- `ticket_id` - FK to delivery_tickets.id (UUID)
- `storage_key` - Path in storage bucket (text)
- `filename` - Original filename (text)
- `content_type` - MIME type (text)
- `size` - File size in bytes (integer)
- `uploaded_by` - User ID who uploaded (UUID, FK to auth.users)
- `uploaded_at` - Upload timestamp (timestamptz, default: now())

**RLS Policies:**
- Users can only read/insert attachments for tickets they created
- Policy checks that the ticket's created_by matches auth.uid()
- **Admin/Manager Delete:** Users with 'admin' or 'manager' role in app_roles can delete ANY ticket and its attachments, even if they didn't create them

## Row-Level Security (RLS) Policies

Both `delivery_tickets` and `ticket_attachments` tables have RLS enabled to control data access based on user authentication and role.

### delivery_tickets Policies

**SELECT (Read):**
- All authenticated users can view all tickets
- Policy: `delivery_tickets_select_authenticated`

**INSERT (Create):**
- Authenticated users can create tickets with their own user ID as `created_by`
- Policy: `delivery_tickets_insert_authenticated`

**UPDATE (Modify):**
- Ticket owner can update their own tickets
- Policy: `delivery_tickets_update_owner`

**DELETE (Remove):**
- Ticket owner can delete their own tickets
- Policy: `delivery_tickets_delete_owner`
- **Admin/Manager can delete ANY ticket**
- Policy: `delivery_tickets_delete_admin` (checks app_roles for admin/manager role)

### ticket_attachments Policies

**SELECT (Read):**
- All authenticated users can view all attachments
- Policy: `ticket_attachments_select_authenticated`

**INSERT (Create):**
- Authenticated users can upload attachments with their own user ID as `uploaded_by`
- Policy: `ticket_attachments_insert_authenticated`

**UPDATE (Modify):**
- Attachment uploader can update their own attachments
- Policy: `ticket_attachments_update_owner`

**DELETE (Remove):**
- Attachment uploader can delete their own attachments
- Policy: `ticket_attachments_delete_owner`
- **Admin/Manager can delete ANY attachment**
- Policy: `ticket_attachments_delete_admin` (checks app_roles for admin/manager role)

**Note on CASCADE Delete:**
The admin/manager delete policy on `ticket_attachments` is essential for allowing CASCADE delete to work properly when an admin/manager deletes a ticket. Without it, RLS would block the automatic deletion of child attachments even though the foreign key constraint specifies `ON DELETE CASCADE`.

## Storage Configuration

### private-attachments Bucket

A private storage bucket for ticket attachments:

**Configuration:**
- Bucket name: \`private-attachments\`
- Public access: Disabled
- File size limit: As configured in Supabase project settings

**Storage Policies:**
- Users can upload files to paths matching \`tickets/{ticketId}/*\` where they own the ticket
- Users can read files from paths matching \`tickets/{ticketId}/*\` where they own the ticket
- Signed URLs are used for downloads (10-minute expiration by default)

**File Path Convention:**
\`\`\`
tickets/{ticketId}/{timestamp}-{filename}
\`\`\`

Example: \`tickets/a1b2c3d4-e5f6/1634567890123-invoice.pdf\`

## Environment Variables

The application requires the following environment variables (typically in \`.env\` or configured in deployment):

\`\`\`bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
\`\`\`

**Note:** These are public/client-side keys. The anon key has limited permissions controlled by RLS.

## Verification Queries

### Check ticket count and basic stats:
\`\`\`sql
SELECT 
  COUNT(*) as total_tickets,
  COUNT(DISTINCT truck) as unique_trucks,
  SUM(gallons_delivered) as total_gallons,
  SUM(amount) as total_amount
FROM delivery_tickets;
\`\`\`

### Check attachments setup:
\`\`\`sql
SELECT 
  dt.id as ticket_id,
  dt.customerName,
  COUNT(ta.id) as attachment_count
FROM delivery_tickets dt
LEFT JOIN ticket_attachments ta ON ta.ticket_id = dt.id
GROUP BY dt.id, dt.customerName
ORDER BY attachment_count DESC
LIMIT 10;
\`\`\`

### Check RLS policies are active:
\`\`\`sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('delivery_tickets', 'ticket_attachments');
\`\`\`

### Verify on-time calculations:
\`\`\`sql
SELECT 
  id,
  truck,
  scheduled_window_start,
  arrival_time,
  on_time_flag,
  CASE 
    WHEN on_time_flag = 1 THEN 'On Time'
    WHEN on_time_flag = 0 THEN 'Late'
    ELSE 'Not Calculated'
  END as status
FROM delivery_tickets
WHERE scheduled_window_start IS NOT NULL
  AND arrival_time IS NOT NULL
ORDER BY date DESC
LIMIT 10;
\`\`\`

## Deployment to GitHub Pages

After making code changes:

1. **Ensure environment variables are configured** in your deployment environment (GitHub Secrets for Pages)

2. **Build the application:**
   \`\`\`bash
   npm run build
   \`\`\`

3. **Deploy to GitHub Pages** (if using GitHub Actions):
   - Push changes to the main/deployment branch
   - GitHub Actions workflow will automatically build and deploy
   - Verify deployment at your GitHub Pages URL

4. **Manual deployment alternative:**
   \`\`\`bash
   npm run build
   # Copy dist/ contents to deployment location
   \`\`\`

## Troubleshooting

### Attachments not loading
- Check storage bucket policies in Supabase dashboard
- Verify RLS policies on ticket_attachments table
- Check browser console for specific error messages

### Date/time shifts
- Verify datetime helpers are being used (toLocalDateTimeInputValue/fromLocalDateTimeInputValue)
- Check that database columns are timestamptz (not timestamp)
- Browser timezone should be automatically detected

### Metrics calculations seem wrong
- Verify gallons_delivered is populated (falls back to qty if not)
- Check that on_time_flag is computed correctly (scheduled + 5min grace vs arrival)
- Ensure miles_driven is calculated from valid odometer_start/odometer_end

## Feature Usage

### Auto-calculations
- **Amount:** Automatically computed as \`qty * price + tax + hazmat_fee\` when any of these fields change
- **Miles Driven:** Computed as \`odometer_end - odometer_start\` when either odometer value changes
- **On-Time Flag:** Set to 1 if arrival_time ≤ scheduled_window_start + 5 minutes, else 0

### Filtering
- Date filters apply to the \`date\` field
- Truck selector applies to coalesced truck identifier (truck || truck_id || "Unassigned")
- Charts and metrics reflect the currently filtered dataset

### Export
- CSV export includes visible columns with headers
- Excel export creates a workbook with a "Tickets" sheet
- Both exports honor date and truck filters
