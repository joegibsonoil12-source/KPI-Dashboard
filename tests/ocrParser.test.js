/**
 * OCR Parser Tests
 * 
 * Unit tests for ocrParser module
 * 
 * To run: npm test (requires test runner setup)
 */

const ocrParser = require('../server/lib/ocrParser');

describe('OCR Parser', () => {
  describe('normalizeRow', () => {
    it('should normalize numeric amounts', () => {
      const row = {
        0: 'JOB123',
        1: 'John Doe',
        2: '$1,234.56',
      };
      
      const columnMap = {
        0: 'jobNumber',
        1: 'customer',
        2: 'amount',
      };
      
      const normalized = ocrParser.normalizeRow(row, columnMap);
      
      expect(normalized.jobNumber).toBe('JOB123');
      expect(normalized.customer).toBe('John Doe');
      expect(normalized.amount).toBe(1234.56);
    });
    
    it('should handle missing values', () => {
      const row = {
        0: 'JOB123',
        1: '',
      };
      
      const columnMap = {
        0: 'jobNumber',
        1: 'amount',
      };
      
      const normalized = ocrParser.normalizeRow(row, columnMap);
      
      expect(normalized.jobNumber).toBe('JOB123');
      expect(normalized.amount).toBe(0);
    });
    
    it('should normalize gallons', () => {
      const row = {
        0: '1,500.5',
      };
      
      const columnMap = {
        0: 'gallons',
      };
      
      const normalized = ocrParser.normalizeRow(row, columnMap);
      
      expect(normalized.gallons).toBe(1500.5);
    });
  });
  
  describe('mapColumnHeaders', () => {
    it('should map standard headers', () => {
      const headerRow = ['Job #', 'Customer Name', 'Date', 'Amount'];
      
      const columnMap = ocrParser.mapColumnHeaders(headerRow);
      
      expect(columnMap[0]).toBe('jobNumber');
      expect(columnMap[1]).toBe('customer');
      expect(columnMap[2]).toBe('date');
      expect(columnMap[3]).toBe('amount');
    });
    
    it('should handle variations in headers', () => {
      const headerRow = ['Job No', 'Client', 'Scheduled', 'Total $'];
      
      const columnMap = ocrParser.mapColumnHeaders(headerRow);
      
      expect(columnMap[0]).toBe('jobNumber');
      expect(columnMap[1]).toBe('customer');
      expect(columnMap[2]).toBe('date');
      expect(columnMap[3]).toBe('amount');
    });
    
    it('should use generic names for unknown headers', () => {
      const headerRow = ['Unknown1', 'Unknown2'];
      
      const columnMap = ocrParser.mapColumnHeaders(headerRow);
      
      expect(columnMap[0]).toBe('column0');
      expect(columnMap[1]).toBe('column1');
    });
  });
  
  describe('calculateSummary', () => {
    it('should calculate scheduled jobs and revenue', () => {
      const rows = [
        { status: 'scheduled', amount: 100 },
        { status: 'assigned', amount: 200 },
        { status: 'completed', amount: 300 },
        { status: 'confirmed', amount: 150 },
      ];
      
      const summary = ocrParser.calculateSummary(rows);
      
      expect(summary.totalRows).toBe(4);
      expect(summary.scheduledJobs).toBe(3); // scheduled, assigned, confirmed
      expect(summary.scheduledRevenue).toBe(450); // 100 + 200 + 150
      expect(summary.salesTotal).toBe(750); // all amounts
    });
    
    it('should handle empty rows', () => {
      const summary = ocrParser.calculateSummary([]);
      
      expect(summary.totalRows).toBe(0);
      expect(summary.scheduledJobs).toBe(0);
      expect(summary.scheduledRevenue).toBe(0);
      expect(summary.salesTotal).toBe(0);
    });
  });
  
  describe('detectColumnPositions', () => {
    it('should detect column X positions from rows', () => {
      const rows = [
        [
          { x: 10, text: 'A' },
          { x: 100, text: 'B' },
          { x: 200, text: 'C' },
        ],
        [
          { x: 12, text: 'D' },
          { x: 98, text: 'E' },
          { x: 205, text: 'F' },
        ],
      ];
      
      const positions = ocrParser.detectColumnPositions(rows);
      
      expect(positions.length).toBe(3);
      expect(positions[0]).toBeCloseTo(11, 0); // Average of 10, 12
      expect(positions[1]).toBeCloseTo(99, 0); // Average of 100, 98
      expect(positions[2]).toBeCloseTo(202, 0); // Average of 200, 205
    });
  });
  
  describe('clusterByY', () => {
    it('should group blocks into rows by Y coordinate', () => {
      const blocks = [
        { y: 10, text: 'A' },
        { y: 12, text: 'B' },
        { y: 50, text: 'C' },
        { y: 52, text: 'D' },
      ];
      
      const rows = ocrParser.clusterByY(blocks, 10);
      
      expect(rows.length).toBe(2);
      expect(rows[0].length).toBe(2); // A, B
      expect(rows[1].length).toBe(2); // C, D
    });
  });
});

// Integration test with fixture file
describe('OCR Parser Integration', () => {
  it.skip('should parse fixture file', async () => {
    // This test requires the actual 0303_001.pdf file
    // Skip by default, run manually when fixture is available
    
    const fs = require('fs');
    const path = require('path');
    
    const fixturePath = path.join(__dirname, 'fixtures', '0303_001.pdf');
    
    if (!fs.existsSync(fixturePath)) {
      console.warn('Fixture file not found, skipping integration test');
      return;
    }
    
    const buffer = fs.readFileSync(fixturePath);
    const result = await ocrParser.parse(buffer, 'application/pdf');
    
    expect(result.success).toBe(true);
    expect(result.parsed.rows.length).toBeGreaterThan(0);
    expect(result.parsed.summary.scheduledJobs).toBeDefined();
    expect(result.parsed.summary.scheduledRevenue).toBeDefined();
    
    // Print first 10 rows for PR
    console.log('First 10 parsed rows:');
    console.log(JSON.stringify(result.parsed.rows.slice(0, 10), null, 2));
  });
});
