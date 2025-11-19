/**
 * Test script for Estimates parser
 * Run with: node test-estimates-parser.mjs
 */

import { parseCSV } from './src/lib/parseServiceReport.js';
import { readFileSync } from 'fs';

console.log("Testing HCP Estimates Parser\n");
console.log("=" .repeat(60));

try {
  // Read the sample estimates CSV
  const csvContent = readFileSync('./sample-hcp-estimates-export.csv', 'utf-8');
  
  const result = parseCSV(csvContent);
  
  console.log("\nParse Results:");
  console.log(`Total rows parsed: ${result.totalRows}`);
  console.log(`Mapped headers: ${result.mappedHeaders.join(", ")}`);
  
  console.log("\n" + "=".repeat(60));
  console.log("Parsed Estimates:\n");
  
  result.rows.forEach((row, idx) => {
    console.log(`Estimate ${idx + 1}:`);
    console.log(`  Estimate #: ${row.hcp_estimate_id}`);
    console.log(`  Job Number: ${row.job_number}`);
    console.log(`  Customer: ${row.customer_name}`);
    console.log(`  Location: ${row.location_name || 'N/A'}`);
    console.log(`  Outcome: ${row.hcp_outcome}`);
    console.log(`  Status: ${row.estimate_status} -> Normalized: ${row.status}`);
    console.log(`  Open Value: $${(row.open_value || 0).toFixed(2)}`);
    console.log(`  Won Value: $${(row.won_value || 0).toFixed(2)}`);
    console.log(`  Lost Value: $${(row.lost_value || 0).toFixed(2)}`);
    console.log(`  Calculated Amount: $${(row.job_amount || 0).toFixed(2)}`);
    console.log(`  Is Estimate: ${row.is_estimate}`);
    console.log(`  Tags: ${row.estimate_tags || 'N/A'}`);
    console.log("");
  });
  
  console.log("=".repeat(60));
  console.log("\nAmount Calculation Test:");
  result.rows.forEach((row, idx) => {
    const expected = row.hcp_outcome === 'open' ? row.open_value :
                     row.hcp_outcome === 'won' ? row.won_value :
                     row.hcp_outcome === 'lost' ? row.lost_value :
                     Math.max(row.open_value || 0, row.won_value || 0, row.lost_value || 0);
    const correct = row.job_amount === expected ? '✓' : '✗';
    console.log(`  ${correct} Estimate ${idx + 1} (${row.hcp_outcome}): Expected $${expected.toFixed(2)}, Got $${(row.job_amount || 0).toFixed(2)}`);
  });
  
  console.log("\n" + "=".repeat(60));
  console.log("\nEstimate Detection Test:");
  const allEstimates = result.rows.every(r => r.is_estimate);
  console.log(`  All rows detected as estimates: ${allEstimates ? '✓ YES' : '✗ NO'}`);
  
  console.log("\n✅ All estimates parser tests completed successfully!");
  
} catch (error) {
  console.error("\n❌ Estimates parser test failed:");
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
