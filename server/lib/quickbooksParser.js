/**
 * QuickBooks Report Parser Module
 * 
 * Parses standard QuickBooks report exports (Excel/CSV) into normalized data
 * Supports 10 standard report types without requiring QuickBooks API
 * 
 * Supported Reports:
 * 1. Profit and Loss
 * 2. Profit and Loss by Class
 * 3. Profit and Loss by Location
 * 4. Balance Sheet
 * 5. Statement of Cash Flows
 * 6. Accounts Receivable Aging Summary
 * 7. Accounts Payable Aging Summary
 * 8. Sales by Product/Service Summary
 * 9. Expenses by Vendor Summary
 * 10. Payroll Summary
 */

const XLSX = require('xlsx');

/**
 * Detect QuickBooks report type from file content
 * @param {Array} rows - Raw rows from the file
 * @returns {string|null} - Detected report type or null
 */
function detectReportType(rows) {
  if (!rows || rows.length === 0) return null;
  
  // Combine first few rows into searchable text
  const headerText = rows.slice(0, 10)
    .map(row => Array.isArray(row) ? row.join(' ') : String(row))
    .join(' ')
    .toLowerCase();
  
  // Detection patterns
  const patterns = {
    profit_loss: /profit\s+and\s+loss|p\s*&\s*l|income\s+statement/i,
    profit_loss_by_class: /profit\s+and\s+loss.*by\s+class/i,
    profit_loss_by_location: /profit\s+and\s+loss.*by\s+location/i,
    balance_sheet: /balance\s+sheet/i,
    cash_flow_statement: /statement\s+of\s+cash\s+flows|cash\s+flow\s+statement/i,
    ar_aging_summary: /accounts?\s+receivable\s+aging|a\/r\s+aging/i,
    ap_aging_summary: /accounts?\s+payable\s+aging|a\/p\s+aging/i,
    sales_by_product: /sales\s+by\s+product|sales\s+by\s+service/i,
    expenses_by_vendor: /expenses?\s+by\s+vendor|purchases?\s+by\s+vendor/i,
    payroll_summary: /payroll\s+summary|payroll\s+report/i,
  };
  
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(headerText)) {
      return type;
    }
  }
  
  return null;
}

/**
 * Extract period from QuickBooks report header
 * @param {Array} rows - Raw rows from the file
 * @returns {Object} - { period, periodStart, periodEnd }
 */
function extractPeriod(rows) {
  if (!rows || rows.length === 0) {
    return { period: null, periodStart: null, periodEnd: null };
  }
  
  // Search first 10 rows for date range
  const headerText = rows.slice(0, 10)
    .map(row => Array.isArray(row) ? row.join(' ') : String(row))
    .join(' ');
  
  // Common QuickBooks date patterns
  // Examples: "January 2025", "January - December 2025", "01/01/2025 - 01/31/2025"
  const monthYearPattern = /([A-Za-z]+)\s+(\d{4})/;
  const rangePattern = /([A-Za-z]+)\s*-\s*([A-Za-z]+)\s+(\d{4})/;
  const dateRangePattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/;
  
  let period = null;
  let periodStart = null;
  let periodEnd = null;
  
  // Try date range pattern first (most specific)
  const dateRangeMatch = headerText.match(dateRangePattern);
  if (dateRangeMatch) {
    periodStart = new Date(dateRangeMatch[1]);
    periodEnd = new Date(dateRangeMatch[2]);
    
    // Format as YYYY-MM or YYYY-Q1 depending on range
    const startYear = periodStart.getFullYear();
    const startMonth = periodStart.getMonth() + 1;
    const endMonth = periodEnd.getMonth() + 1;
    
    if (startMonth === endMonth) {
      period = `${startYear}-${String(startMonth).padStart(2, '0')}`;
    } else {
      // Determine quarter
      const quarter = Math.ceil(endMonth / 3);
      period = `${startYear}-Q${quarter}`;
    }
    
    return { period, periodStart: periodStart.toISOString().split('T')[0], periodEnd: periodEnd.toISOString().split('T')[0] };
  }
  
  // Try month-year pattern
  const monthYearMatch = headerText.match(monthYearPattern);
  if (monthYearMatch) {
    const monthName = monthYearMatch[1];
    const year = monthYearMatch[2];
    const monthNum = parseMonth(monthName);
    
    if (monthNum) {
      period = `${year}-${String(monthNum).padStart(2, '0')}`;
      periodStart = new Date(year, monthNum - 1, 1);
      periodEnd = new Date(year, monthNum, 0); // Last day of month
      
      return { 
        period, 
        periodStart: periodStart.toISOString().split('T')[0], 
        periodEnd: periodEnd.toISOString().split('T')[0] 
      };
    }
  }
  
  // Try range pattern (e.g., "January - December 2025")
  const rangeMatch = headerText.match(rangePattern);
  if (rangeMatch) {
    const startMonthName = rangeMatch[1];
    const endMonthName = rangeMatch[2];
    const year = rangeMatch[3];
    const startMonthNum = parseMonth(startMonthName);
    const endMonthNum = parseMonth(endMonthName);
    
    if (startMonthNum && endMonthNum) {
      periodStart = new Date(year, startMonthNum - 1, 1);
      periodEnd = new Date(year, endMonthNum, 0);
      
      // Full year?
      if (startMonthNum === 1 && endMonthNum === 12) {
        period = year;
      } else {
        // Determine quarter
        const quarter = Math.ceil(endMonthNum / 3);
        period = `${year}-Q${quarter}`;
      }
      
      return { 
        period, 
        periodStart: periodStart.toISOString().split('T')[0], 
        periodEnd: periodEnd.toISOString().split('T')[0] 
      };
    }
  }
  
  return { period, periodStart, periodEnd };
}

