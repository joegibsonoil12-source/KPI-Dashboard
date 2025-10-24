/**
 * generate-runtime-config.cjs
 *
 * Writes public/runtime-config.js using environment variables available at build time.
 * NOTE: Do not write server-only secrets (e.g. SUPABASE_SERVICE_ROLE_KEY) to this file.
 */

const fs = require('fs');
const path = require('path');

const outPath = path.resolve(__dirname, '..', 'public', 'runtime-config.js');

const config = {
  // billboard settings
  BILLBOARD_API_BASE: process.env.VERCEL_BILLBOARD_API_BASE || process.env.BILLBOARD_API_BASE || '',
  BILLBOARD_TV_TOKEN: process.env.VERCEL_BILLBOARD_TV_TOKEN || process.env.BILLBOARD_TV_TOKEN || '',

  // public supabase client values (safe to expose)
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
};

// Ensure directory exists
const publicDir = path.dirname(outPath);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const contents = `(function () {
  window.__ENV = ${JSON.stringify(config, null, 2)};
})();\n`;

try {
  fs.writeFileSync(outPath, contents, { encoding: 'utf8' });
  console.log('Wrote runtime config to', outPath);
  process.exit(0);
} catch (err) {
  console.error('Failed to write runtime-config.js:', err);
  process.exit(2);
}
