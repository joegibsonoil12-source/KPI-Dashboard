# OCR Setup Guide for Delivery Ticket Importing

This guide explains how to set up and use the OCR-powered delivery ticket importing system.

## Overview

The KPI Dashboard now supports automatic OCR (Optical Character Recognition) for processing scanned delivery tickets. When you upload a scanned PDF or image, the system automatically:

1. Detects if the document is scanned or contains digital text
2. Runs OCR to extract text from images
3. Parses delivery ticket information into structured data
4. Validates the extracted data
5. Imports tickets into the Delivery Tickets table

## Supported Formats

- **PDF** (both scanned and digital text)
- **JPG/JPEG** (scanned images)
- **PNG** (scanned images)
- **GIF** (scanned images)

## OCR Engines

The system supports two OCR engines with automatic fallback:

### 1. Google Vision API (Primary)
- **Accuracy:** Excellent (95%+ confidence on high-quality scans)
- **Speed:** Fast
- **Setup Required:** Yes (API key needed)
- **Cost:** Pay-per-use (see Google Cloud pricing)

### 2. Tesseract.js (Fallback)
- **Accuracy:** Good (80-90% confidence on high-quality scans)
- **Speed:** Moderate
- **Setup Required:** No (automatic)
- **Cost:** Free

## Setup Instructions

### Option 1: Google Vision API (Recommended)

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable the Vision API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Cloud Vision API"
   - Click "Enable"

3. **Create API Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key

4. **Set Environment Variable**
   - Add to your `.env` file or deployment environment:
     ```bash
     GOOGLE_VISION_API_KEY=your_api_key_here
     ```

5. **Optional: Restrict API Key**
   - In Google Cloud Console, edit the API key
   - Restrict to "Cloud Vision API" only
   - Add HTTP referrer restrictions for security

### Option 2: Tesseract Only (No Setup)

