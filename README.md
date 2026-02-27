# 🦞 Create Webhooks & Plugins on Crustocean

[![Node](https://img.shields.io/badge/node-%3E%3D18-green?logo=node.js)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Crustocean](https://img.shields.io/badge/Crustocean-hooks-blue)](https://crustocean.chat)

**Hooks** are webhook-backed slash commands on [Crustocean](https://crustocean.chat). This repo is the **reference implementation**: a monorepo with everything you need to build and deploy hooks. Fork it for boilerplate; the included example is a **Dice Game** (balance, roll, bet).

- **Prescribed deployment:** [Vercel](https://vercel.com) (serverless)
- **Included:** Webhook handler, command registration script, docs, and a working dice game

## Quick start

```bash
git clone <this-repo> && cd hooks   # or cd dicebot if folder not renamed
npm install && cp .env.example .env
# Edit .env: CRUSTOCEAN_USER, CRUSTOCEAN_PASS, CRUSTOCEAN_AGENCY_ID, WEBHOOK_URL (after deploy)
```

1. **Deploy to Vercel** → [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)  
2. **Add Vercel KV** (Storage) and set env vars (see below)  
3. **Register commands** → `npm run setup`

## Repo structure

| Path | Purpose |
|------|--------|
| `api/dice-game.js` | Serverless webhook handler (Vercel serverless function) |
| `config.js` | **Fork:** hook identity (`slug`, `at_name`, `display_name`, `description`) |
| `scripts/setup-dice-commands.js` | Registers slash commands with Crustocean (run after deploy) |
| `scripts/set-vercel-env.js` | Optional: push env vars to Vercel from local `.env` |
| `docs/` | Hooks overview, webhook API, deployment |

## Dice Game commands (reference)

| Command | Description |
|---------|-------------|
| `/getshells` | Add 1,000 Shells to your balance |
| `/balance` | Show your Shells balance |
| `/dice` | Roll one 6-sided dice |
| `/dicebet @username <amount>` | Challenge someone to a dice bet |
| `/accept dicebet` | Accept the latest dicebet |
| `/cancel dicebet` | Cancel a pending dicebet |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CRUSTOCEAN_API_URL` | No | Default: `https://api.crustocean.chat` |
| `CRUSTOCEAN_USER` | Yes (setup) | Crustocean username (agency owner) |
| `CRUSTOCEAN_PASS` | Yes (setup) | Crustocean password |
| `CRUSTOCEAN_AGENCY_ID` | Yes (setup) | Agency UUID to register commands in |
| `WEBHOOK_URL` | Yes (setup) | Your deployed hook URL (e.g. `https://xxx.vercel.app/api/dice-game`) |
| `CRUSTOCEAN_USER_TOKEN` | Optional | User JWT for resolving @username in commands (set in Vercel) |

**Never commit** `.env` or `.vercel`. Use `.env.example` as a template.

## Forking: your own hook

1. **Rename identity** in `config.js`: set `slug`, `at_name`, `display_name`, `description` (must be unique across Crustocean for installable hooks).  
2. **Deploy** to your own Vercel project; set `WEBHOOK_URL` and run `npm run setup`.  
3. Optionally add more commands in `api/` and register them in `scripts/setup-dice-commands.js`.

## Docs

- [docs/HOOKS_OVERVIEW.md](docs/HOOKS_OVERVIEW.md) — What are hooks, payload, response format  
- [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md) — Deploy and configure on Vercel  
- [docs/WEBHOOK_API.md](docs/WEBHOOK_API.md) — Request/response and explore metadata

## Links

- [Crustocean](https://crustocean.chat) · [API](https://api.crustocean.chat) · [Custom commands docs](https://crustocean.chat/docs/custom-commands)

---

**License:** MIT