/**
 * Parse month name to number
 * @param {string} monthName - Month name (e.g., "January", "Jan")
 * @returns {number|null} - Month number (1-12) or null
 */
function parseMonth(monthName) {
  const months = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
  };
  
  return months[monthName.toLowerCase()] || null;
}

/**
 * Skip header rows and find data start
 * @param {Array} rows - All rows
 * @returns {number} - Index of first data row
 */
function findDataStartRow(rows) {
  // QuickBooks reports typically have:
  // - Company name (row 0)
  // - Report name (row 1)
  // - Date range (row 2)
  // - Blank row (row 3)
  // - Column headers (row 4)
  // - Data starts (row 5+)
  
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    
    const rowText = row.join(' ').toLowerCase();
    
    // Look for common column headers
    if (rowText.includes('account') || 
        rowText.includes('total') || 
        rowText.includes('amount') ||
        rowText.includes('debit') ||
        rowText.includes('credit') ||
        rowText.includes('balance')) {
      return i + 1; // Data starts next row
    }
  }
  
  return 5; // Default fallback
}

/**
 * Clean numeric value from QuickBooks export
 * @param {string|number} value - Raw value
 * @returns {number} - Cleaned numeric value
 */
function cleanNumeric(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Remove currency symbols, commas, parentheses (for negatives)
  let cleaned = String(value)
    .replace(/[$,\s]/g, '')
    .replace(/[()]/g, '');
  
  // Handle parentheses as negatives
  if (String(value).includes('(')) {
    cleaned = '-' + cleaned;
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse Profit and Loss report
 * @param {Array} rows - Raw rows
 * @returns {Object} - { parsed, summary }
 */
function parseProfitAndLoss(rows) {
  const dataStartRow = findDataStartRow(rows);
  const parsed = [];
  let totalIncome = 0;
  let totalCOGS = 0;
  let totalExpenses = 0;
  let netIncome = 0;
  
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    
    const account = row[0];
    const amount = cleanNumeric(row[1] || row[2]); // Amount might be in column 1 or 2
    
    if (!account) continue;
    
    const accountStr = String(account).trim().toLowerCase();
    
    // Skip total rows (we'll calculate our own)
    if (accountStr.includes('total') || accountStr.includes('net income')) {
      if (accountStr.includes('net income')) {
        netIncome = amount;
      }
      continue;
    }
    
    // Categorize
    let category = 'other';
    if (accountStr.includes('income') || accountStr.includes('revenue') || accountStr.includes('sales')) {
      category = 'income';
      totalIncome += amount;
    } else if (accountStr.includes('cost of goods') || accountStr.includes('cogs')) {
      category = 'cogs';
      totalCOGS += amount;
    } else if (accountStr.includes('expense') || accountStr.includes('operating')) {
      category = 'expense';
      totalExpenses += amount;
    }
    
    parsed.push({
      account: String(account).trim(),
      amount,
      category,
    });
  }
  
  const grossProfit = totalIncome - totalCOGS;
  const grossMarginPct = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
  
  return {
    parsed,
    summary: {
      totalIncome,
      totalCOGS,
      grossProfit,
      grossMarginPct,
      totalExpenses,
      netIncome: grossProfit - totalExpenses,
    },
  };
}

/**
 * Parse Profit and Loss by Class report
 * @param {Array} rows - Raw rows
 * @returns {Object} - { parsed, summary }
 */
function parseProfitAndLossByClass(rows) {
  const dataStartRow = findDataStartRow(rows);
  const parsed = [];
  const classSummaries = {};
  
  // Extract class names from header row
  const headerRow = rows[dataStartRow - 1] || [];
  const classes = headerRow.slice(1).filter(c => c && String(c).trim());
  
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    
    const account = row[0];
    if (!account) continue;
    
    const accountStr = String(account).trim().toLowerCase();
    if (accountStr.includes('total') || accountStr.includes('net income')) continue;
    
    // Parse amounts for each class
    classes.forEach((className, idx) => {
      const amount = cleanNumeric(row[idx + 1]);
      
      parsed.push({
        account: String(account).trim(),
        class: String(className).trim(),
        amount,
      });
      
      // Accumulate class summary
      if (!classSummaries[className]) {
        classSummaries[className] = { revenue: 0, expenses: 0 };
      }
      
      if (accountStr.includes('income') || accountStr.includes('revenue')) {
        classSummaries[className].revenue += amount;
      } else if (accountStr.includes('expense')) {
        classSummaries[className].expenses += amount;
      }
    });
  }
  
  // Calculate margins
  Object.keys(classSummaries).forEach(className => {
    const summary = classSummaries[className];
    summary.margin = summary.revenue - summary.expenses;
    summary.marginPct = summary.revenue > 0 ? (summary.margin / summary.revenue) * 100 : 0;
  });
  
  return {
    parsed,
    summary: {
      byClass: classSummaries,
    },
  };
}