If you don't set up Google Vision API, the system will automatically use Tesseract.js:
- No configuration needed
- Slightly lower accuracy
- Still very effective for high-quality scans

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_VISION_API_KEY` | No | - | Google Cloud Vision API key for OCR |
| `AUTO_ACCEPT_HIGH_CONFIDENCE` | No | `false` | Auto-accept imports with confidence >= 95% |

## Usage

### Uploading Scanned Tickets

1. Navigate to the **Upload Scanned Tickets** page
2. Drag and drop your scanned PDF/images or click to browse
3. Click **Upload and Process**
4. The system will:
   - Upload your files
   - Detect if they're scanned or digital
   - Run OCR to extract text
   - Parse delivery ticket data
   - Validate the results
5. Review the results:
   - **Green box:** Success! Shows rows detected and confidence
   - **Red box:** Error occurred (see troubleshooting below)
6. Click **Review Import** to verify and accept the data

### Debug Mode (Admin Only)

Enable debug mode to troubleshoot OCR issues:

1. Check the **Enable Debug Mode** checkbox
2. After upload, you'll see additional buttons:
   - **Download CSV:** Export parsed data as CSV
   - **Download OCR Text:** Export raw OCR text for analysis

Use these exports to:
- Verify OCR accuracy
- Debug parsing issues
- Test different scan qualities

## Best Practices for Scanning

To get the best OCR results:

### Document Preparation
- Use **high-contrast** settings on your scanner
- Ensure documents are **properly aligned** (not skewed)
- Use at least **300 DPI** resolution
- Remove **shadows** and **creases** if possible

### Scan Settings
- **Color Mode:** Grayscale or Black & White
- **Resolution:** 300-600 DPI (higher is better)
- **Format:** PDF or PNG (avoid heavy compression)
- **Brightness/Contrast:** Adjust for maximum readability

### Document Quality
- Text should be **sharp and clear**
- Avoid **blurry** or **out-of-focus** scans
- Minimize **background noise** and **artifacts**
- Ensure **uniform lighting**

## Troubleshooting

### Error: "OCR could not read the text"

**Possible causes:**
- Scan quality is too low
- Document is skewed or rotated
- Text is too small or blurry
- Heavy shadows or poor contrast

**Solutions:**
- Rescan with higher resolution (600 DPI)
- Ensure document is straight
- Increase contrast in scan settings
- Use better lighting when scanning

### Error: "No ticket rows were detected"

**Possible causes:**
- Document doesn't contain a delivery ticket table
- Table format is not recognized
- OCR failed to extract structured data

**Solutions:**
- Verify document contains a ticket table
- Enable debug mode and check OCR text
- Adjust scan quality and retry
- Contact support with a sample document

### Error: "Validation warnings"

**Possible causes:**
- Some rows are missing required fields
- Numeric values couldn't be parsed
- Dates are in unexpected format

**Solutions:**
- Review the warnings in the UI
- Check the Review Import page for details
- Edit problematic rows manually
- Adjust parsing rules if needed

### Low Confidence Score

**Possible causes:**
- Scan quality is marginal
- Text recognition had uncertainties
- Document contains unusual fonts

**Solutions:**
- Rescan with higher quality
- Review parsed data carefully before accepting
- Use debug mode to inspect OCR output

## Field Mapping

The system automatically maps delivery ticket columns to database fields:

| Common Header Names | Database Field |
|---------------------|----------------|
| Ticket #, Record, Rec | `ticketNumber` |
| Account, Acct, Acc # | `account` |
| Customer, Client, Name | `customer` |
| Driver, Operator, Del By | `driver` |
| Truck, Vehicle, Unit | `truck` |
| Date, Delivered, Del Date | `date` |
| Product, Fuel, Type | `product` |
| Gallons, Qty, Quantity, Gal | `qty` |
| Price, Rate, Unit Price | `price` |
| Tax, HST, GST | `tax` |
| Amount, Total, Extension, Ext | `amount` |

The parser is flexible and recognizes many variations of these headers.

## Validation Rules

Imported tickets must meet these requirements:

1. **Required Fields:**
   - Date (must be present)
   - Gallons (must be > 0)
   - Amount (must be > 0)

2. **Numeric Fields:**
   - Gallons, Price, Tax, Amount must be valid numbers
   - Negative values are rejected

3. **Unique Constraints:**
   - Ticket numbers should be unique per import

Rows that fail validation will be flagged but not automatically rejected. You can review and fix them before final import.

## Performance

### Processing Times

| File Size | Pages | Typical Time |
|-----------|-------|--------------|
| < 1 MB | 1-5 | 5-15 seconds |
| 1-5 MB | 5-20 | 15-45 seconds |
| 5-10 MB | 20-50 | 45-90 seconds |

Processing time depends on:
- Number of pages
- Image resolution
- OCR engine used
- Network speed (for Google Vision)

### Rate Limits

**Google Vision API:**
- Free tier: 1,000 requests/month
- Paid tier: Unlimited (with costs)
- Rate limit: 1,800 requests/minute

**Tesseract.js:**
- No rate limits
- Runs locally in the browser/server

## Cost Estimation

### Google Vision API Costs

- First 1,000 requests/month: **Free**
- After 1,000: **$1.50 per 1,000 requests**

**Example scenarios:**
- 100 tickets/month: **Free**
- 2,000 tickets/month: **~$1.50/month**
- 10,000 tickets/month: **~$13.50/month**

See [Google Vision Pricing](https://cloud.google.com/vision/pricing) for current rates.

### Tesseract.js Costs

- **Always free** (open source)
- No API costs
- Minimal compute overhead

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Use debug mode to export OCR text and parsed data
3. Contact your system administrator
4. Report issues on the project GitHub page

## Advanced Configuration

### Auto-Accept High Confidence Imports

Set this environment variable to automatically accept imports with 95%+ confidence:

```bash
AUTO_ACCEPT_HIGH_CONFIDENCE=true
```

**Warning:** Only enable this if you trust the OCR quality and validation rules.

### Custom Field Mapping

To customize field mapping, edit `server/lib/ocrParser.js`:

```javascript
const headerPatterns = {
  customField: /pattern|variation1|variation2/i,
  // Add your custom mappings here
};
```

### Preprocessing Options

The system automatically applies these preprocessing steps:
- Grayscale conversion
- Brightness/contrast normalization
- Sharpening
- Binarization (threshold at 128)

To adjust preprocessing, modify the `preprocessImage()` function in `server/lib/ocrParser.js`.

## Security Considerations

1. **API Key Protection:**
   - Never commit API keys to version control
   - Use environment variables
   - Restrict API keys to specific domains/IPs

2. **File Upload Validation:**
   - Only supported file types are accepted
   - File size limits are enforced
   - Malicious files are rejected

3. **Data Privacy:**
   - Uploaded files are stored securely in Supabase
   - OCR processing happens server-side
   - No data is sent to third parties (except Google Vision API if configured)

## Changelog

### Version 1.0 (2025)
- Initial OCR implementation
- Google Vision API integration
- Tesseract.js fallback
- PDF text layer detection
- Image preprocessing
- Delivery ticket validation
- Debug/export mode
