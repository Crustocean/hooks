#!/usr/bin/env node
/**
 * Push Crustocean env vars to Vercel (API URL and user token).
 * Reads .env from this folder or project root; logs in to get token, then runs vercel env add.
 *
 * Run from this folder: npm run env:vercel  or  node scripts/set-vercel-env.js
 * Requires CRUSTOCEAN_USER and CRUSTOCEAN_PASS in .env (never commit .env).
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../.env') });

const API_URL = process.env.CRUSTOCEAN_API_URL || 'https://api.crustocean.chat';
const USER = process.env.CRUSTOCEAN_USER;
const PASS = process.env.CRUSTOCEAN_PASS;
const CWD = resolve(__dirname, '..');

async function getToken() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Login failed: ${res.status}`);
  }
  const data = await res.json();
  return data.token;
}

function vercelEnvAdd(name, value, env = 'production', force = false) {
  const tmp = join(tmpdir(), `vercel-env-${Date.now()}.txt`);
  writeFileSync(tmp, value, 'utf8');
  try {
    const forceFlag = force ? ' --force' : '';
    const cmd = process.platform === 'win32'
      ? `type "${tmp}" | vercel env add ${name} ${env}${forceFlag}`
      : `cat "${tmp}" | vercel env add ${name} ${env}${forceFlag}`;
    execSync(cmd, { cwd: CWD, shell: true, stdio: 'inherit' });
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

async function main() {
  if (!USER || !PASS) {
    console.error('Set CRUSTOCEAN_USER and CRUSTOCEAN_PASS in .env');
    process.exit(1);
  }
  console.log('Logging in to get token...');
  const token = await getToken();
  console.log('Adding CRUSTOCEAN_API_URL to Vercel...');
  vercelEnvAdd('CRUSTOCEAN_API_URL', API_URL, 'production', true);
  console.log('Adding CRUSTOCEAN_USER_TOKEN to Vercel...');
  vercelEnvAdd('CRUSTOCEAN_USER_TOKEN', token, 'production', true);
  console.log('Done. Redeploy for changes to take effect.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
