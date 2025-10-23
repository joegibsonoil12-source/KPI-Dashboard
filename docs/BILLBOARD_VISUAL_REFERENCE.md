# Billboard Feature - Visual Reference

## Overview

This document provides visual descriptions and layout details for the Billboard feature components.

## Component Layout

### BillboardPage - Main Container

```
┌─────────────────────────────────────────────────────────────────┐
│  Operations Billboard                    [📺 TV Mode] [🔄 Refresh] │
├─────────────────────────────────────────────────────────────────┤
│  ═══════════════ SCROLLING TICKER ═══════════════                │
│  ► Completed: 42  |  Revenue: $125,000  |  Tickets: 156  |  ... │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Completed │ │Delivery  │ │  Total   │ │  Total   │ │ Pipeline │ │
│  │Services  │ │ Tickets  │ │ Gallons  │ │ Revenue  │ │          │ │
│  │    42    │ │   156    │ │ 45,230.5 │ │$214,450  │ │ $45,000  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  This Week vs Last Week                        [Strong Growth]   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ This Week: $214,450.75    Last Week: $198,320.50            │ │
│  │ Change: +8.1%                                               │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ ████████████████████████░░░░░░░░░░░░░░░ 108%               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  Legend: 🔴 <90% | 🟡 90-110% | 🟢 >110%                         │
├─────────────────────────────────────────────────────────────────┤
│  Service Tracking Details                                        │
│  Completed: 42  |  Scheduled: 18  |  Deferred: 3  |  Pipeline  │
└─────────────────────────────────────────────────────────────────┘
```

## Color Scheme

### Dark Theme (Primary)
- Background: Dark gradient (`#1e293b` → `#0f172a`)
- Text: Light gray (`#f8fafc`)
- Accents: Blue gradient (`#60a5fa` → `#a78bfa`)
- Cards: Semi-transparent white (`rgba(255,255,255,0.05)`)

### Color Indicators
- **Green** (`#10b981`): Completed, Positive changes, >110% growth
- **Blue** (`#3b82f6`): Delivery metrics, Scheduled
- **Amber** (`#f59e0b`): Warning, 90-110% range
- **Red** (`#ef4444`): Alerts, Deferred, <90% decline
- **Purple** (`#8b5cf6`): Revenue metrics
- **Pink** (`#ec4899`): Pipeline metrics

## Component Details

### 1. BillboardTicker (Marquee)

**Visual Appearance:**
- Horizontal scrolling ribbon
- Dark background with blue top/bottom borders
- Seamless infinite loop animation
- Items separated by vertical dividers

**Animation:**
- 60fps CSS animation using `transform: translateX()`
- Configurable speed (default: 80 seconds for full loop)
- Hardware accelerated with `will-change: transform`

**Item Format:**
```
Label: Value [Change]
```

Example items:
- `Completed Services: 42`
- `Service Revenue: $125,000.00`
- `Week Performance: +8.1% ▲`

### 2. BillboardCards (Metric Cards)

**Layout:**
- Grid layout (5 columns on desktop, responsive on mobile)
- Each card has:
  - Colored top border (4px, matches metric type)
  - Label (uppercase, gray)
  - Large value (responsive font size using `clamp()`)
  - Unit label (for gallons)

**Card Types:**
1. **Completed Services** - Green border
2. **Delivery Tickets** - Blue border
3. **Total Gallons** - Amber border
4. **Total Revenue** - Purple border
5. **Pipeline** - Pink border

**Typography:**
- Values use `clamp(2rem, 4vw, 4rem)` for responsive scaling
- TV mode increases to `clamp(3rem, 6vw, 6rem)`

### 3. WeekCompareMeter (Comparison Bar)

**Structure:**
```
┌─────────────────────────────────────────────────┐
│ This Week vs Last Week        [Status Badge]    │
├─────────────────────────────────────────────────┤
│ This Week: $214,450.75                          │
│ Last Week: $198,320.50                          │
│ Change: +8.1%                                   │
├─────────────────────────────────────────────────┤
│ ██████████████████░░░░░░░░░░░░░░ 108%          │
│ 🔴 <90% | 🟡 90-110% | 🟢 >110%                 │
└─────────────────────────────────────────────────┘
```

