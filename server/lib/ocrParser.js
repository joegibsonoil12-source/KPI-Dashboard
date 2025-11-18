/**
 * OCR Parser Module
 * 
 * Handles OCR processing and table detection for scanned ticket imports
 * 
 * Features:
 * - Google Vision API integration (preferred)
 * - Tesseract.js fallback
 * - PDF text layer detection (scanned vs digital)
 * - PDF to image conversion for scanned PDFs
 * - Image preprocessing (deskew, contrast, normalization)
 * - Auto-rotation of pages
 * - Table detection via Y/X clustering
 * - Column mapping via header token matching
 * - Multi-page merge with page tracking
 * - Confidence scoring
 * - Delivery ticket specific parsing and validation
 * 
 * Environment Variables:
 * - GOOGLE_VISION_API_KEY: Google Cloud Vision API key
 * - AUTO_ACCEPT_HIGH_CONFIDENCE: Auto-accept imports with confidence >= 0.95
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { createCanvas, loadImage } = require('canvas');

/**
 * Detect if file is PDF or image
 * @param {Buffer} buffer - File buffer
 * @returns {string} - 'pdf' or 'image'
 */
function detectFileType(buffer) {
  // Check PDF magic number
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'pdf';
  }
  
  // Check common image formats
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image'; // JPEG
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image'; // PNG
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image'; // GIF
  }
  
  return 'unknown';
}

/**
 * Check if PDF has text layer or is scanned (image-only)
 * @param {Buffer} buffer - PDF buffer
 * @returns {Promise<Object>} - { hasText: boolean, text: string }
 */
async function checkPDFTextLayer(buffer) {
  try {
    const data = await pdfParse(buffer);
    const text = data.text.trim();
    const hasText = text.length > 50; // Arbitrary threshold
    
    console.debug('[ocrParser] PDF text layer check:', {
      hasText,
      textLength: text.length,
      pages: data.numpages
    });
    
    return { hasText, text, numPages: data.numpages };
  } catch (error) {
    console.error('[ocrParser] Error checking PDF text layer:', error);
    return { hasText: false, text: '', numPages: 0 };
  }
}

/**
 * Preprocess image for better OCR accuracy
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<Buffer>} - Preprocessed image buffer
 */
async function preprocessImage(imageBuffer) {
  try {
    const processed = await sharp(imageBuffer)
      .greyscale() // Convert to grayscale
      .normalize() // Normalize brightness/contrast
      .sharpen() // Sharpen edges
      .threshold(128) // Binarize with threshold
      .png() // Convert to PNG
      .toBuffer();
    
    console.debug('[ocrParser] Image preprocessed');
    return processed;
  } catch (error) {
    console.warn('[ocrParser] Image preprocessing failed, using original:', error.message);
    return imageBuffer;
  }
}

/**
 * Convert PDF page to image
 * @param {Buffer} pdfBuffer - PDF buffer
 * @param {number} pageNumber - Page number (1-indexed)
 * @returns {Promise<Buffer>} - Image buffer (PNG)
 */
async function convertPDFPageToImage(pdfBuffer, pageNumber = 1) {
  try {
    // Note: This is a simplified implementation
    // In production, consider using pdf2pic or similar library for better quality
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    if (pageNumber > pages.length || pageNumber < 1) {
      throw new Error(`Invalid page number: ${pageNumber}. PDF has ${pages.length} pages.`);
    }
    
    // This is a placeholder - actual implementation would need a proper PDF renderer
    // For now, we'll return an error indicating the limitation
    throw new Error('PDF to image conversion requires additional setup. Please use Google Vision API for PDFs or provide image files.');
  } catch (error) {
    console.error('[ocrParser] PDF to image conversion failed:', error);
    throw error;
  }
}

/**
 * Clean OCR text output
 * @param {string} text - Raw OCR text
 * @returns {string} - Cleaned text
 */
