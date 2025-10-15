# SaveBar UI Component - Visual Guide

## Overview
The SaveBar is a floating UI component that appears at the bottom center of the screen when there are unsaved changes in the Delivery Tickets page.

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                     [Main Content Area]                             │
│                                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    ▼
        ┌───────────────────────────────────────────────────┐
        │  ✓ Saved at 14:32:45    │  Discard     Save      │
        └───────────────────────────────────────────────────┘
                  Fixed at bottom center, z-index: 50
```

## Component States

### 1. Unsaved Changes (Initial State)
```
┌─────────────────────────────────────────────────────┐
│  Unsaved changes        │  Discard     Save         │
└─────────────────────────────────────────────────────┘
```
- **Text**: "Unsaved changes" in slate-600
- **Buttons**: Both enabled
- **Appears**: When user edits any field

### 2. Saving (In Progress)
```
┌─────────────────────────────────────────────────────┐
│  ⟳ Saving...            │  Discard     Save         │
└─────────────────────────────────────────────────────┘
```
- **Icon**: Spinning blue spinner
- **Text**: "Saving..." in slate-600
- **Buttons**: Both disabled (opacity 50%)
- **Appears**: During autosave or manual save

### 3. Saved Successfully
```
┌─────────────────────────────────────────────────────┐
│  ✓ Saved at 14:32:45    │  Discard     Save         │
└─────────────────────────────────────────────────────┘
```
- **Icon**: Green checkmark (✓)
- **Text**: "Saved at HH:MM:SS" in slate-600
- **Timestamp**: Local time when save completed
- **Buttons**: Both enabled
- **Persists**: Until next edit is made

### 4. Save Failed (Error State)
```
┌─────────────────────────────────────────────────────┐
│  ⚠️ Save failed         │  Discard     Save         │
└─────────────────────────────────────────────────────┘
```
- **Icon**: Red warning (⚠️)
- **Text**: "Save failed" in red-600
- **Hover**: Shows full error message
- **Buttons**: Both enabled (user can retry)
- **Draft**: Persists in localStorage for retry

## Button Behavior

### Save Button
- **Style**: Blue background (bg-blue-600), white text
- **Hover**: Darker blue (bg-blue-700)
- **Action**: Immediately flushes all pending changes to server
- **Disabled**: During active save operation
- **Feedback**: Shows spinner → success/error

### Discard Button
- **Style**: White background with slate border
- **Hover**: Light gray (bg-slate-50)
- **Action**: Prompts confirmation → reverts to server state
- **Disabled**: During active save operation
- **Confirmation**: "Discard all unsaved changes? This will reload data from the server."

## Positioning & Animation

### Position
- **Fixed**: Bottom of viewport
- **Horizontal**: Centered with `left-1/2 transform -translate-x-1/2`
- **Vertical**: 1rem (4px * 4 = 16px) from bottom
- **Z-index**: 50 (above normal content, below modals)

### Animation
- **Transition**: Smooth slide-in/fade with `transition-all duration-300 ease-in-out`
- **Appearance**: Fades in when unsaved changes detected
- **Disappearance**: Fades out after Discard or when all changes saved and user navigates away

## Style Details

### Container
- **Background**: White (bg-white)
- **Border**: 2px slate-300 border
- **Shadow**: Large shadow (shadow-lg) for depth
- **Padding**: 1.5rem horizontal (px-6), 0.75rem vertical (py-3)
- **Border Radius**: Rounded (rounded-lg)

### Layout
- **Display**: Flexbox with gap-4 between elements
- **Sections**: Status (min-width: 150px) | Divider | Buttons
- **Divider**: Vertical border-l border-slate-300 with pl-4

### Typography
- **Status Text**: text-sm (14px)
- **Button Text**: text-sm (14px)
- **Colors**: slate-600 for normal, blue-600/red-600 for status

## Integration Points

### Visibility Logic
```javascript
<SaveBar
  visible={autosave.hasUnsavedChanges}  // Show when true
  isSaving={autosave.isSaving}          // Spinner state
  lastSavedAt={autosave.lastSavedAt}   // ISO timestamp
  error={autosave.error}                // Error message
  onSave={handleSaveNow}                // Manual save callback
  onDiscard={handleDiscard}             // Discard callback
/>
```

## User Interactions

### Typical Flow
1. User edits field → SaveBar appears showing "Unsaved changes"
2. After 2 seconds → SaveBar shows "⟳ Saving..."
3. On success → SaveBar shows "✓ Saved at 14:32:45"
4. SaveBar remains visible until next edit

### Manual Save Flow
1. User edits multiple fields
2. User clicks "Save" button
3. SaveBar shows "⟳ Saving..." immediately
4. On success → "✓ Saved at 14:32:45"

### Discard Flow
1. User edits fields
2. User clicks "Discard"
3. Confirmation dialog appears
4. On confirm → Data reverts, SaveBar disappears
5. Fresh data loaded from server

### Error Recovery Flow
1. SaveBar shows "⚠️ Save failed"
2. User hovers to see error details
3. User can:
   - Click "Save" to retry
   - Click "Discard" to abandon changes
   - Wait for autosave to retry

## Accessibility

### Keyboard Navigation
- **Tab**: Cycles between Discard and Save buttons
- **Enter/Space**: Activates focused button
- **Escape**: Can close confirmation dialogs

### Screen Readers
- Status text announces save state changes
- Button labels are clear and descriptive
- Error messages are surfaced to screen readers

## Responsive Behavior

### Desktop (≥1024px)
- Full SaveBar with all text visible
- Positioned at bottom center
- Min-width to accommodate content

### Tablet (768px - 1023px)
- Same as desktop (sufficient space)
- May adjust padding slightly

### Mobile (<768px)
- Full functionality maintained
- May need to test width on smaller screens
- Consider reducing padding if needed

## Edge Cases

### Multiple Rapid Edits
- SaveBar updates immediately on first edit
- Debounce timer resets with each edit
- Only saves once after 2s of inactivity

### Network Issues
- Shows error state with retry option
- Draft persists in localStorage
- User can go offline, edit, and save when online

### Page Refresh with Unsaved Changes
- Browser warns: "You have unsaved changes..."
- If user proceeds, draft rehydrates on load
- SaveBar appears, autosave resumes

### Delete While Editing
- If user deletes a row with pending changes
- Pending changes for that row are cleared
- If no other pending changes, SaveBar disappears

## Testing Checklist

- [ ] SaveBar appears on first edit
- [ ] Spinner shows during save
- [ ] Success message shows with correct timestamp
- [ ] Error state displays on failure
- [ ] Save button triggers immediate save
- [ ] Discard button shows confirmation
- [ ] Discard reverts to server state
- [ ] SaveBar disappears after discard
- [ ] Hover on error shows full message
- [ ] Buttons disabled during save
- [ ] Timestamp updates correctly
- [ ] Animation smooth and not jarring
- [ ] Positioning correct on all screen sizes
