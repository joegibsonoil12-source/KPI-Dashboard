/**
 * Manual test script for Service Tracking parser
 * Run with: node --loader tsx test-service-parser.mjs
 */

import { parseCSV } from './src/lib/parseServiceReport.js';

// Sample CSV data matching Housecall Pro format
const sampleCSV = `Job #,Job description,Job status,Customer name,Address,Job created date,Job scheduled start date,Assigned employees,Job amount,Due amount
="678",HVAC Repair,Completed,John Doe,123 Main St,2025-10-15,2025-10-16 09:00:00,"Smith, Bob",$1,234.56,$0.00
="679",Plumbing Service,Scheduled,Jane Smith,456 Oak Ave,2025-10-15,2025-10-17 14:00:00,"Jones, Alice",$850.00,$850.00
="680",Electrical Work,In Progress,Bob Johnson,789 Elm St,2025-10-14,2025-10-16 10:00:00,"Smith, Bob",$2,100.50,$500.00
="681",HVAC Maintenance,Pro canceled,Alice Brown,321 Pine Rd,2025-10-13,2025-10-15 08:00:00,"Davis, Charlie",$450.00,$0.00
="682",Emergency Repair,Pending,Charlie Wilson,654 Maple Dr,2025-10-16,2025-10-18 11:00:00,"Smith, Bob; Jones, Alice",$3,500.00,$3,500.00`;

console.log("Testing Service Report Parser\n");
console.log("=" .repeat(60));

try {
  const result = parseCSV(sampleCSV);
  
  console.log("\nParse Results:");
  console.log(`Total rows parsed: ${result.totalRows}`);
  console.log(`Mapped headers: ${result.mappedHeaders.join(", ")}`);
  
  console.log("\n" + "=".repeat(60));
  console.log("Sample Parsed Jobs:\n");
  
  result.rows.forEach((row, idx) => {
    console.log(`Job ${idx + 1}:`);
    console.log(`  Job #: ${row.job_number}`);
    console.log(`  Customer: ${row.customer_name}`);
    console.log(`  Raw Status: ${row.raw_status} -> Normalized: ${row.status}`);
    console.log(`  Job Date: ${row.job_date}`);
    console.log(`  Primary Tech: ${row.primary_tech}`);
    console.log(`  Amount: $${(row.job_amount || 0).toFixed(2)}`);
    console.log(`  Due: $${(row.due_amount || 0).toFixed(2)}`);
    console.log("");
  });
  
  console.log("=".repeat(60));
  console.log("\nStatus Normalization Test:");
  console.log("  'Completed' -> " + result.rows[0].status);
  console.log("  'Scheduled' -> " + result.rows[1].status);
  console.log("  'In Progress' -> " + result.rows[2].status);
  console.log("  'Pro canceled' -> " + result.rows[3].status);
  console.log("  'Pending' -> " + result.rows[4].status);
  
  console.log("\n" + "=".repeat(60));
  console.log("\nExcel Quote Stripping Test:");
  console.log(`  Original: ="678"`);
  console.log(`  Parsed: ${result.rows[0].job_number}`);
  
  console.log("\n" + "=".repeat(60));
  console.log("\nCurrency Parsing Test:");
  console.log(`  Original: $1,234.56`);
  console.log(`  Parsed: ${result.rows[0].job_amount}`);
  
  console.log("\n" + "=".repeat(60));
  console.log("\nTech Assignment Test:");
  console.log(`  Single tech: "${result.rows[0].assigned_employees_raw}" -> Primary: ${result.rows[0].primary_tech}`);
  console.log(`  Multiple techs: "${result.rows[4].assigned_employees_raw}" -> Primary: ${result.rows[4].primary_tech}`);
  
  console.log("\n✅ All parser tests completed successfully!");
  
} catch (error) {
  console.error("\n❌ Parser test failed:");
  console.error(error.message);
  process.exit(1);
}
