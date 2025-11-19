/**
 * Parse Housecall Pro service reports (CSV or XLSX)
 * Handles:
 * - Auto-mapping headers from provided sample columns
 * - Stripping Excel quoted numbers like ="678"
 * - Parsing currency to numeric
 * - Normalizing status values
 * - Deriving job_date from scheduled_start_at or job_created_at
 */

import * as XLSX from "xlsx";

/**
 * Strip Excel formula-quoted strings like ="123" -> 123
 */
function stripExcelQuotes(value) {
  if (typeof value !== "string") return value;
  // Match Excel formula quotes: ="something"
  const match = value.match(/^="([^"]*)"$/);
  if (match) return match[1];
  
  // Also handle standalone = prefix
  if (value.startsWith("=")) {
    return value.substring(1);
  }
  
  return value;
}

/**
 * Normalize header strings for robust matching
 * - Strip BOM (byte order mark)
 * - Remove quotes
 * - Replace NBSP with regular space
 * - Lowercase and trim
 * - Collapse multiple spaces
 */
function normalizeHeader(header) {
  if (!header) return "";
  
  let str = String(header);
  
  // Strip BOM if present (U+FEFF)
  str = str.replace(/^\uFEFF/, "");
  
  // Remove various quote characters
  str = str.replace(/["""'']/g, "");
  
  // Replace NBSP (U+00A0) with regular space
  str = str.replace(/\u00A0/g, " ");
  
  // Lowercase and trim
  str = str.toLowerCase().trim();
  
  // Collapse multiple spaces
  str = str.replace(/\s+/g, " ");
  
  return str;
}

/**
 * Parse currency string to number
 * Handles: $1,234.56 -> 1234.56
 * Also handles multiple periods by keeping only the last one as decimal
 */
function parseCurrency(value) {
  if (value == null || value === "") return null;
  
  let str = String(value).trim();
  
  // Remove currency symbols and whitespace
  str = str.replace(/[$€£¥]/g, "");
  str = str.replace(/\s/g, "");
  
  // Remove commas (thousand separators)
  str = str.replace(/,/g, "");
  
  // Handle multiple periods by keeping only the last one as decimal point
  // e.g., "1.234.56" -> "1234.56"
  const parts = str.split(".");
  if (parts.length > 2) {
    // Multiple periods: join all but last without separator, keep last as decimal
    str = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Normalize job status to standard values
 * Maps Housecall Pro statuses to: scheduled|unschedulled|in_progress|completed|canceled
 */
function normalizeStatus(rawStatus) {
  if (!rawStatus) return "unscheduled";
  
  const lower = String(rawStatus).toLowerCase().trim();
  
  // Completed variants
  if (lower.includes("completed") || lower.includes("done") || lower.includes("finished")) {
    return "completed";
  }
  
  // Canceled variants
  if (lower.includes("cancel") || lower.includes("void")) {
    return "canceled";
  }
  
  // In progress variants
  if (lower.includes("in progress") || lower.includes("active") || lower.includes("working")) {
    return "in_progress";
  }
  
  // Scheduled variants
  if (lower.includes("scheduled") || lower.includes("confirmed") || lower.includes("pending")) {
    return "scheduled";
  }
  
  // Default to unscheduled
  return "unscheduled";
}

/**
 * Parse date string to ISO timestamp
 * Handles various date formats from Housecall Pro
 */
function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Derive job_date from scheduled_start_at or job_created_at
 */
function deriveJobDate(scheduled_start_at, job_created_at) {
  if (scheduled_start_at) {
    const date = new Date(scheduled_start_at);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }
  
  if (job_created_at) {
    const date = new Date(job_created_at);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }
  
  return null;
}

/**
 * Extract primary tech (first in comma-separated list)
 */
function extractPrimaryTech(assigned_employees_raw) {
  if (!assigned_employees_raw) return null;
  const techs = String(assigned_employees_raw).split(",");
  return techs[0]?.trim() || null;
}

/**
 * Column mapping for Housecall Pro export
 * Maps their headers to our database fields
 */
const COLUMN_MAPPINGS = {
  // Job # -> job_number
  "job #": "job_number",
  "job#": "job_number",
  "job number": "job_number",
  
  // Job description -> job_description
  "job description": "job_description",
  "description": "job_description",
  
  // Job status -> raw_status
  "job status": "raw_status",
  "status": "raw_status",
  
  // Customer name -> customer_name
  "customer name": "customer_name",
  "customer": "customer_name",
  
  // Address -> address
  "address": "address",
  "service address": "address",
  
  // Job created date -> job_created_at
  "job created date": "job_created_at",
  "created date": "job_created_at",
  "created": "job_created_at",
  
  // Job scheduled start date -> scheduled_start_at
  "job scheduled start date": "scheduled_start_at",
  "scheduled start date": "scheduled_start_at",
  "scheduled start": "scheduled_start_at",
  "scheduled date": "scheduled_start_at",
  
  // Assigned employees -> assigned_employees_raw
  "assigned employees": "assigned_employees_raw",
  "employees": "assigned_employees_raw",
  "techs": "assigned_employees_raw",
  "technicians": "assigned_employees_raw",
  
  // Job amount -> job_amount
  "job amount": "job_amount",
  "amount": "job_amount",
  "total": "job_amount",
  
  // Due amount -> due_amount
  "due amount": "due_amount",
  "due": "due_amount",
  "balance": "due_amount",
};

/**
 * Map a header to our field name
 */
function mapHeader(header) {
  const normalized = normalizeHeader(header);
  return COLUMN_MAPPINGS[normalized] || null;
}

/**
 * Parse a single row from the upload
 */
function parseRow(rowData, headers) {
  const row = {
    raw: rowData, // Store original for reference
  };
  
  headers.forEach((ourField, index) => {
    if (!ourField) return; // Unmapped column
    
    let value = rowData[index];
    
    // Strip Excel quotes
    value = stripExcelQuotes(value);
    
    // Type-specific parsing
    if (ourField === "job_created_at" || ourField === "scheduled_start_at") {
      row[ourField] = parseDate(value);
    } else if (ourField === "job_amount" || ourField === "due_amount") {
      row[ourField] = parseCurrency(value);
    } else if (ourField === "raw_status") {
      row[ourField] = value;
      row.status = normalizeStatus(value);
    } else {
      row[ourField] = value || null;
    }
  });
  
  // Derive computed fields
  row.job_date = deriveJobDate(row.scheduled_start_at, row.job_created_at);
  row.primary_tech = extractPrimaryTech(row.assigned_employees_raw);
  
  // Detect estimates from job_description, status, or raw_status
  row.is_estimate = 
    /estimate/i.test(row.job_description || "") ||
    /estimate/i.test(row.status || "") ||
    /estimate/i.test(row.raw_status || "");
  
  return row;
}

/**
 * Parse a CSV line respecting quoted fields
 * Handles commas within quotes: "Smith, Bob" stays as one field
 */
function parseCSVLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Toggle quote state
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // Field separator - push current field
      cells.push(current.trim());
      current = "";
    } else {
      // Regular character
      current += char;
    }
  }
  
  // Push last field
  cells.push(current.trim());
  
  return cells;
}

/**
 * Parse CSV text to rows
 */
export function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }
  
  // Parse header row with proper quote handling
  const headerLine = lines[0];
  const csvHeaders = parseCSVLine(headerLine);
  
  // Map to our field names
  const mappedHeaders = csvHeaders.map(h => mapHeader(h));
  
  // Check if we have any mapped fields
  const hasMappedFields = mappedHeaders.some(h => h !== null);
  if (!hasMappedFields) {
    throw new Error("No recognized columns found. Expected Housecall Pro format with headers like: Job #, Job description, Job status, Customer name, etc.");
  }
  
  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV line with quote handling
    const cells = parseCSVLine(line);
    const row = parseRow(cells, mappedHeaders);
    
    // Validate required fields
    if (row.job_number) {
      rows.push(row);
    }
  }
  
  return {
    rows,
    totalRows: rows.length,
    mappedHeaders: mappedHeaders.filter(h => h !== null),
  };
}

/**
 * Parse XLSX file to rows
 */
export function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        
        // Use first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays with header:1 to get raw values
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });
        
        if (rawData.length === 0) {
          throw new Error("Excel file is empty");
        }
        
        // Parse header row with normalization
        const excelHeaders = rawData[0].map(h => String(h || ""));
        const mappedHeaders = excelHeaders.map(h => mapHeader(h));
        
        // Check if we have any mapped fields
        const hasMappedFields = mappedHeaders.some(h => h !== null);
        if (!hasMappedFields) {
          throw new Error("No recognized columns found. Expected Housecall Pro format with headers like: Job #, Job description, Job status, Customer name, etc.");
        }
        
        // Parse data rows
        const rows = [];
        for (let i = 1; i < rawData.length; i++) {
          const rowData = rawData[i];
          if (!rowData || rowData.length === 0) continue;
          
          const row = parseRow(rowData, mappedHeaders);
          
          // Validate required fields
          if (row.job_number) {
            rows.push(row);
          }
        }
        
        resolve({
          rows,
          totalRows: rows.length,
          mappedHeaders: mappedHeaders.filter(h => h !== null),
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Main parser - auto-detects CSV vs XLSX
 */
export async function parseServiceReport(file) {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith(".csv")) {
    const text = await file.text();
    return parseCSV(text);
  } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    return await parseXLSX(file);
  } else {
    throw new Error("Unsupported file format. Please upload a CSV or XLSX file.");
  }
}