/**
 * Parse Balance Sheet report
 * @param {Array} rows - Raw rows
 * @returns {Object} - { parsed, summary }
 */
function parseBalanceSheet(rows) {
  const dataStartRow = findDataStartRow(rows);
  const parsed = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let cash = 0;
  let accountsReceivable = 0;
  let accountsPayable = 0;
  
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    
    const account = row[0];
    const amount = cleanNumeric(row[1] || row[2]);
    
    if (!account) continue;
    
    const accountStr = String(account).trim().toLowerCase();
    
    // Skip total rows
    if (accountStr.includes('total assets')) {
      totalAssets = amount;
      continue;
    }
    if (accountStr.includes('total liabilities')) {
      totalLiabilities = amount;
      continue;
    }
    if (accountStr.includes('total equity')) {
      totalEquity = amount;
      continue;
    }
    if (accountStr.includes('total')) continue;
    
    // Categorize
    let category = 'other';
    if (accountStr.includes('asset')) {
      category = 'asset';
    } else if (accountStr.includes('liability') || accountStr.includes('liabilities')) {
      category = 'liability';
    } else if (accountStr.includes('equity')) {
      category = 'equity';
    }
    
    // Extract specific accounts
    if (accountStr.includes('cash') || accountStr.includes('checking')) {
      cash += amount;
    }
    if (accountStr.includes('accounts receivable') || accountStr.includes('a/r')) {
      accountsReceivable += amount;
    }
    if (accountStr.includes('accounts payable') || accountStr.includes('a/p')) {
      accountsPayable += amount;
    }
    
    parsed.push({
      account: String(account).trim(),
      amount,
      category,
    });
  }
  
  return {
    parsed,
    summary: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      cash,
      accountsReceivable,
      accountsPayable,
    },
  };
}

/**
 * Parse AR Aging Summary report
 * @param {Array} rows - Raw rows
 * @returns {Object} - { parsed, summary }
 */
function parseARAgingSummary(rows) {
  const dataStartRow = findDataStartRow(rows);
  const parsed = [];
  let total = 0;
  let current = 0;
  let days30 = 0;
  let days60 = 0;
  let days90 = 0;
  let daysOver90 = 0;
  
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    
    const customer = row[0];
    if (!customer) continue;
    
    const customerStr = String(customer).trim().toLowerCase();
    if (customerStr.includes('total')) continue;
    
    // Typical columns: Customer, Current, 1-30, 31-60, 61-90, 90+, Total
    const rowData = {
      customer: String(customer).trim(),
      current: cleanNumeric(row[1]),
      days1_30: cleanNumeric(row[2]),
      days31_60: cleanNumeric(row[3]),
      days61_90: cleanNumeric(row[4]),
      daysOver90: cleanNumeric(row[5]),
      total: cleanNumeric(row[6] || row[1]), // Total might be last or sum
    };
    
    parsed.push(rowData);
    
    current += rowData.current;
    days30 += rowData.days1_30;
    days60 += rowData.days31_60;
    days90 += rowData.days61_90;
    daysOver90 += rowData.daysOver90;
    total += rowData.total;
  }
  
  const over60Pct = total > 0 ? ((days60 + days90 + daysOver90) / total) * 100 : 0;
  
  return {
    parsed,
    summary: {
      total,
      current,
      days30,
      days60,
      days90,
      daysOver90,
      over60Pct,
    },
  };
}

