# stonkpet

Your investing agent is a pet. Tell it what you want to invest in ("AI and robots, skip Tesla"), set a few rules, and it researches and proposes a portfolio of tokenized US stocks on Base. It executes only after you approve, then manages the portfolio inside your rules. The pet lives in a garden whose weather follows the market.

**Live:** https://stonkpet.vercel.app (Base Sepolia, sample data)

Built for Base's **Stocks Maxxing** hackathon. Track: Agentic Stock Finance → Research-to-portfolio agents.

> Not financial advice. Coinbase tokenized stocks are only available to adults in eligible jurisdictions outside the US, and stonkpet blocks US users from trading.

## Status

| Milestone | State |
|---|---|
| 1. Scaffold + design port (all screens, mock data) | ✅ done |
| 2. Wallet: passkey sign-in, paymaster, balances on Base Sepolia | next |
| 3. Research + proposal with Claude, rules engine + tests | |
| 4. Execution onchain, receipts, Builder Codes | |
| 5. Chat with tools, approval cards, refusals | |
| 6. Autopilot, morning note, market sleep from feed status | |
| 7. Polish, demo script, mainnet buy | |

Docs findings that shaped the plan are in [`DOCS-FINDINGS.md`](DOCS-FINDINGS.md).

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests (vitest)
npm run build
```

Refresh the stock list snapshot from the public Base Tokenized Stocks API:

```bash
node scripts/snapshot-stocks.mjs
```

## Architecture (so far)

- **Next.js App Router + TypeScript.** One route per screen (`/`, `/name`, `/pers`, `/brief`, `/rules`, `/think`, `/proposal`, `/home`, `/feed`, `/chat`, `/portfolio`) inside a shared phone shell (`components/Shell.tsx`) that holds the tab bar and bottom sheets.
- **Design.** `app/globals.css` is the demo's stylesheet ported as-is (same tokens, radii, shadows, Fredoka and Nunito), plus a few additions at the bottom. The pet and garden are React SVG components (`components/Pet.tsx`, `components/Scene.tsx`).
- **State.** `lib/store.ts` (zustand, persisted to localStorage) mirrors the demo's state object. Mock-only for now; money state moves server-side in milestones 2–4.
- **Plan maths.** `lib/plan.ts` has `fit()` and `buildPlan()`, ported from the demo and deterministic. The model will never pick weights.
- **Stock catalog.** `lib/stocks.ts` reads `data/base-stocks.snapshot.json`, a snapshot of the 415 Coinbase tokenized stocks on Base. stonkpet only trades the 13 that have a Chainlink NAV feed. Anything else is "listed, but no live price, so I won't trade it".
- **Chat.** `lib/mockBrain.ts` is the demo's keyword brain, used as the fallback until the Claude agent lands in milestone 5. Money-moving replies become yes/hold-on cards.

## What was built during the hackathon

Everything in this repo. The design and copy are ported from our own clickable prototype (`stonkpet-demo.html`).
