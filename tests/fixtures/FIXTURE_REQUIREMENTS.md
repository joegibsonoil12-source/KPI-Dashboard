# Test Fixture Requirements

## Required File: 0303_001.pdf

This directory requires a test fixture PDF file named `0303_001.pdf` for integration testing of the OCR parser.

### File Specifications

**Name**: `0303_001.pdf`

**Type**: Scanned PDF document

**Content**: Should contain tabular data with scheduled jobs and revenue information, such as:
- Job numbers
- Customer names  
- Dates
- Status (scheduled, assigned, confirmed, completed, etc.)
- Amounts/revenue
- Technician/employee assignments
- Addresses or locations

**Format**: Multi-page PDF (ideally 7 pages) with:
- Clear table structure
- Column headers
- Multiple data rows per page
- Mixed status values to test filtering

### Purpose

This file is used for:
1. Integration testing of the OCR parser (`server/lib/ocrParser.js`)
2. Validating table detection and column mapping
3. Testing data extraction accuracy
4. Generating sample output for PR documentation (first 10 parsed rows)

### How to Use

Once the file is placed in this directory:

1. Run the OCR parser test:
```bash
npm test tests/ocrParser.test.js
```

2. Generate sample output for documentation:
```bash
node -e "
const ocrParser = require('./server/lib/ocrParser');
const fs = require('fs');
const buffer = fs.readFileSync('./tests/fixtures/0303_001.pdf');
ocrParser.parse(buffer, 'application/pdf').then(result => {
  if (result.success) {
    console.log('First 10 rows:');
    console.log(JSON.stringify(result.parsed.rows.slice(0, 10), null, 2));
    console.log('Summary:', result.parsed.summary);
  }
});
"
```

### Expected Output Format

The parser should produce output in this format:

```json
{
  "columnMap": {
    "0": "jobNumber",
    "1": "customer",
    "2": "date",
    "3": "status",
    "4": "amount"
  },
  "rows": [
    {
      "jobNumber": "12345",
      "customer": "Customer Name",
      "date": "2024-03-03",
      "status": "scheduled",
      "amount": 150.00,
      "page": 1,
      "y": 120
    }
  ],
  "summary": {
    "totalRows": 50,
    "scheduledJobs": 15,
    "scheduledRevenue": 2500.00,
    "salesTotal": 5000.00
  },
  "confidence": 0.92
}
```

### Alternative: Mock Data

If a real scanned PDF is not available, the tests will skip OCR processing and use mock data. However, for complete validation, a real test fixture is recommended.

### Creating a Test Fixture

If you need to create a test fixture:

1. **Export sample data** from your system (service jobs or delivery tickets)
2. **Create a tabular layout** in a spreadsheet or document
3. **Print to PDF** or scan a printed copy
4. **Ensure the PDF includes**:
   - Clear column headers
   - Multiple rows of data
   - Mix of statuses (scheduled, completed, etc.)
   - Valid dates and amounts
5. **Name the file** `0303_001.pdf`
6. **Place in** `tests/fixtures/` directory

### Security Note

⚠️ **Do not commit real customer data!**

If using real data, ensure it is:
- Anonymized (replace real names with "Customer A", "Customer B", etc.)
- Sanitized (remove phone numbers, addresses, sensitive information)
- Compliant with privacy regulations

For testing purposes, synthetic/sample data is preferred.