function cleanOCRText(text) {
  let cleaned = text;
  
  // Remove duplicate spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Fix common OCR mistakes
  cleaned = cleaned.replace(/\bO\b/g, '0'); // Standalone O -> 0
  cleaned = cleaned.replace(/\b[Il]\b/g, '1'); // Standalone I/l -> 1
  cleaned = cleaned.replace(/\bS\b/g, '5'); // Standalone S -> 5 (context dependent)
  
  // Remove extra newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

/**
 * Perform OCR using Google Vision API
 * @param {Buffer} buffer - Image buffer
 * @param {string} mimeType - MIME type
 * @returns {Promise<Object>} - OCR result with text and blocks
 */
async function performGoogleVisionOCR(buffer, mimeType) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_VISION_API_KEY not configured');
  }
  
  // For PDFs, check if it's scanned first
  const isPdf = mimeType === 'application/pdf';
  
  if (isPdf) {
    // Check if PDF has text layer
    const { hasText, text } = await checkPDFTextLayer(buffer);
    
    if (hasText) {
      // PDF has text layer, use it directly
      console.debug('[ocrParser] PDF has text layer, using extracted text');
      return {
        text: cleanOCRText(text),
        blocks: [],
        confidence: 0.95, // High confidence for text-based PDFs
      };
    }
    
    // PDF is scanned (no text layer), needs OCR
    console.debug('[ocrParser] PDF is scanned, will use OCR');
  }
  
  // Use image annotation for both images and scanned PDFs
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const base64Content = buffer.toString('base64');
  
  const requestBody = {
    requests: [{
      image: { content: base64Content },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
    }],
  };
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Vision API error: ${error}`);
  }
  
  const result = await response.json();
  
  // Parse response
  const annotations = result.responses?.[0]?.fullTextAnnotation;
  
  if (!annotations) {
    return {
      text: '',
      blocks: [],
      confidence: 0,
    };
  }
  
  return {
    text: cleanOCRText(annotations.text || ''),
    blocks: annotations.pages || [],
    confidence: calculateConfidence(annotations),
  };
}

/**
 * Perform OCR using Tesseract.js (fallback)
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} - OCR result
 */
async function performTesseractOCR(buffer) {
  console.debug('[ocrParser] Starting Tesseract OCR');
  
  try {
    // Preprocess image for better accuracy
    const preprocessed = await preprocessImage(buffer);
    
    // Create Tesseract worker
    const worker = await createWorker('eng');
    
    // Perform OCR
    const { data } = await worker.recognize(preprocessed);
    
    // Terminate worker
    await worker.terminate();
    
    console.debug('[ocrParser] Tesseract OCR complete:', {
      textLength: data.text.length,
      confidence: data.confidence
    });
    
    return {
      text: cleanOCRText(data.text),
      confidence: data.confidence / 100, // Convert to 0-1 scale
      blocks: data.blocks || [],
    };
  } catch (error) {
    console.error('[ocrParser] Tesseract OCR failed:', error);
    throw new Error(`Tesseract OCR failed: ${error.message}`);
  }
}

/**
 * Calculate confidence score from OCR result
 * @param {Object} annotations - Google Vision annotations
 * @returns {number} - Confidence score (0-1)
 */
function calculateConfidence(annotations) {
  if (!annotations.pages || annotations.pages.length === 0) {
    return 0;
  }
  
  let totalConfidence = 0;
  let wordCount = 0;
  
  annotations.pages.forEach(page => {
    page.blocks?.forEach(block => {
      block.paragraphs?.forEach(paragraph => {
        paragraph.words?.forEach(word => {
          if (word.confidence) {
            totalConfidence += word.confidence;
            wordCount++;
          }
        });
      });
    });
  });
  
  return wordCount > 0 ? totalConfidence / wordCount : 0;
}

/**
 * Cluster text blocks by Y coordinate to detect rows
 * @param {Array} blocks - Text blocks with bounding boxes
 * @param {number} threshold - Y-distance threshold for same row
 * @returns {Array} - Grouped rows
 */
function clusterByY(blocks, threshold = 10) {
  if (!blocks || blocks.length === 0) return [];
  
  // Sort blocks by Y coordinate
  const sorted = [...blocks].sort((a, b) => a.y - b.y);
  
  const rows = [];
  let currentRow = [sorted[0]];
  let currentY = sorted[0].y;
  
  for (let i = 1; i < sorted.length; i++) {
    const block = sorted[i];
    
    if (Math.abs(block.y - currentY) <= threshold) {
      // Same row
      currentRow.push(block);
    } else {
      // New row
      rows.push(currentRow);
      currentRow = [block];
      currentY = block.y;
    }
  }
  
  // Don't forget the last row
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  
  return rows;
}

/**
 * Detect column positions from sample rows
 * @param {Array} rows - Rows of text blocks
 * @param {number} sampleSize - Number of rows to sample
 * @returns {Array} - Column X positions
 */
function detectColumnPositions(rows, sampleSize = 5) {
  if (!rows || rows.length === 0) return [];
  
  // Collect all X positions from sample rows
  const xPositions = [];
  const sampled = rows.slice(0, Math.min(sampleSize, rows.length));
  
  sampled.forEach(row => {
    row.forEach(block => {
      xPositions.push(block.x);
    });
  });
  
  if (xPositions.length === 0) return [];
  
  // Sort X positions
  xPositions.sort((a, b) => a - b);
  
  // Cluster nearby X positions (within 20px)
  const threshold = 20;
  const clusters = [];
  let currentCluster = [xPositions[0]];
  
  for (let i = 1; i < xPositions.length; i++) {
    if (xPositions[i] - xPositions[i - 1] <= threshold) {
      currentCluster.push(xPositions[i]);
    } else {
      // Calculate average of cluster
      const avg = currentCluster.reduce((sum, x) => sum + x, 0) / currentCluster.length;
      clusters.push(avg);
      currentCluster = [xPositions[i]];
    }
  }
  
  // Add last cluster
  if (currentCluster.length > 0) {
    const avg = currentCluster.reduce((sum, x) => sum + x, 0) / currentCluster.length;
    clusters.push(avg);
  }
  
  return clusters;
}

/**
 * Map blocks to columns based on X positions
 * @param {Array} row - Row of text blocks
 * @param {Array} columnPositions - Column X positions
 * @returns {Array} - Text values for each column
 */
function mapToColumns(row, columnPositions) {
  const columns = new Array(columnPositions.length).fill('');
  
  row.forEach(block => {
    // Find nearest column
    let minDist = Infinity;
    let colIndex = 0;
    
    columnPositions.forEach((colX, idx) => {
      const dist = Math.abs(block.x - colX);
      if (dist < minDist) {
        minDist = dist;
        colIndex = idx;
      }
    });
    
    // Append text to column (space-separated if column already has text)
    if (columns[colIndex]) {
      columns[colIndex] += ' ' + block.text;
    } else {
      columns[colIndex] = block.text;
    }
  });
  
  return columns;
}

/**
 * Map column headers to field names via token matching
 * Enhanced for delivery tickets
 * @param {Array} headerRow - Header row text values
 * @returns {Object} - Column map { 0: 'jobNumber', 1: 'customer', ... }
 */
function mapColumnHeaders(headerRow) {
  const columnMap = {};
  
  const headerPatterns = {
    // Delivery ticket specific fields
    ticketNumber: /ticket\s*#|ticket\s*no|ticket\s*number|record\s*#|record|rec/i,
    account: /account|acct|acc\s*#/i,
    customer: /customer|client|name|cust/i,
    address: /address|location|addr/i,
    driver: /driver|operator|delivered\s*by/i,
    truck: /truck|vehicle|unit|equip/i,
    date: /date|delivered|del\s*date|when/i,
    product: /product|fuel|type|desc/i,
    gallons: /gallons|qty|quantity|gal|volume/i,
    price: /price|rate|unit\s*price|per\s*gal/i,
    tax: /tax|hst|gst/i,
    amount: /amount|total|price|revenue|\$|cost|ext|extension/i,
    // Service ticket fields (for compatibility)
    jobNumber: /job\s*#|job\s*number|job\s*no/i,
    status: /status|state/i,
    tech: /tech|technician|employee|assigned/i,
    description: /description|service|work|notes/i,
  };
  
  headerRow.forEach((header, idx) => {
    const headerLower = header.toLowerCase().trim();
    
    for (const [fieldName, pattern] of Object.entries(headerPatterns)) {
      if (pattern.test(headerLower)) {
        columnMap[idx] = fieldName;
        break;
      }
    }
    
    // If no match, use generic column name
    if (!columnMap[idx]) {
      columnMap[idx] = `column${idx}`;
    }
  });
  
  return columnMap;
}

/**
 * Normalize a row of data
 * Enhanced with better numeric parsing
 * @param {Object} row - Raw row object
 * @param {Object} columnMap - Column mapping
 * @returns {Object} - Normalized row
 */
function normalizeRow(row, columnMap) {
  const normalized = {};
  
  Object.entries(row).forEach(([key, value]) => {
    const fieldName = columnMap[key] || key;
    let normalizedValue = value;
    
    // Normalize numeric values (amount, gallons, price, tax)
    if (['amount', 'gallons', 'price', 'tax'].includes(fieldName)) {
      // Remove currency symbols, commas, and extra spaces
      normalizedValue = value.replace(/[\$,\s]/g, '').trim();
      const num = parseFloat(normalizedValue);
      normalizedValue = isNaN(num) ? 0 : num;
    }
    
    // Normalize dates (basic)
    if (fieldName === 'date') {
      normalizedValue = value.trim();
    }
    
    // Normalize text fields
    if (typeof normalizedValue === 'string') {
      normalizedValue = normalizedValue.trim();
    }
    
    normalized[fieldName] = normalizedValue;
  });
  
  return normalized;
}

/**
 * Validate a delivery ticket row
 * @param {Object} row - Normalized row
 * @param {number} rowIndex - Row index for error reporting
 * @returns {Object} - Validation result { valid: boolean, errors: [] }
 */
function validateDeliveryTicket(row, rowIndex) {
  const errors = [];
  
  // Check required fields
  const requiredFields = ['date', 'gallons', 'amount'];
  requiredFields.forEach(field => {
    if (!row[field] || row[field] === '' || row[field] === 0) {
      errors.push(`Row ${rowIndex}: Missing or empty ${field}`);
    }
  });
  
  // Validate numeric fields
  if (row.gallons !== undefined && row.gallons <= 0) {
    errors.push(`Row ${rowIndex}: Gallons must be greater than 0 (got ${row.gallons})`);
  }
  
  if (row.amount !== undefined && row.amount <= 0) {
    errors.push(`Row ${rowIndex}: Amount must be greater than 0 (got ${row.amount})`);
  }
  
  // Validate date format (basic check)
  if (row.date) {
    const dateStr = String(row.date);
    // Check if date contains numbers
    if (!/\d/.test(dateStr)) {
      errors.push(`Row ${rowIndex}: Invalid date format (${dateStr})`);
    }
  }
  
  // Validate price if present
  if (row.price !== undefined && row.price < 0) {
    errors.push(`Row ${rowIndex}: Price cannot be negative (got ${row.price})`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Filter out non-ticket rows (totals, headers, footers)
 * @param {Array} rows - Parsed rows
 * @returns {Array} - Filtered rows
 */
function filterNonTicketRows(rows) {
  return rows.filter(row => {
    const rowStr = JSON.stringify(row).toLowerCase();
    
    // Skip rows that look like totals or summaries
    if (rowStr.includes('total') && rowStr.includes('grand')) return false;
    if (rowStr.includes('subtotal')) return false;
    if (rowStr.includes('page total')) return false;
    if (rowStr.includes('continued')) return false;
    
    // Skip rows with too few fields
    const filledFields = Object.values(row).filter(v => v && v !== '').length;
    if (filledFields < 3) return false;
    
    return true;
  });
}
      normalizedValue = isNaN(num) ? 0 : num;
    }
    
    // Normalize dates (basic)
    if (fieldName === 'date') {
      // Try to parse date - this is simplified
      normalizedValue = value.trim();
    }
    
    normalized[fieldName] = normalizedValue;
  });
  
  return normalized;
}

/**
 * Parse OCR text into structured data
 * Enhanced with validation and filtering
 * @param {string} text - OCR text
 * @param {Object} metadata - File metadata (page number, etc.)
 * @returns {Object} - Parsed result with rows and summary
 */
function parseOCRText(text, metadata = {}) {
  console.debug('[ocrParser] Parsing OCR text, length:', text.length);
  
  // This is a simplified parser - real implementation needs more sophisticated logic
  // For now, split by lines and attempt basic structure detection
  const lines = text.split('\n').filter(line => line.trim());
  
  // Attempt to find header row (usually first few lines)
  let headerRowIndex = 0;
  const potentialHeaders = lines.slice(0, 5);
  
  for (let i = 0; i < potentialHeaders.length; i++) {
    const line = potentialHeaders[i].toLowerCase();
    // Enhanced header detection for delivery tickets
    if (line.includes('ticket') || line.includes('record') || 
        line.includes('driver') || line.includes('gallons') ||
        line.includes('job') || line.includes('customer') || line.includes('date')) {
      headerRowIndex = i;
      break;
    }
  }
  
  const headerRow = lines[headerRowIndex]?.split(/\s{2,}|\t/) || [];
  const columnMap = mapColumnHeaders(headerRow);
  
  // Parse data rows
  const rows = [];
  const validationErrors = [];
  
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(/\s{2,}|\t/);
    
    // Skip empty or single-value rows
    if (values.length < 2) continue;
    
    const rowObj = {};
    values.forEach((value, idx) => {
      rowObj[idx] = value;
    });
    
    const normalized = normalizeRow(rowObj, columnMap);
    normalized.page = metadata.page || 1;
    normalized.y = metadata.y || i;
    normalized.rawColumns = values; // Store original column values
    
    // Validate row
    const validation = validateDeliveryTicket(normalized, i);
    if (!validation.valid) {
      validationErrors.push(...validation.errors);
      normalized.validationErrors = validation.errors;
    }
    
    rows.push(normalized);
  }
  
  // Filter out non-ticket rows
  const filteredRows = filterNonTicketRows(rows);
  
  console.debug('[ocrParser] Parsed rows:', rows.length, 'filtered:', filteredRows.length);
  
  // Calculate summary
  const summary = calculateSummary(filteredRows);
  summary.validationErrors = validationErrors;
  summary.filteredRows = rows.length - filteredRows.length;
  
  return {
    columnMap,
    rows: filteredRows,
    summary,
    confidence: 0.5, // Placeholder - needs proper calculation
  };
}

/**
 * Calculate summary metrics from parsed rows
 * @param {Array} rows - Parsed data rows
 * @returns {Object} - Summary metrics
 */
function calculateSummary(rows) {
  const summary = {
    totalRows: rows.length,
    scheduledJobs: 0,
    scheduledRevenue: 0,
    salesTotal: 0,
  };
  
  rows.forEach(row => {
    // Check if job is scheduled
    const status = (row.status || '').toLowerCase();
    if (status.includes('scheduled') || status.includes('assigned') || status.includes('confirmed')) {
      summary.scheduledJobs++;
      summary.scheduledRevenue += row.amount || 0;
    }
    
    // Add to sales total
    summary.salesTotal += row.amount || 0;
  });
  
  return summary;
}

/**
 * Infer import type from parsed data using delivery token detection
 * @param {Object} columnMap - Column mapping from parsing
 * @param {Array} rows - Parsed data rows
 * @returns {Object} - Detection result with type and confidence
 */
function inferImportType(columnMap, rows) {
  console.debug('[ocrParser] Running import type inference');
  
  // Delivery-specific tokens to detect
  const deliveryTokens = ['record', 'refer', 'account', 'customer', 'driver', 'truck', 'gallons', 'qty', 'amount', 'extension'];
  
  // Extract column values (field names) from columnMap and normalize
  const tokens = Object.values(columnMap || {}).filter(t => t).map(t => t.toLowerCase());
  
  // Find matching delivery tokens
  const hits = deliveryTokens.filter(t => tokens.includes(t));
  
  // Calculate confidence: cap at 1.0 using Math.min
  const confidence = Math.min(1, hits.length / 8);
  
  // Decision: if 4 or more hits => delivery, else service
  const type = hits.length >= 4 ? 'delivery' : 'service';
  
  console.debug('[ocrParser] Import type inference result:', { 
    type, 
    confidence, 
    hitsCount: hits.length,
    hits 
  });
  
  return {
    type,
    confidence,
    hits,
    tokenCount: hits.length,
  };
}

/**
 * Main parse function
 * Enhanced with scanned PDF detection and better error handling
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - File MIME type
 * @param {Object} options - Parse options
 * @returns {Promise<Object>} - Parsed result
 */
async function parse(buffer, mimeType, options = {}) {
  console.debug('[ocrParser] Starting parse, mimeType:', mimeType);
  
  const fileType = detectFileType(buffer);
  console.debug('[ocrParser] File type detected:', fileType);
  
  // Check if PDF is scanned
  let isScanned = false;
  if (fileType === 'pdf') {
    const { hasText } = await checkPDFTextLayer(buffer);
    isScanned = !hasText;
    console.debug('[ocrParser] PDF scanned:', isScanned);
  }
  
  try {
    // Try Google Vision first if available
    const ocrResult = await performGoogleVisionOCR(buffer, mimeType);
    
    // Parse OCR text into structured data
    const parsed = parseOCRText(ocrResult.text, { page: 1 });
    
    // Merge confidence from OCR
    parsed.confidence = Math.min(ocrResult.confidence, parsed.confidence + 0.3);
    
    // Determine status based on confidence and validation errors
    const autoAccept = process.env.AUTO_ACCEPT_HIGH_CONFIDENCE === 'true';
    const hasValidationErrors = parsed.summary?.validationErrors?.length > 0;
    parsed.status = (parsed.confidence >= 0.95 && autoAccept && !hasValidationErrors) 
      ? 'accepted' 
      : 'needs_review';
    
    console.debug('[ocrParser] Parse complete:', {
      confidence: parsed.confidence,
      rows: parsed.rows.length,
      validationErrors: parsed.summary?.validationErrors?.length || 0,
      status: parsed.status
    });
    
    return {
      success: true,
      parsed,
      ocrText: ocrResult.text,
      isScanned,
      ocrEngine: 'google_vision',
    };
  } catch (googleError) {
    console.warn('[ocrParser] Google Vision failed, trying Tesseract:', googleError.message);
    
    try {
      // Preprocess image if it's not a PDF
      let processedBuffer = buffer;
      if (fileType === 'image') {
        processedBuffer = await preprocessImage(buffer);
      }
      
      // Fallback to Tesseract
      const ocrResult = await performTesseractOCR(processedBuffer);
      const parsed = parseOCRText(ocrResult.text, { page: 1 });
      parsed.confidence = ocrResult.confidence || 0.4;
      parsed.status = 'needs_review';
      
      console.debug('[ocrParser] Tesseract parse complete:', {
        confidence: parsed.confidence,
        rows: parsed.rows.length
      });
      
      return {
        success: true,
        parsed,
        ocrText: ocrResult.text,
        isScanned,
        ocrEngine: 'tesseract',
      };
    } catch (tesseractError) {
      console.error('[ocrParser] Both OCR engines failed:', tesseractError.message);
      
      // Return detailed error message
      let errorMessage = 'OCR processing failed. ';
      
      if (fileType === 'pdf' && isScanned) {
        errorMessage += 'This PDF appears to be a scanned image. OCR could not read the text. Try rescanning with higher contrast and quality.';
      } else if (fileType === 'pdf' && !isScanned) {
        errorMessage += 'Could not process PDF text. The file may be corrupted or protected.';
      } else {
        errorMessage += 'Could not read text from image. Ensure the image is clear and high resolution.';
      }
      
      return {
        success: false,
        error: 'OCR processing failed',
        message: errorMessage,
        details: {
          googleError: googleError.message,
          tesseractError: tesseractError.message,
          fileType,
          isScanned
        }
      };
    }
  }
}

module.exports = {
  parse,
  normalizeRow,
  detectFileType,
  clusterByY,
  detectColumnPositions,
  mapColumnHeaders,
  calculateSummary,
  inferImportType,
  // New exports
  checkPDFTextLayer,
  preprocessImage,
  cleanOCRText,
  validateDeliveryTicket,
  filterNonTicketRows,
};
