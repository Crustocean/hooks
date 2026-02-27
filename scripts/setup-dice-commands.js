#!/usr/bin/env node
/**
 * Register hook commands with Crustocean (custom commands API).
 * Run after deploying the webhook to Vercel.
 *
 * Usage: npm run setup   (from this folder)
 *        or: node scripts/setup-dice-commands.js
 *
 * Requires in .env: CRUSTOCEAN_API_URL, CRUSTOCEAN_USER, CRUSTOCEAN_PASS,
 *   WEBHOOK_URL (e.g. https://your-app.vercel.app/api/dice-game),
 *   CRUSTOCEAN_AGENCY_ID (target agency UUID).
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HOOK } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../.env') });

const API_URL = process.env.CRUSTOCEAN_API_URL || 'https://api.crustocean.chat';
const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.DICE_WEBHOOK_URL;
const AGENCY_ID = process.env.CRUSTOCEAN_AGENCY_ID;

const EXPLORE_METADATA = {
  display_name: HOOK.display_name,
  slug: HOOK.slug,
  at_name: HOOK.at_name,
  description: HOOK.description,
};

const COMMANDS = [
  { name: 'getshells', description: 'Get 1,000 Shells' },
  { name: 'balance', description: 'Check your Shells balance' },
  { name: 'dice', description: 'Roll a single 6-sided dice' },
  { name: 'dicebet', description: 'Challenge someone: /dicebet @username <amount>' },
  { name: 'accept', description: 'Accept a dicebet: /accept dicebet' },
  { name: 'cancel', description: 'Cancel a pending dicebet: /cancel dicebet' },
];

async function login() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.CRUSTOCEAN_USER,
      password: process.env.CRUSTOCEAN_PASS,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Login failed: ${res.status}`);
  }
  const data = await res.json();
  return data.token;
}

async function main() {
  if (!WEBHOOK_URL || !AGENCY_ID) {
    console.error('Set WEBHOOK_URL (or DICE_WEBHOOK_URL) and CRUSTOCEAN_AGENCY_ID in .env');
    process.exit(1);
  }
  console.log('Logging in...');
  const token = await login();
  console.log('Fetching existing commands...');
  const existing = await fetch(`${API_URL}/api/custom-commands/${AGENCY_ID}/commands`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`List failed: ${r.status}`))));
  const existingByName = new Map(existing.map((c) => [c.name, c]));
  for (const cmd of COMMANDS) {
    const existingCmd = existingByName.get(cmd.name);
    if (existingCmd) {
      const meta = existingCmd.explore_metadata || {};
      const needsMetadata = !meta.display_name || !meta.slug || !meta.at_name;
      if (needsMetadata) {
        console.log(`  Updating /${cmd.name} with explore metadata...`);
        const res = await fetch(`${API_URL}/api/custom-commands/${AGENCY_ID}/commands/${existingCmd.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ explore_metadata: EXPLORE_METADATA }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Update ${cmd.name} failed: ${res.status}`);
        }
        console.log(`  ✓ /${cmd.name} (metadata updated)`);
      } else {
        console.log(`  ${cmd.name} — already exists, skipping`);
      }
      continue;
    }
    console.log(`  Creating /${cmd.name}...`);
    const res = await fetch(`${API_URL}/api/custom-commands/${AGENCY_ID}/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: cmd.name,
        webhook_url: WEBHOOK_URL,
        description: cmd.description,
        explore_metadata: EXPLORE_METADATA,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Create ${cmd.name} failed: ${res.status}`);
    }
    console.log(`  ✓ /${cmd.name}`);
  }
  console.log('\nDone! Commands registered.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
