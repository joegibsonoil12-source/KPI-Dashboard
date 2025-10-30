# Test Fixtures

## Required Fixture Files

### 0303_001.pdf
**Status**: TO BE PROVIDED

**Description**: 7-page scanned delivery/sales report used as canonical tuning file for OCR parser.

**Purpose**: 
- Test OCR parsing with real-world scanned documents
- Validate table detection and column mapping
- Tune parser for production use

**Required Properties**:
- Multi-page PDF (7 pages)
- Contains delivery/sales data in tabular format
- Should include scheduled jobs with revenue amounts
- Will be used to validate parser output format

**Usage**:
```javascript
// Integration test will use this file
const fixturePath = './tests/fixtures/0303_001.pdf';
const parsed = await ocrParser.parse(fixturePath);
// Validate parsed.rows.length > 0
// Validate parsed.summary.scheduledJobs present
```

## Adding Fixtures

To add the actual PDF fixture:
1. Place `0303_001.pdf` in this directory
2. Ensure it's a valid multi-page PDF with tabular data
3. Run integration tests to validate parser output
4. Review first 10 parsed rows in PR description
