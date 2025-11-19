# Visual Changes - Estimate vs Job Distinction Feature

## Service Tracking Page

### Type Column
A new "Type" column has been added to the jobs table between "Customer" and "Status":

```
| Job # | Customer      | Type | Status    | Date       | Tech  | ... |
|-------|---------------|------|-----------|------------|-------|-----|
| 1001  | John Smith    | EST  | Scheduled | 2024-11-20 | Bob   | ... |
| 1002  | Jane Doe      | JOB  | Completed | 2024-11-19 | Alice | ... |
```

**EST Pills (Estimates):**
- Purple border: `border-purple-400`
- Purple text: `text-purple-700`
- Small rounded badge with "EST" text
- Font size: 11px, semibold

**JOB Pills (Jobs):**
- Gray border: `border-slate-300`
- Gray text: `text-slate-700`
- Small rounded badge with "JOB" text
- Font size: 11px, semibold

### Type Filter Buttons
New filter section added below Status filter:

```
Tech: [All Techs ▼]  Status: [All Statuses ▼]  Type: [All] [Jobs] [Estimates]
```

**Filter Button States:**
- Active (selected): Blue background (`bg-blue-600`), white text
- Inactive: White background, gray border
- Text size: xs (extra small)
- Padding: 3px horizontal, 1.5px vertical

### Preview Table
The preview table (shown when uploading a file) also includes the Type column with the same EST/JOB pills.

---

## Schedule (HCP) Calendar Page

### Job Cards with EST Badge

**Regular Job Card:**
```
┌─────────────────────────┐
│ Jane Doe                │
│ Installation            │
│ 9:00 AM - 11:00 AM     │
└─────────────────────────┘
```

**Estimate Card:**
```
┌─────────────────────────┐
│ John Smith        [EST] │
│ Leak Repair             │
│ 1:00 PM - 3:00 PM      │
└─────────────────────────┘
```

### EST Badge Styling
- Position: Top-right corner of card, aligned with customer name
- Border: Purple (`border-purple-700`)
- Background: Semi-transparent white (`bg-white/40`)
- Text: Purple (`text-purple-800`)
- Font size: 10px, bold
- Padding: 1.5px horizontal, 0.5px vertical

### Dashed Border for Estimates
- Regular jobs: `1px solid transparent` (no visible border)
- Estimates: `1px dashed rgba(0,0,0,0.35)` (subtle dashed border)
- The dashed border is applied in addition to the existing background color from the job type/status

### Color Scheme Preservation
All existing color coding remains unchanged:
- Yellow: Started / Tech on site
- Tangerine: Part ordered / Incomplete
- Red: Leak / Urgent
- Flamingo: Need more info
- Basil: Service call
- Blueberry: Installation
- Lavender: Complete, ready to bill
- Grape: Billed, closed
- Graphite: Unscheduled

The EST badge and dashed border are overlaid on these colors.

### Type Filter Buttons
New filter section added below Technician filter:

```
Search: [________________]  Technician: [All Technicians ▼]
Type: [All] [Jobs] [Estimates]
```

**Filter Button States:**
- Active (selected): Blue background (`bg-blue-600`), white text
- Inactive: White background, gray border
- Text size: xs (extra small)
- Padding: 3px horizontal, 2px vertical
- Border radius: lg (larger rounded corners)

### Job Detail Modal Enhancement

**Before:**
```
Job #JOB-1001
John Smith

Job Type: Estimate
Status: Scheduled
...
```

**After:**
```
Job #JOB-1001
ESTIMATE • Leak Repair
John Smith

Status: Scheduled
...
```

The type indicator (ESTIMATE or JOB) is shown prominently below the job number in uppercase, followed by the job type, creating a clear visual hierarchy.

---

## Responsive Design Notes

### Service Tracking
- Type filter buttons wrap on smaller screens using `flex-wrap`
- Type column is narrow (pills are small), so it doesn't significantly affect mobile layout

### Schedule Calendar
- Filter buttons stack vertically on mobile
- EST badges remain visible but are sized appropriately at 10px
- Dashed borders provide subtle visual distinction without cluttering small cards

---

## Accessibility

### Color Contrast
- EST pills use purple with sufficient contrast (WCAG AA compliant)
- JOB pills use gray with sufficient contrast
- Filter buttons maintain contrast in both active and inactive states

### Screen Readers
- Estimate/Job type is part of the table cell content and will be read by screen readers
- Filter buttons have clear text labels
- Modal type indicator is in a semantic heading structure

---

## User Flow Examples

### Scenario 1: Finding All Estimates
1. User opens Service Tracking
2. Clicks "Estimates" button in Type filter
3. Table filters to show only rows with EST pills
4. Count updates: "Showing 15 of 150 jobs"

### Scenario 2: Viewing Estimate in Calendar
1. User opens Schedule (HCP)
2. Sees job card with [EST] badge and dashed border
3. Clicks card to open detail modal
4. Modal shows "ESTIMATE • Service Call" at top

### Scenario 3: Uploading File with Estimates
1. User uploads Housecall Pro CSV
2. Preview shows Type column
3. Rows with "Estimate" in description show EST pill
4. User confirms and imports
5. Main table updates with Type column showing EST/JOB pills
