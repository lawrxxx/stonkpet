# stonkpet

Your investing agent is a pet. Tell it what you want to invest in ("AI and robots, skip Tesla"), set a few rules, and it researches and proposes a portfolio of tokenized US stocks on Base. It executes only after you approve, then manages the portfolio inside your rules. The pet lives in a garden whose weather follows the market.

**Live:** https://stonkpet.vercel.app (Base Sepolia, sample data)

Built for Base's **Stocks Maxxing** hackathon. Track: Agentic Stock Finance → Research-to-portfolio agents.

> Not financial advice. Coinbase tokenized stocks are only available to adults in eligible jurisdictions outside the US, and stonkpet blocks US users from trading.

## Status

| Milestone | State |
|---|---|
| 1. Scaffold + design port (all screens, mock data) | ✅ done |
| 2. Wallet: passkey sign-in, paymaster, balances on Base Sepolia | 🟡 code done, needs CDP Paymaster URL + Builder Code to verify |
| 3. Research + proposal with Claude, rules engine + tests | ✅ done |
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

## Wallet setup (milestone 2)

1. **CDP Paymaster** at portal.cdp.coinbase.com → Paymaster → Base Sepolia. Copy the endpoint into `CDP_PAYMASTER_URL` (server-only, never `NEXT_PUBLIC_`). In the allowlist, add the Base Sepolia USDC contract `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (`transfer`). Later milestones add the stock-token and swap contracts.
2. **Builder Code** at dashboard.base.org. Put `bc_…` in `NEXT_PUBLIC_BUILDER_CODE`.
3. Redeploy, open `/check`, sign in with a passkey and tap **Send gas-free test transaction**. The receipt links to Basescan; check attribution on the Builder Codes dashboard.

## Architecture (so far)

- **Next.js App Router + TypeScript.** One route per screen (`/`, `/name`, `/pers`, `/brief`, `/rules`, `/think`, `/proposal`, `/home`, `/feed`, `/chat`, `/portfolio`) inside a shared phone shell (`components/Shell.tsx`) that holds the tab bar and bottom sheets.
- **Design.** `app/globals.css` is the demo's stylesheet ported as-is (same tokens, radii, shadows, Fredoka and Nunito), plus a few additions at the bottom. The pet and garden are React SVG components (`components/Pet.tsx`, `components/Scene.tsx`).
- **State.** `lib/store.ts` (zustand, persisted to localStorage) mirrors the demo's state object. Mock-only for now; money state moves server-side in milestones 2–4.
- **Plan maths.** `lib/plan.ts` has `fit()` and `buildPlan()`, ported from the demo and deterministic. The model will never pick weights.
- **Stock catalog.** `lib/stocks.ts` reads `data/base-stocks.snapshot.json`, a snapshot of the 415 Coinbase tokenized stocks on Base. stonkpet only trades the 13 that have a Chainlink NAV feed. Anything else is "listed, but no live price, so I won't trade it".
- **Wallet.** wagmi + viem with the Base Account connector (`lib/wagmi.ts`): passkey sign-in, no seed phrase. OnchainKit is retired per the Base docs. Every transaction goes through `useSponsoredCalls()` (`lib/wallet.ts`), which sends EIP-5792 `wallet_sendCalls` with the `paymasterService` capability, pointed at our proxy `app/api/paymaster/route.ts` (forwards only `pm_getPaymasterStubData` / `pm_getPaymasterData` for our chain, so the CDP key stays server-side), plus the ERC-8021 Builder Code suffix (`lib/builderCode.ts`). Balances are read onchain: USDC, ETH, and ETH/USD from Chainlink, treated as unknown if stale.
- **Live stock list.** `lib/server/stocksApi.ts` reads the public Base Tokenized Stocks API (all pages plus NAV feed addresses), cached for 5 minutes, and falls back to `data/base-stocks.snapshot.json` if the API is down. Served at `/api/stocks` (tradable only) and `/api/stocks?all=1`.
- **Live prices.** `lib/server/prices.ts` reads every tokenized stock's Chainlink NAV feed on **Base mainnet** (the feeds only exist there), even while trading is on Sepolia. Today's move is found by searching the feed's round history for the last price before the session opened. Feed values are total-return, so a holding is worth balance × price, with no second multiplier. Served at `/api/prices`, cached for 60s.
- **Market clock.** `lib/market.ts`: NYSE hours, holidays and early closes for 2026–27, DST-aware, with tests. Each price is `live` (open and fresh), `closed` (last close: fine to value, never to trade), `stale` (open, but past the 24h heartbeat, so frozen), `paused` or `missing`. Only `live` can be traded.
- **The weather is the market.** Night when the market is closed, rain when your plan is down today, sun otherwise. Tapping the label previews the other weathers.
- **Network switch.** `NEXT_PUBLIC_CHAIN=sepolia|mainnet` in `lib/chain.ts`. All addresses were checked onchain.
- **Research (`lib/server/research.ts`, `/api/research`).** Turns a brief into a sourced proposal in two Claude calls (`claude-opus-5-5`, refusal fallbacks on). (1) Parse, with structured output: picks only from stocks that are tradable on Base, and flags anything asked for that isn't (for example "robots are listed but have no price feed", "Netflix has no feed"), with the closest real alternative. (2) Research: web search plus a strict `submit_research` tool. Every fact's URL is checked against the URLs the search actually returned, and anything else is dropped. Weights come from `fit()` in code, never from the model. Takes about a minute.
- **Rules engine (`lib/rules.ts`).** Enforced in code, not in the prompt: max % per company after the trade, excluded stocks, paused trading, market closed (feeds queue for the open, other trades wait), frozen or missing feeds (never trade), the ask-me threshold, wallet balance, and listed on Base with a price feed. Each refusal comes with a plain-language reason. 26 tests.
- **Chat.** `lib/mockBrain.ts` is the demo's keyword brain, used as the fallback until the Claude agent lands in milestone 5. Money-moving replies become yes/hold-on cards.

## What was built during the hackathon

Everything in this repo. The design and copy are ported from our own clickable prototype (`stonkpet-demo.html`).
