/**
 * generate-runtime-config.cjs
 *
 * Reads environment variables and writes public/runtime-config.js so the site
 * can be configured at deploy time without committing secrets.
 *
 * Usage:
 *   VERCEL_BILLBOARD_API_BASE=https://your-vercel-domain.vercel.app \
 *   VERCEL_BILLBOARD_TV_TOKEN=yourtoken \
 *   node scripts/generate-runtime-config.cjs
 *
 * This script is intended to be run as a pre-build step (e.g. npm script).
 */

const fs = require('fs');
const path = require('path');

const outPath = path.resolve(__dirname, '..', 'public', 'runtime-config.js');

const apiBase = process.env.VERCEL_BILLBOARD_API_BASE || process.env.BILLBOARD_API_BASE || '';
const tvToken = process.env.VERCEL_BILLBOARD_TV_TOKEN || process.env.BILLBOARD_TV_TOKEN || '';

const content = `(function () {
  window.__ENV = {
    BILLBOARD_API_BASE: ${JSON.stringify(String(apiBase || ''))},
    BILLBOARD_TV_TOKEN: ${JSON.stringify(String(tvToken || ''))}
  };
})();\n`;

try {
  // Ensure public directory exists
  const publicDir = path.dirname(outPath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(outPath, content, { encoding: 'utf8' });
  console.log('Wrote runtime config to', outPath);
  process.exit(0);
} catch (err) {
  console.error('Failed to write runtime-config.js:', err);
  process.exit(2);
}
