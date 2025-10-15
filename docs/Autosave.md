# Autosave Feature Documentation

## Overview

The autosave feature provides a robust, user-friendly way to manage data changes in the KPI Dashboard. It combines manual save controls with automatic background persistence to prevent data loss while reducing server load from per-keystroke updates.

## Architecture

### Core Components

1. **`useAutosave` Hook** (`src/lib/useAutosave.js`)
   - Generic React hook for autosave functionality
   - Handles debouncing, localStorage persistence, and server flush
   - Can be reused across multiple components/tabs

2. **`SaveBar` Component** (`src/components/SaveBar.jsx`)
   - UI component for manual Save/Discard controls
   - Displays save status and error messages
   - Fixed position bar that appears when there are unsaved changes

3. **Batch Update Helper** (`updateTicketBatchSequential` in `src/lib/supabaseHelpers.js`)
   - Handles sequential updates for multiple rows
   - Processes changes one at a time to avoid race conditions
   - Returns success/error status for each row

## How It Works

### User Flow

1. **User Edits Data**
   - Changes are applied to local state immediately (responsive UI)
   - Changes are queued in a pending changes map
   - Draft is persisted to localStorage
   - Debounce timer starts (default: 2 seconds)

2. **Automatic Save**
   - After 2 seconds of inactivity, autosave triggers
   - Pending changes are flushed to Supabase
   - SaveBar shows "Saving..." status
   - On success: Draft is cleared, "Saved at HH:MM:SS" is shown
   - On error: Draft is kept, error is displayed

3. **Manual Save**
   - User clicks "Save" button
   - Immediately flushes all pending changes (bypasses debounce)
   - Same success/error handling as automatic save

4. **Discard Changes**
   - User clicks "Discard" button
   - Clears all pending changes and localStorage draft
   - Reloads fresh data from server

5. **Page Refresh**
   - If there are unsaved changes, browser warns user
   - On load, any persisted draft is rehydrated into state
   - Autosave resumes and flushes changes within 2 seconds

## Implementation Details

### Data Structure

**Pending Changes Map:**
```javascript
{
  [ticketId]: {
    field1: value1,
    field2: value2,
    // ... all changed fields for this row
  },
  // ... more rows
}
```

### Key Features

#### Debounced Autosave
- Configurable delay (default: 2000ms)
- Timer resets on each edit
- Prevents excessive API calls during rapid typing

#### localStorage Persistence
- Draft is serialized to JSON and stored locally
- Survives page refreshes
- Cleared after successful save

#### Batch Updates
- Multiple row changes are accumulated
- Sent to server in a single flush operation
- Processed sequentially to maintain data integrity

#### Error Handling
- Network errors are caught and displayed
- Failed saves keep the draft intact
- User can retry by clicking Save or waiting for autosave

#### Computed Fields
- Calculated fields (amount, miles_driven, on_time_flag) are computed locally
- Included in the update payload when their dependencies change
- Ensures consistency between UI and database

## Adopting Autosave in Other Components

To add autosave to another tab (e.g., KPIs, Budget):

### 1. Import Dependencies

```javascript
import { useAutosave } from "../lib/useAutosave";
import SaveBar from "./SaveBar";
```

### 2. Add Pending Changes State

```javascript
const [pendingChanges, setPendingChanges] = useState({});
```

### 3. Configure Autosave Hook

```javascript
const autosave = useAutosave({
  storageKey: "your-component-draft", // unique key
  delayMs: 2000,
  serializeDraft: (data) => JSON.stringify(data),
  deserializeDraft: (str) => JSON.parse(str),
  onFlush: async (changesById) => {
    // Implement your batch update logic here
    // e.g., await updateKPIBatchSequential(changesById);
  },
});
```

### 4. Modify Update Handler

Replace immediate DB writes with local state + queue:

```javascript
function update(id, key, val) {
  // 1. Update local state immediately
  setItems(items => items.map(item => 
    item.id === id ? { ...item, [key]: val } : item
  ));
  
  // 2. Queue changes for autosave
  setPendingChanges(prev => {
    const updated = {
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [key]: val,
      },
    };
    autosave.queueChanges(updated);
    return updated;
  });
}
```

### 5. Load Draft on Mount

