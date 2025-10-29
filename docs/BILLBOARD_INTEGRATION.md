# Billboard Fullscreen Integration Guide

This guide explains how to integrate the FullscreenButton component into the existing Billboard page to enable fullscreen toggle functionality.

## Components Added

### 1. FullscreenButton Component (`src/components/FullscreenButton.jsx`)

A React component that provides browser fullscreen toggle functionality with vendor prefix support.

**Features:**
- Toggles fullscreen mode for a target element (default: `billboard-root`)
- Handles all browser vendor prefixes (webkit, moz, ms)
- Tracks fullscreen state with event listeners
- Provides accessible button with aria-pressed attribute
- Inline styles for consistent appearance

**Props:**
- `targetId` (string, default: 'billboard-root') - ID of element to make fullscreen
- `className` (string, default: '') - Additional CSS classes

### 2. useAutoScale Hook (`src/hooks/useAutoScale.js`)

Optional hook for auto-scaling content to fit different viewport sizes in fullscreen mode.

**Parameters:**
- `baseWidth` (number, default: 1920) - Base width for scaling calculations
- `baseHeight` (number, default: 1080) - Base height for scaling calculations
- `enabled` (boolean, default: true) - Toggle scaling on/off

**Returns:**
- `scale` (number) - Scale factor to apply to content

### 3. Billboard CSS Updates (`src/styles/billboard.css`)

Additional CSS rules to support fullscreen mode:
- Fullscreen-specific container styles
- Overflow prevention
- Viewport-based sizing
- Responsive grid adjustments

## Integration Steps

### Step 1: Add ID to Billboard Root Element

In `src/components/Billboard/BillboardPage.jsx`, add `id="billboard-root"` to the main container:

```jsx
return (
  <div id="billboard-root" className={`billboard-page ${isTVMode ? 'tv-mode' : ''}`}>
    {/* existing content */}
  </div>
);
```

### Step 2: Import FullscreenButton

At the top of `BillboardPage.jsx`, add:

```jsx
import FullscreenButton from '../FullscreenButton';
```

### Step 3: Add FullscreenButton to Header Actions

Place the button in the billboard-actions section:

```jsx
<div className="billboard-actions">
  {/* Add fullscreen button */}
  <FullscreenButton targetId="billboard-root" className="btn olive" />
  
  {/* Existing buttons */}
  <button onClick={openTVMode} className="btn olive popout-button" title="Full screen billboard">
    📺 Full screen
  </button>
  <button onClick={copyTVUrl} className="btn secondary">📋 Copy TV URL</button>
  <button onClick={fetchData} className="btn secondary">🔄 Refresh</button>
</div>
```

### Step 4: Import Billboard CSS (if not already imported)

Ensure the CSS is imported in `BillboardPage.jsx`:

```jsx
import '../../styles/billboard.css';
```

### Step 5: (Optional) Add Auto-Scaling

If you want content to auto-scale in fullscreen mode:

```jsx
import useAutoScale from '../../hooks/useAutoScale';

function BillboardPage() {
  const scale = useAutoScale({ enabled: isFullscreen });
  
  return (
    <div 
      id="billboard-root" 
      className={`billboard-page ${isTVMode ? 'tv-mode' : ''}`}
      style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
    >
      {/* content */}
    </div>
  );
}
```

## CSS Fullscreen Rules

The following CSS rules in `billboard.css` support fullscreen mode:

```css
/* Fullscreen container styles */
#billboard-root:fullscreen,
#billboard-root:-webkit-full-screen,
#billboard-root:-moz-full-screen,
#billboard-root:-ms-fullscreen {
  width: 100vw;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  padding: 1rem;
}

/* Prevent content overflow in fullscreen */
#billboard-root:fullscreen .billboard-page,
#billboard-root:-webkit-full-screen .billboard-page {
  max-height: 100vh;
  overflow-y: auto;
}
```

## Testing

1. **Navigate to Billboard page**
2. **Click "Fullscreen" button** - Page should enter fullscreen mode
3. **Click "Exit Fullscreen"** - Page should exit fullscreen mode
4. **Press ESC key** - Should also exit fullscreen mode
5. **Test on different browsers** - Chrome, Firefox, Safari, Edge

## Browser Compatibility

The FullscreenButton component supports:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (WebKit)
- ✅ Internet Explorer 11 (MS prefix)

## Troubleshooting

**Fullscreen not working?**
- Ensure the target element has the correct ID
- Check browser console for errors
- Verify user interaction (fullscreen requires user gesture)

**Content overflow in fullscreen?**
- Check billboard.css fullscreen rules are applied
- Verify container has `overflow: hidden`
- Consider using useAutoScale hook

**Button not showing?**
- Verify FullscreenButton is imported correctly
- Check that className matches your button styles
- Ensure billboard-actions div exists in JSX

## Notes

- Fullscreen API requires user interaction (cannot be triggered automatically on page load)
- The existing TV mode and fullscreen toggle can coexist
- Fullscreen state is tracked independently via event listeners
- All vendor prefixes are handled automatically