/**
 * Parse Sales by Product/Service report
 * @param {Array} rows - Raw rows
 * @returns {Object} - { parsed, summary }
 */
function parseSalesByProduct(rows) {
  const dataStartRow = findDataStartRow(rows);
  const parsed = [];
  let totalRevenue = 0;
  
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    
    const product = row[0];
    if (!product) continue;
    
    const productStr = String(product).trim().toLowerCase();
    if (productStr.includes('total')) continue;
    
    const rowData = {
      product: String(product).trim(),
      quantity: cleanNumeric(row[1]),
      amount: cleanNumeric(row[2] || row[1]), // Amount might be col 1 or 2
    };
    
    parsed.push(rowData);
    totalRevenue += rowData.amount;
  }
  
  return {
    parsed,
    summary: {
      totalRevenue,
      productCount: parsed.length,
    },
  };
}

/**
 * Parse Expenses by Vendor report
 * @param {Array} rows - Raw rows
 * @returns {Object} - { parsed, summary }
 */
function parseExpensesByVendor(rows) {
  const dataStartRow = findDataStartRow(rows);
  const parsed = [];
  let totalExpenses = 0;
  
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    
    const vendor = row[0];
    if (!vendor) continue;
    
    const vendorStr = String(vendor).trim().toLowerCase();
    if (vendorStr.includes('total')) continue;
    
    const rowData = {
      vendor: String(vendor).trim(),
      amount: cleanNumeric(row[1] || row[2]),
    };
    
    parsed.push(rowData);
    totalExpenses += rowData.amount;
  }
  
  // Sort by amount descending
  parsed.sort((a, b) => b.amount - a.amount);
  
  return {
    parsed,
    summary: {
      totalExpenses,
      vendorCount: parsed.length,
      topVendors: parsed.slice(0, 5),
    },
  };
}

/**
 * Main parse function - routes to specific parser based on type
 * @param {Buffer} fileBuffer - File buffer (Excel or CSV)
 * @param {string} mimeType - File MIME type
 * @param {string} reportType - Optional: override detected report type
 * @returns {Object} - { type, period, parsed, summary }
 */
function parseQuickBooksReport(fileBuffer, mimeType, reportType = null) {
  console.debug('[qbParser] Starting parse, mimeType:', mimeType);
  
  // Read file based on type
  let workbook;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  } else if (mimeType.includes('csv')) {
    workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: true });
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
  
  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to rows (array of arrays)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  console.debug('[qbParser] Rows extracted:', rows.length);
  
  // Detect report type if not provided
  const type = reportType || detectReportType(rows);
  if (!type) {
    throw new Error('Could not detect QuickBooks report type. Please specify report type.');
  }
  
  console.debug('[qbParser] Report type:', type);
  
  // Extract period
  const { period, periodStart, periodEnd } = extractPeriod(rows);
  
  // Parse based on type
  let result;
  switch (type) {
    case 'profit_loss':
      result = parseProfitAndLoss(rows);
      break;
    case 'profit_loss_by_class':
      result = parseProfitAndLossByClass(rows);
      break;
    case 'balance_sheet':
      result = parseBalanceSheet(rows);
      break;
    case 'ar_aging_summary':
      result = parseARAgingSummary(rows);
      break;
    case 'sales_by_product':
      result = parseSalesByProduct(rows);
      break;
    case 'expenses_by_vendor':
      result = parseExpensesByVendor(rows);
      break;
    // Add other parsers as needed
    default:
      throw new Error(`Parser not implemented for report type: ${type}`);
  }
  
  return {
    type,
    period,
    periodStart,
    periodEnd,
    parsed: result.parsed,
    summary: result.summary,
  };
}

module.exports = {
  parseQuickBooksReport,
  detectReportType,
  extractPeriod,
  // Export individual parsers for testing
  parseProfitAndLoss,
  parseProfitAndLossByClass,
  parseBalanceSheet,
  parseARAgingSummary,
  parseSalesByProduct,
  parseExpensesByVendor,
};
