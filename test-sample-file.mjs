/**
 * Test parsing the actual sample Housecall Pro export file
 * This validates that the parser handles real-world data correctly
 */

import { parseServiceReport } from './src/lib/parseServiceReport.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testSampleFile() {
  console.log("Testing Sample Housecall Pro Export File\n");
  console.log("=" .repeat(60));
  
  try {
    // Read the sample CSV file
    const csvPath = join(process.cwd(), 'sample-housecall-pro-export.csv');
    const csvText = readFileSync(csvPath, 'utf-8');
    
    // Create a mock file object for parseServiceReport
    const file = {
      name: 'sample-housecall-pro-export.csv',
      text: async () => csvText
    };
    
    // Parse the file
    const result = await parseServiceReport(file);
    
    console.log("\n✅ File parsed successfully!");
    console.log(`\nTotal rows: ${result.totalRows}`);
    console.log(`Mapped headers: ${result.mappedHeaders.join(", ")}`);
    
    // Validate specific jobs
    console.log("\n" + "=".repeat(60));
    console.log("Validation Tests:\n");
    
    const tests = [
      {
        jobNumber: '1001',
        expectedAmount: 450.00,
        expectedStatus: 'completed',
        expectedTech: 'Bob Smith',
        description: 'Annual HVAC Maintenance'
      },
      {
        jobNumber: '1002',
        expectedAmount: 875.50,
        expectedStatus: 'completed',
        expectedTech: 'Alice Jones',
        description: 'Emergency Water Heater Repair'
      },
      {
        jobNumber: '1003',
        expectedAmount: 4250.00,
        expectedStatus: 'scheduled',
        expectedTech: 'Bob Smith',
        description: 'New AC Installation'
      },
      {
        jobNumber: '1009',
        expectedAmount: 0.00,
        expectedStatus: 'canceled',
        expectedTech: 'Bob Smith',
        description: 'Water Line Repair (Pro canceled)'
      }
    ];
    
    let allPassed = true;
    
    for (const test of tests) {
      const job = result.rows.find(j => j.job_number === test.jobNumber);
      
      if (!job) {
        console.log(`❌ Job ${test.jobNumber} not found`);
        allPassed = false;
        continue;
      }
      
      const amountMatch = job.job_amount === test.expectedAmount;
      const statusMatch = job.status === test.expectedStatus;
      const techMatch = job.primary_tech === test.expectedTech;
      
      if (amountMatch && statusMatch && techMatch) {
        console.log(`✅ Job ${test.jobNumber} (${test.description})`);
        console.log(`   Amount: $${job.job_amount.toFixed(2)}, Status: ${job.status}, Tech: ${job.primary_tech}`);
      } else {
        console.log(`❌ Job ${test.jobNumber} (${test.description})`);
        if (!amountMatch) console.log(`   Amount mismatch: expected $${test.expectedAmount}, got $${job.job_amount}`);
        if (!statusMatch) console.log(`   Status mismatch: expected '${test.expectedStatus}', got '${job.status}'`);
        if (!techMatch) console.log(`   Tech mismatch: expected '${test.expectedTech}', got '${job.primary_tech}'`);
        allPassed = false;
      }
    }
    
    // Check all amounts are valid numbers
    console.log("\n" + "=".repeat(60));
    console.log("Data Quality Checks:\n");
    
    const invalidAmounts = result.rows.filter(j => 
      j.job_amount === null || isNaN(j.job_amount) || typeof j.job_amount !== 'number'
    );
    
    if (invalidAmounts.length === 0) {
      console.log("✅ All job amounts are valid numbers");
    } else {
      console.log(`❌ ${invalidAmounts.length} jobs have invalid amounts`);
      allPassed = false;
    }
    
    // Check all job numbers are clean (no Excel quotes)
    const dirtyJobNumbers = result.rows.filter(j => 
      j.job_number.includes('=') || j.job_number.includes('"')
    );
    
    if (dirtyJobNumbers.length === 0) {
      console.log("✅ All job numbers are clean (Excel quotes stripped)");
    } else {
      console.log(`❌ ${dirtyJobNumbers.length} jobs have dirty job numbers`);
      allPassed = false;
    }
    
    // Check status normalization
    const expectedStatuses = ['completed', 'scheduled', 'in_progress', 'unscheduled', 'canceled'];
    const invalidStatuses = result.rows.filter(j => 
      !expectedStatuses.includes(j.status)
    );
    
    if (invalidStatuses.length === 0) {
      console.log("✅ All statuses normalized correctly");
    } else {
      console.log(`❌ ${invalidStatuses.length} jobs have invalid statuses`);
      allPassed = false;
    }
    
    // Check tech extraction
    const techsExtracted = result.rows.filter(j => j.primary_tech !== null).length;
    console.log(`✅ Primary tech extracted for ${techsExtracted}/${result.totalRows} jobs`);
    
    console.log("\n" + "=".repeat(60));
    
    if (allPassed) {
      console.log("\n✅ All tests passed! Sample file parsing is working correctly.\n");
      process.exit(0);
    } else {
      console.log("\n❌ Some tests failed. See details above.\n");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testSampleFile();
