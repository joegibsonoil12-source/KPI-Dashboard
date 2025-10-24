/**
 * copy-index-to-404.js
 * 
 * Cross-platform script to copy dist/index.html to dist/404.html
 * This enables SPA routing on GitHub Pages by serving index.html
 * for any 404 requests (e.g., direct links like /billboard)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const fallbackPath = path.join(distDir, '404.html');

try {
  // Check if dist directory exists
  if (!fs.existsSync(distDir)) {
    console.error(`Error: dist directory not found at ${distDir}`);
    console.error('Make sure to run this script after building the project (npm run build)');
    process.exit(1);
  }

  // Check if index.html exists
  if (!fs.existsSync(indexPath)) {
    console.error(`Error: index.html not found at ${indexPath}`);
    console.error('Make sure to run this script after building the project (npm run build)');
    process.exit(1);
  }

  // Copy index.html to 404.html
  fs.copyFileSync(indexPath, fallbackPath);
  console.log(`✓ Successfully copied ${indexPath} to ${fallbackPath}`);
  process.exit(0);
} catch (error) {
  console.error(`Error copying index.html to 404.html:`, error);
  process.exit(1);
}
