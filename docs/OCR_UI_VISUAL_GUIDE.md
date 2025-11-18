# OCR Upload UI - Visual Guide

This document describes the visual changes to the Upload Scanned Tickets page.

## Page: `/imports/upload`

### Header Section
```
┌─────────────────────────────────────────────────────────────────┐
│ Upload Scanned Tickets                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Help Text Section (NEW)
```
┌─────────────────────────────────────────────────────────────────┐
│ ℹ️ OCR-Powered Import: This uploader accepts scanned PDFs and   │
│   images and will automatically perform OCR to extract          │
│   delivery ticket data.                                         │
│                                                                 │
│ 📄 Supported Formats: PDF (scanned or digital), JPG, PNG, GIF  │
│                                                                 │
│ 💡 For Best Results: Use high-contrast scans with readable      │
│   text. Ensure the document is properly aligned and not blurry.│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ℹ️ Auto-Detection: Upload your scanned tickets (service or      │
│   delivery). The system will automatically detect the type      │
│   based on content.                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Debug Mode Toggle (NEW)
```
┌─────────────────────────────────────────────────────────────────┐
│ ☑️ Enable Debug Mode (Admin)                                    │
│                                                                 │
│ Debug mode allows you to export raw OCR text and parsed CSV    │
│ data for troubleshooting.                                       │
└─────────────────────────────────────────────────────────────────┘
```

### File Upload Zone
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                            ☁️                                   │
│                                                                 │
│          Drop files here or click to browse                    │
│                                                                 │
│             Supports PDF, JPG, PNG, GIF                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Selected Files List
```
┌─────────────────────────────────────────────────────────────────┐
│ Selected Files (2)                                              │
│                                                                 │
│ 📄 delivery-report-01.pdf                      [❌ Remove]      │
│    1,234 KB                                                     │
│                                                                 │
│ 📄 delivery-scan-02.jpg                        [❌ Remove]      │
│    856 KB                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Upload Button
```
┌─────────────────────────────────────────────────────────────────┐
│                    [Upload and Process]                         │
└─────────────────────────────────────────────────────────────────┘
```

## Success Display (ENHANCED)

### Before (Old)
```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ Upload Successful!                                           │
│                                                                 │
│ Import ID: 12345                                                │
│ Confidence: 87.5%                                               │
│ Rows: 15                                                        │
│                                                                 │
│ [Review Import]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### After (New)
```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ Upload Successful!                                           │
│                                                                 │
│ Import ID: 12345                                                │
│ OCR Engine: Google Vision                                       │
│ Document Type: Scanned Image                                    │
│ Confidence: 92.3%                                               │
│ Rows Detected: 18                                               │
│                                                                 │
│ ⚠️ Validation Warnings:                                         │
│   • Row 5: Missing or empty date                                │
│   • Row 12: Gallons must be greater than 0 (got 0)             │
│   • Row 15: Amount must be greater than 0 (got 0)              │
│   ... and 2 more                                                │
│                                                                 │
│ [Review Import]  [Download CSV]  [Download OCR Text]           │
│                   ↑ Only visible in debug mode                  │
└─────────────────────────────────────────────────────────────────┘
```

## Error Display (ENHANCED)

### Before (Old - Silent Redirect)
```
User uploads file → System processes → Redirects to dashboard
(No error shown, user confused)
```

### After (New - Clear Error)
```
┌─────────────────────────────────────────────────────────────────┐
│ ❌ Upload or Processing Error                                   │
│                                                                 │
│ This PDF appears to be a scanned image. OCR could not read     │
│ the text. Try rescanning with higher contrast.                 │
│                                                                 │
│ Possible causes:                                                │
│ • The PDF may be a low-quality scan                             │
│ • The image contrast may be too low                             │
│ • The document may not contain recognizable delivery ticket     │
│   data                                                          │
└─────────────────────────────────────────────────────────────────┘

(User stays on upload page, can retry)
```

## OCR Processing Indicators

### During Upload
```
┌─────────────────────────────────────────────────────────────────┐
│                       [Uploading...]                            │
│                                                                 │
│                    Processing with OCR...                       │
│                         ⏳ Please wait                          │
└─────────────────────────────────────────────────────────────────┘
```

## Debug Mode Exports

### When Debug Mode Enabled
```
After successful upload, additional buttons appear:

[Download CSV]  - Downloads: parsed-data-12345.csv
                  Contents: All parsed fields in CSV format

[Download OCR Text] - Downloads: ocr-text-12345.txt
                     Contents: Raw OCR text output
```

## Example Success Scenarios

### Scenario 1: High Confidence Import
```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ Upload Successful!                                           │
│                                                                 │
│ Import ID: 67890                                                │
│ OCR Engine: Google Vision                                       │
│ Document Type: Digital Text                                     │
│ Confidence: 98.7%                                               │
│ Rows Detected: 45                                               │
│                                                                 │
│ [Review Import]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Scenario 2: Tesseract Fallback
```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ Upload Successful!                                           │
│                                                                 │
│ Import ID: 11223                                                │
│ OCR Engine: Tesseract                                           │
│ Document Type: Scanned Image                                    │
│ Confidence: 84.2%                                               │
│ Rows Detected: 23                                               │
│                                                                 │
│ [Review Import]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Mobile Responsive

All UI elements are responsive and work on mobile devices:
- Touch-friendly file selection
- Readable text on small screens
- Buttons stack vertically on mobile
- Error messages wrap properly

## Color Scheme

- **Info boxes**: Blue (#EFF6FF border, #DBEAFE background)
- **Success**: Green (#D1FAE5 background, #065F46 text)
- **Errors**: Red (#FEE2E2 background, #991B1B text)
- **Warnings**: Yellow (#FEF3C7 background, #92400E text)

## Accessibility

- Semantic HTML structure
- ARIA labels for screen readers
- Keyboard navigation support
- Clear focus indicators
- High contrast text

## Browser Support

Tested and working on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari
- Mobile Chrome

## Summary of Visual Changes

1. ✅ Added comprehensive help text (3 sections)
2. ✅ Added debug mode toggle
3. ✅ Enhanced success display with detailed metrics
4. ✅ Added validation warnings display
5. ✅ Enhanced error display with troubleshooting
6. ✅ Added export buttons (debug mode)
7. ✅ No more silent redirects
8. ✅ Clear visual feedback for all states

These changes make the upload process transparent and user-friendly, eliminating confusion and making troubleshooting easy.
