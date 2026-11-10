import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function publicConfigSource(env) {
  const supabaseUrl = (env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const publishableKey = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
  let parsed;
  try { parsed = new URL(supabaseUrl); } catch { throw new Error('SUPABASE_URL is required.'); }
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname)
      || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error('SUPABASE_URL must be the HTTPS project URL.');
  }
  let legacyAnon = false;
  if (publishableKey.split('.').length === 3) {
    try {
      legacyAnon = JSON.parse(Buffer.from(publishableKey.split('.')[1], 'base64url')).role === 'anon';
    } catch { /* Reject invalid JWT payloads. */ }
  }
  if (!publishableKey.startsWith('sb_publishable_') && !legacyAnon) {
    throw new Error('A publishable key or legacy anon key is required. Secret/service-role keys are not allowed.');
  }
  return `// Public client configuration. Access is restricted by database RLS.\nwindow.CAFE_CONFIG = ${JSON.stringify({supabaseUrl, publishableKey}, null, 2)};\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = new URL('../workbook/config.js', import.meta.url);
  const source = publicConfigSource(process.env);
  mkdirSync(dirname(fileURLToPath(output)), { recursive: true });
  writeFileSync(output, source, {mode: 0o644});
  console.log('Workbook public configuration prepared.');
}
