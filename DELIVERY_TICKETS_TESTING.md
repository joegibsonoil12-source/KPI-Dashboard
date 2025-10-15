# Delivery Tickets - Manual Testing Guide

## Purpose
This guide provides step-by-step instructions for manual smoke testing of the Delivery Tickets feature after deployment.

## Prerequisites
- Application deployed and accessible
- Supabase credentials configured (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- User account created and authenticated
- Access to browser developer tools (for debugging if needed)

## Test Scenarios

### 1. Add Blank Ticket (No Error)
**Expected:** Ticket is created with null/blank values for numeric fields

**Steps:**
1. Navigate to Delivery Tickets tab
2. Click "Add ticket" button
3. Verify:
   - No error alert appears
   - New row appears at top of table
   - Date field is pre-populated with today's date
   - All numeric fields (Qty, Price, Tax, Amount, Gallons) are blank/empty, not "0"
   - Status is "draft"

**Pass Criteria:** ✅ No errors, ticket created with blank numerics

---

### 2. Edit Numeric Fields - Amount Auto-Calculation
**Expected:** Amount recalculates automatically when Qty, Price, Tax, or Hazmat Fee changes

**Steps:**
1. Select any ticket row
2. Enter Qty = 100
3. Enter Price = 2.50
4. Enter Tax = 5.00
5. Verify Amount field shows: $255.00 (100 * 2.50 + 5.00)
6. Change Qty to 50
7. Verify Amount updates to: $130.00 (50 * 2.50 + 5.00)
8. Clear Tax field (leave blank)
9. Verify Amount updates to: $125.00 (50 * 2.50 + 0)

**Pass Criteria:** ✅ Amount auto-calculates correctly, including when fields are blank

---

### 3. Hazmat Fee Field - Integrated with Amount Calculation
**Expected:** Hazmat Fee edits update local state, autosave, and amount calculation

**Steps:**
1. Select any ticket row with existing Qty and Price (e.g., Qty=100, Price=2.50)
2. Enter Hazmat Fee = 10.00
3. Verify:
   - Hazmat Fee appears immediately in UI
   - Amount recalculates to include hazmat fee: $260.00 (100 * 2.50 + 0 + 10.00)
   - SaveBar appears showing "Unsaved changes"
4. Wait 2-3 seconds for autosave
5. Verify SaveBar shows "✓ Saved at HH:MM:SS"
6. Refresh the page
7. Verify Hazmat Fee persists: 10.00
8. Change Hazmat Fee to 15.00
9. Verify Amount updates to: $265.00 (100 * 2.50 + 0 + 15.00)
10. Clear Hazmat Fee field (leave blank)
11. Verify Amount updates to: $250.00 (100 * 2.50 + 0 + 0)
12. Click "Save" button on SaveBar
13. Verify changes save immediately
14. Export CSV
15. Open CSV and verify "hazmat_fee" column exists after "tax" column
16. Export Excel
17. Open Excel and verify "Hazmat Fee" column exists after "Tax" column

**Pass Criteria:** ✅ Hazmat Fee integrates with autosave, manual save, amount calculation, refresh resilience, and exports

---

### 4. Datetime Fields - No Timezone Shift
**Expected:** Local time entered is what displays (UTC conversion handled internally)

**Steps:**
1. Select any ticket row
2. Click on Scheduled field
3. Enter: Today's date at 2:30 PM local time
4. Tab out or click elsewhere
5. Click back into Scheduled field
6. Verify time still shows 2:30 PM (not shifted to different hour)
7. Repeat for Arrival and Departure fields

**Pass Criteria:** ✅ No visible timezone shifts when editing datetime fields

---

### 5. Odometer and Miles Calculation
**Expected:** Miles driven calculates from odometer readings

**Steps:**
1. Select any ticket row
2. Enter Odometer Start = 1000
3. Enter Odometer End = 1050
4. Verify Miles column shows: 50.0
5. Change Odometer End to 1025
6. Verify Miles column updates to: 25.0
7. Clear Odometer Start field
8. Verify Miles column shows: "-" (null/not calculated)

**Pass Criteria:** ✅ Miles calculated correctly, null when incomplete

---

### 6. On-Time Flag Calculation
**Expected:** On-time status based on 5-minute grace period

**Steps:**
1. Select any ticket row
2. Set Scheduled = Today at 10:00 AM
3. Set Arrival = Today at 10:03 AM (within 5-min grace)
4. Verify On-Time column shows: ✅ (green checkmark)
5. Change Arrival = Today at 10:08 AM (beyond 5-min grace)
6. Verify On-Time column shows: ⏱️ (clock emoji for late)
7. Clear Scheduled field
8. Verify On-Time column shows: "-" (null/not calculated)

**Pass Criteria:** ✅ On-time flag correct, null when incomplete

---

### 7. Date Filters
**Expected:** Table filters by selected date range

**Steps:**
1. Note total ticket count displayed
2. Click "Today" filter
3. Verify: Only tickets with today's date show
4. Click "This Week" filter
5. Verify: Tickets from current week show
6. Click "This Month" filter
7. Verify: Tickets from current month show
8. Click "This Year" filter
9. Verify: Tickets from current year show
10. Click "Custom Range"
11. Enter Start Date: One week ago
12. Enter End Date: Today
13. Verify: Only tickets in that range show
14. Click "All" to reset

**Pass Criteria:** ✅ Each filter correctly scopes tickets

---

### 8. Truck Selector
**Expected:** Metrics and table filter by selected truck

**Steps:**
1. Ensure "All Trucks" is selected
2. Note the Overall Metrics values
3. Note the number of rows in table
4. Open Truck dropdown
5. Select a specific truck (e.g., "Truck 1")
6. Verify:
   - Overall Metrics update to show only that truck's stats
   - Table shows only rows for that truck
   - Row count matches metric's "Tickets" value
7. Per-Truck Breakdown table should only show when "All Trucks" selected

**Pass Criteria:** ✅ Truck filter works, metrics update accordingly

---

### 9. Per-Truck Breakdown Table
**Expected:** Shows summary metrics for each truck

**Steps:**
1. Select "All Trucks" in truck dropdown
2. Apply a date filter (e.g., "This Month")
3. Scroll to "Per-Truck Breakdown" section
4. Verify:
   - Table lists each truck that has tickets in date range
   - Columns: Truck, Tickets, Gallons, Revenue, Avg $/Gal, On-Time %
   - Values are reasonable (no NaN, no negative numbers)
   - Trucks sorted by revenue (descending)
5. Select a specific truck from dropdown
6. Verify Per-Truck Breakdown table is hidden

**Pass Criteria:** ✅ Breakdown shows correct per-truck stats

---

### 10. CSV Export
**Expected:** Downloads CSV file with filtered tickets

**Steps:**
1. Apply date filter (e.g., "This Week")
2. Select a specific truck (optional)
3. Click "Export CSV" button
4. Verify:
   - CSV file downloads (check Downloads folder)
   - Filename includes filter info: `delivery-tickets-{filter}-{truck}-{date}.csv`
   - Open CSV in text editor or Excel
   - Headers: date, truck, driver, ticket_id, customerName, gallons_delivered, account, qty, price, tax, hazmat_fee, amount, status
   - Data rows match visible filtered tickets

**Pass Criteria:** ✅ CSV exports with correct headers and filtered data

---

### 11. Excel Export
**Expected:** Downloads XLSX file with filtered tickets

**Steps:**
1. Apply date filter (e.g., "This Month")
2. Select a specific truck (optional)
3. Click "Export Excel" button
4. Verify:
   - XLSX file downloads
   - Filename includes filter info: `delivery-tickets-{filter}-{truck}-{date}.xlsx`
   - Open in Excel or compatible app
   - Sheet named "Tickets"
   - Headers: Date, Truck, Driver, Ticket ID, Customer, Gallons Delivered, Account, Qty, Price, Tax, Hazmat Fee, Amount, Status
   - Data rows match visible filtered tickets

**Pass Criteria:** ✅ Excel exports with Tickets sheet and filtered data

---

### 12. Charts - Gallons and Revenue
**Expected:** Line charts show daily trends for filtered period

**Steps:**
1. Apply "This Month" date filter
2. Scroll to "Analytics" section
3. Verify:
   - "Gallons Delivered by Day" chart visible
   - X-axis shows dates from current month
   - Y-axis shows gallon amounts
   - Blue line connects data points
   - "Revenue by Day" chart visible below
   - X-axis shows dates from current month
   - Y-axis shows dollar amounts
   - Green line connects data points
   - Hovering over points shows tooltip with exact values
4. Change date filter to "This Week"
5. Verify charts update to show only last 7 days
6. Select a specific truck
7. Verify charts update to show only that truck's data

**Pass Criteria:** ✅ Charts render, update with filters, show correct data

---

### 13. Responsive Layout
**Expected:** Table adapts to screen size without horizontal scrollbar on typical screens

**Steps:**
1. Open browser developer tools (F12)
2. Toggle device emulation / responsive mode
3. Test at different widths:
   - Mobile (375px): Should show Date, Truck, Customer, Gallons, Qty, Price, Amount, Remove
   - Tablet (768px): Should add Driver, Account, Tax, Hazmat
   - Desktop (1024px): Should add TicketID, Status
   - Large Desktop (1280px): Should add On-Time, Files
   - Extra Large (1536px): Should show all columns including datetime and odometer fields
4. Verify no horizontal scrollbar appears at each breakpoint (some scroll may occur at very narrow widths < 375px)
5. Verify column alignment stays consistent

**Pass Criteria:** ✅ Layout responsive, minimal/no horizontal scroll

---

### 14. Attachment Upload and View
**Expected:** Can upload files and download via signed URL

**Steps:**
1. Select any ticket row
2. Click "📎" button in Files column (visible on xl+ screens)
3. Select a file to upload (e.g., PDF, image)
4. Wait for "Attachment uploaded" alert
5. Verify Files column now shows "(1)" count
6. Note: To view attachment, would need to click on file link (opens in new tab via signed URL)
   - This requires proper storage policies and may time out after 10 minutes

**Pass Criteria:** ✅ Upload succeeds, count updates (viewing requires backend access)

---

### 15. Delete Ticket
**Expected:** Ticket removed after confirmation

**Steps:**
1. Note current ticket count
2. Select any ticket row
3. Click "✕" button in last column
4. Verify confirmation dialog appears: "Delete this ticket?"
5. Click "Cancel" or "No"
6. Verify ticket is NOT deleted
7. Click "✕" button again
8. Click "OK" or "Yes"
9. Verify:
   - Ticket row disappears from table
   - Ticket count decreases by 1

**Pass Criteria:** ✅ Delete works with confirmation

---

### 16. Error Handling
**Expected:** Detailed error messages when operations fail

**Steps:**
1. Disconnect from internet (or simulate offline)
2. Try to add a ticket
3. Verify error alert includes detailed message (not just "Failed to add ticket")
4. Reconnect to internet
5. Try editing a field on a ticket that doesn't exist (simulate by manually changing ID in console)
6. Verify error message includes details like "Update failed: {reason}"

**Pass Criteria:** ✅ Errors show descriptive messages

---

## Overall Build Verification

### Build Passes
```bash
npm run build
```
**Expected:** No errors, dist/ folder created with index.html and assets

### CI Checks Pass
GitHub Actions workflows (.github/workflows/ci.yml and pages.yml) should pass:
- Build succeeds
- No linting errors (if linter configured)
- Deployment to GitHub Pages succeeds

---

### 17. Autosave & Manual Save
**Expected:** Changes save automatically after 2 seconds, manual save/discard works, refresh protection enabled

**Steps:**
1. Navigate to Delivery Tickets tab
2. Edit a ticket field (e.g., change Qty to 100)
3. Observe:
   - Change appears immediately in the UI
   - SaveBar appears at bottom of screen showing "Unsaved changes"
4. Wait 2-3 seconds without editing
5. Verify:
   - SaveBar shows spinner "Saving..."
   - After save completes, shows "✓ Saved at HH:MM:SS"
   - SaveBar remains visible (doesn't disappear)
6. Edit another field in a different ticket
7. Verify SaveBar shows "Unsaved changes" again
8. Click "Save" button on SaveBar
9. Verify:
   - Changes save immediately (no 2-second wait)
   - SaveBar shows "✓ Saved at HH:MM:SS"
10. Edit a field again
11. Click "Discard" button on SaveBar
12. Confirm in the dialog
13. Verify:
    - Field reverts to original value
    - SaveBar disappears
    - Data reloaded from server

**Pass Criteria:** ✅ Autosave works, manual save/discard work, status updates correctly

---

### 18. Refresh Protection
**Expected:** Unsaved changes persist across page refresh

**Steps:**
1. Navigate to Delivery Tickets tab
2. Edit multiple fields across several tickets
3. Before autosave triggers (within 2 seconds), refresh the page
4. On beforeunload dialog, click "Leave" or allow refresh
5. After page reloads:
   - Verify edited values are still present in the UI
   - Verify SaveBar appears showing changes will be saved
6. Wait 2-3 seconds
7. Verify changes are saved to server automatically

**Pass Criteria:** ✅ Unsaved changes rehydrate from localStorage after refresh

---

### 19. Offline Resilience
**Expected:** Edits persist locally when offline, save when online

**Steps:**
1. Navigate to Delivery Tickets tab
2. Open browser DevTools (F12) > Network tab
3. Toggle "Offline" mode in DevTools
4. Edit several ticket fields
5. Verify:
   - Changes appear in UI immediately
   - SaveBar shows "Unsaved changes"
6. Wait for autosave to attempt (2 seconds)
7. Verify:
   - SaveBar shows "⚠️ Save failed" error
   - Changes remain in UI (not lost)
8. Toggle "Online" mode in DevTools
9. Click "Save" button on SaveBar
10. Verify:
    - Changes save successfully
    - SaveBar shows "✓ Saved at HH:MM:SS"

**Pass Criteria:** ✅ Changes persist during offline, save when online

---

### 20. Batch Updates
**Expected:** Multiple edits across many rows are batched and saved together

**Steps:**
1. Navigate to Delivery Tickets tab
2. Quickly edit 5 different tickets (different fields)
3. Wait for autosave to trigger (2 seconds after last edit)
4. Open browser DevTools > Network tab
5. Filter by "delivery_tickets" requests
6. Verify:
   - Multiple update requests are made (one per ticket ID)
   - All happen within autosave flush operation
   - No per-keystroke requests during rapid editing

**Pass Criteria:** ✅ Changes batch correctly, no per-keystroke saves

---

### 21. Error Handling During Save
**Expected:** Save errors are displayed, draft persists for retry

**Steps:**
1. Navigate to Delivery Tickets tab
2. Edit a ticket field
3. Simulate save failure (if possible, or use offline mode)
4. Wait for autosave attempt
5. Verify:
   - SaveBar shows "⚠️ Save failed" with error message
   - Changes remain in UI (not reverted)
   - Draft remains in localStorage
6. Fix the issue (e.g., go back online)
7. Click "Save" button
8. Verify changes save successfully

**Pass Criteria:** ✅ Errors displayed, draft persists for retry

---

### 22. Computed Fields in Autosave
**Expected:** Computed fields (amount, miles, on_time_flag) are included in autosaved updates

**Steps:**
1. Navigate to Delivery Tickets tab
2. Edit Qty = 50, Price = 3.00, Tax = 2.00
3. Verify Amount shows $152.00 immediately
4. Wait for autosave
5. Refresh the page
6. Verify Amount still shows $152.00 (saved correctly)
7. Edit Odometer Start = 1000, Odometer End = 1050
8. Verify Miles shows 50.0 immediately
9. Wait for autosave
10. Refresh the page
11. Verify Miles still shows 50.0 (saved correctly)

**Pass Criteria:** ✅ Computed fields save correctly with autosave

---

### 23. Add Blank Ticket (No Duplicate Key Error)
**Expected:** Adding blank ticket does not fail with unique constraint error

**Steps:**
1. Navigate to Delivery Tickets tab
2. Click "Add ticket" button
3. Verify:
   - No error alert appears
   - New ticket row is created
   - ticket_no and ticket_id fields are null (not empty string)
4. Add another blank ticket
5. Verify:
   - No duplicate key error
   - Second ticket is created successfully

**Pass Criteria:** ✅ Multiple blank tickets can be added without constraint errors

---

## Summary Checklist

- [ ] Add blank ticket (no error, null values)
- [ ] Amount auto-calculates from qty*price+tax+hazmat_fee
- [ ] Hazmat Fee integrates with autosave, amount calculation, and exports
- [ ] Datetime fields show local time (no shift)
- [ ] Miles calculates from odometer values
- [ ] On-time flag calculates with 5-min grace
- [ ] Date filters work (Today, Week, Month, Year, Custom)
- [ ] Truck selector filters metrics and table
- [ ] Per-truck breakdown shows when "All" selected
- [ ] CSV export downloads with filtered data
- [ ] Excel export creates .xlsx with Tickets sheet
- [ ] Charts show gallons and revenue by day
- [ ] Layout responsive without horizontal scroll
- [ ] Attachment upload works (optional: viewing)
- [ ] Delete ticket works with confirmation
- [ ] Error messages are descriptive
- [ ] **Autosave works after 2s of inactivity**
- [ ] **Manual Save button flushes immediately**
- [ ] **Discard reverts changes and reloads**
- [ ] **Refresh rehydrates unsaved changes**
- [ ] **Offline edits persist, save when online**
- [ ] **Multiple edits batch correctly**
- [ ] **Save errors display, draft persists**
- [ ] **Computed fields save with autosave**
- [ ] **No duplicate key errors on blank tickets**
- [ ] Build passes locally and in CI
- [ ] GitHub Pages deployment succeeds

---

## Notes

- All features implemented in `src/components/DeliveryTickets.jsx`
- Helper utilities in `src/lib/datetime.js` and `src/lib/metrics.js`
- Documentation in `docs/DeliveryTickets_Setup.md`
- Uses existing Supabase helpers in `src/lib/supabaseHelpers.js`
- Dependencies: recharts (charts), xlsx (Excel export) - already in package.json

## Troubleshooting

If issues arise:
1. Check browser console for detailed error messages
2. Verify Supabase credentials are set (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
3. Check network tab for failed API calls
4. Verify RLS policies on delivery_tickets and ticket_attachments tables
5. Review docs/DeliveryTickets_Setup.md for database schema requirements