```javascript
useEffect(() => {
  async function load() {
    const data = await fetchData();
    
    // Load and merge draft
    const draft = autosave.loadDraft();
    if (draft) {
      const merged = data.map(row => 
        draft[row.id] ? { ...row, ...draft[row.id] } : row
      );
      setItems(merged);
      setPendingChanges(draft);
      setTimeout(() => autosave.queueChanges(draft), 100);
    } else {
      setItems(data);
    }
  }
  load();
}, []);
```

### 6. Add SaveBar to UI

```javascript
return (
  <div>
    <SaveBar
      visible={autosave.hasUnsavedChanges}
      isSaving={autosave.isSaving}
      lastSavedAt={autosave.lastSavedAt}
      error={autosave.error}
      onSave={handleSaveNow}
      onDiscard={handleDiscard}
    />
    {/* Rest of your component */}
  </div>
);
```

### 7. Implement Save/Discard Handlers

```javascript
async function handleSaveNow() {
  await autosave.saveNow();
  setPendingChanges({});
}

async function handleDiscard() {
  if (!confirm("Discard all unsaved changes?")) return;
  setPendingChanges({});
  autosave.discard();
  const fresh = await fetchData();
  setItems(fresh);
}
```

## Configuration Options

### useAutosave Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storageKey` | string | (required) | Unique localStorage key for this component |
| `delayMs` | number | 2000 | Debounce delay in milliseconds |
| `serializeDraft` | function | (required) | Converts draft data to string |
| `deserializeDraft` | function | (required) | Converts string back to draft data |
| `onFlush` | async function | (required) | Flushes pending changes to server |

### useAutosave Return Values

| Property | Type | Description |
|----------|------|-------------|
| `hasUnsavedChanges` | boolean | Whether there are pending changes |
| `isSaving` | boolean | Whether a save is in progress |
| `lastSavedAt` | string\|null | ISO timestamp of last successful save |
| `error` | string\|null | Last save error message |
| `queueChanges(data)` | function | Queue changes for autosave |
| `saveNow()` | async function | Manually trigger immediate save |
| `discard()` | function | Discard all pending changes |
| `loadDraft()` | function | Load persisted draft from localStorage |

## Best Practices

### Do's ✅

- Use a unique `storageKey` for each component
- Update local state immediately for responsive UI
- Include computed fields in the update payload
- Clear pending changes for deleted rows
- Test refresh behavior to ensure draft rehydration works

### Don'ts ❌

- Don't call `updateTicket()` directly in update handlers (use queue instead)
- Don't forget to clear drafts on successful save
- Don't use the same `storageKey` for multiple components
- Don't skip beforeunload warning (it's built into the hook)

## Troubleshooting

### Changes Not Saving

1. Check browser console for errors
2. Verify `onFlush` function is implemented correctly
3. Check network tab for failed API requests
4. Ensure RLS policies allow updates

### Draft Not Rehydrating

1. Check `storageKey` is consistent
2. Verify `deserializeDraft` handles the stored format
3. Check browser console for deserialization errors
4. Clear localStorage manually if format changed

### Race Conditions

- Use `updateTicketBatchSequential` for sequential updates
- Avoid parallel writes to the same row
- Let autosave handle the timing; don't flush manually unless user-triggered

## Performance Considerations

- **Debounce Delay**: 2 seconds balances responsiveness vs. server load
- **Batch Updates**: Reduces API calls for multi-row edits
- **localStorage**: Very fast, but limited to ~5-10MB per origin
- **Sequential Updates**: Slower than parallel, but safer for data integrity

## Security & Privacy

- Drafts are stored in localStorage (client-side only)
- No sensitive data is transmitted until save
- RLS policies still apply to all server writes
- Audit triggers continue to work (no DB changes needed)

## Future Enhancements

Potential improvements for future PRs:

1. **Conflict Resolution**: Detect server-side changes during edit
2. **Optimistic Updates**: Show success immediately, rollback on error
3. **Compression**: Compress large drafts before storing
4. **Multi-Tab Sync**: Use BroadcastChannel to sync drafts across tabs
5. **Undo/Redo**: Track change history for multi-level undo
6. **Partial Updates**: Only send changed fields, not entire row

## References

- Implementation: `src/lib/useAutosave.js`
- Example Usage: `src/components/DeliveryTickets.jsx`
- Testing Guide: `DELIVERY_TICKETS_TESTING.md` (Autosave section)