**Color Logic:**
- **Green** (>110%): Strong growth, success indicator
- **Amber** (90-110%): Stable performance
- **Red** (<90%): Needs attention, decline indicator

**Bar Behavior:**
- Width represents percentage relative to last week (100% = matching)
- Capped at 150% width for visual consistency
- Smooth transition animation (0.6s ease)

### 4. TV Mode Differences

**Changes in TV Mode:**
- Header hidden (no navigation buttons)
- Larger font sizes across all components
- Optimized for 1920x1080 displays
- Auto-fullscreen on load (with user permission)
- Footer minimized

**Activation:**
- Click "📺 Open TV Mode" button
- Or append `?tv=1` to URL
- Opens in new window (1920x1080)

## Responsive Breakpoints

### Desktop (>768px)
- 5-column card grid
- Full header with buttons
- Standard font sizes

### Tablet/Mobile (≤768px)
- Single column layout
- Stacked cards
- Header buttons full-width
- Smaller ticker items

## Animation Performance

All animations optimized for 60fps:
- Ticker uses CSS `transform` (GPU accelerated)
- Card hover effects use `transform` not `top/left`
- Meter bar uses `width` transition
- Loading spinner uses `transform: rotate()`

## Accessibility Features

### WCAG Compliance
- Contrast ratios meet WCAG AA standards
- Text minimum 4.5:1 contrast
- Large text minimum 3:1 contrast

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  /* Animations disabled */
  .billboard-ticker {
    animation: none;
  }
}
```

### High Contrast Mode
```css
@media (prefers-contrast: high) {
  /* Increased borders and backgrounds */
}
```

## Data Refresh Indicators

**Last Updated Footer:**
```
Last Updated: 3:45:32 PM     Auto-refresh: 30s
```

**Loading State:**
- Centered spinner with text
- "Loading Billboard data..."

**Error State:**
- Red error message
- Retry button
- Clear error description

## Example Data Flow

1. **Initial Load**
   - Fetch billboard summary from API
   - Display loading spinner
   - Parse and display metrics

2. **Auto-refresh Loop**
   - Every N seconds (default 30)
   - Silent background fetch
   - Update metrics smoothly

3. **Manual Refresh**
   - User clicks refresh button
   - Fetches latest data immediately
   - Updates timestamp

4. **Caching**
   - API caches for 15 seconds
   - Reduces database load
   - Fresh data every 15s at most

## Typography Scale

### Standard Mode
- Title: `clamp(2rem, 4vw, 3.5rem)`
- Card values: `clamp(2rem, 4vw, 4rem)`
- Meter values: `clamp(1.5rem, 3vw, 2.5rem)`

### TV Mode
- Card values: `clamp(3rem, 6vw, 6rem)`
- Meter values: `clamp(2rem, 4vw, 3.5rem)`
- Ticker items: `1.5rem` → `1.75rem`

## Future Enhancement Ideas

1. **Real-time Updates**: WebSocket integration instead of polling
2. **Custom Metrics**: Allow users to choose which metrics to display
3. **Historical Charts**: Add trend lines for week-over-week comparison
4. **Alert Thresholds**: Configure alerts for critical metrics
5. **Multi-location**: Support for multiple store/location views
6. **Export/Snapshot**: Download current billboard state as image
7. **Sound Alerts**: Audio notifications for critical changes
8. **Split Screen**: Multiple billboard views simultaneously

## Testing Checklist

- [ ] Ticker scrolls smoothly at 60fps
- [ ] Cards display correct data and formatting
- [ ] Week comparison bar shows correct percentage
- [ ] Color coding matches thresholds (green/amber/red)
- [ ] TV mode opens in new window
- [ ] Fullscreen activates in TV mode
- [ ] Auto-refresh works at configured interval
- [ ] Manual refresh updates data immediately
- [ ] Null/undefined values display as "—"
- [ ] Responsive layout works on mobile
- [ ] Loading state displays correctly
- [ ] Error state shows retry button
- [ ] Accessibility: keyboard navigation works
- [ ] Accessibility: screen reader friendly
- [ ] Performance: No layout shifts
- [ ] Performance: Smooth animations

