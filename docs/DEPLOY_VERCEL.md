# Deploy hooks to Vercel

This is the prescribed deployment method for the reference implementation: **Vercel** (serverless).

## 1. Deploy the app

From the repo root (this folder):

```bash
npm install
vercel
```

When prompted, set the **root directory** to this folder if you’re in a parent monorepo. Follow the prompts to link a new or existing Vercel project.

Your webhook URL will be:

`https://<your-project>.vercel.app/api/dice-game`

Use this as `WEBHOOK_URL` in `.env` when running `npm run setup`.

## 2. Add Vercel KV (storage)

The dice game uses **Vercel KV** for balances and pending bets.

1. In [Vercel Dashboard](https://vercel.com) → your project → **Storage**
2. Create a **KV** database
3. Connect it to the project (Vercel adds the required env vars automatically)

## 3. Environment variables (Vercel)

In Vercel → **Settings** → **Environment Variables**, add:

| Variable | Description | Where used |
|----------|-------------|------------|
| `CRUSTOCEAN_API_URL` | `https://api.crustocean.chat` | API base URL |
| `CRUSTOCEAN_USER_TOKEN` | User JWT (for resolving @username in /dicebet) | Optional; get from browser Local Storage after login |

**Getting `CRUSTOCEAN_USER_TOKEN`:** Log in at [crustocean.chat](https://crustocean.chat) → DevTools → Application → Local Storage → copy `crustocean_token`. You can also use the script `npm run env:vercel` to push `CRUSTOCEAN_API_URL` and a fresh token from your `.env` (requires `CRUSTOCEAN_USER` and `CRUSTOCEAN_PASS` locally).

**Do not** commit `.env` or store secrets in the repo. Use Vercel’s env UI or CLI for production.

## 4. Register commands with Crustocean

After deploy, register your slash commands so Crustocean knows where to send webhook requests:

1. Copy `.env.example` to `.env` in this folder.
2. Set `CRUSTOCEAN_USER`, `CRUSTOCEAN_PASS`, `CRUSTOCEAN_AGENCY_ID`, and `WEBHOOK_URL` (your Vercel URL, e.g. `https://<project>.vercel.app/api/dice-game`).
3. Run:

```bash
npm run setup
```

This creates/updates the custom commands in the given agency. Users in that agency can then use `/custom` to list commands and (if the hook is installable) others can run `/hook install dicebot` in their own agencies (after you’ve published from a public agency).

## 5. Local development

```bash
vercel link
vercel env pull
npm run dev
```

Use **ngrok** or similar to expose `http://localhost:3000/api/dice-game` if you need to test against Crustocean from your machine.

## Summary

1. Deploy → `vercel`  
2. Add KV storage and connect to project  
3. Set env vars in Vercel (and optionally run `npm run env:vercel`)  
4. Set `.env` locally with `WEBHOOK_URL` and agency credentials, then `npm run setup`
