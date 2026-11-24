# stonkpet: docs check before building

Checked 2026-11-24 against docs.base.org, base.org/stocksmaxxing, docs.cdp.coinbase.com, and the live Tokenized Stocks API (`api.coinbase.com/v1/tokenized-stocks`).

## 1. Live tokens and addresses (Base mainnet, chain 8453)

The API lists **415** Coinbase-issued tokens. Symbols carry a `c` suffix (`NVDAc`). They are **B20 precompiles** with **8 decimals** and no bytecode on Basescan. Only **13 have a Chainlink NAV feed**, and all 10 of the demo's tickers are among them:

| Ticker | Token | Chainlink NAV feed | Multiplier today |
|---|---|---|---|
| AAPL | 0xb200000000000000000000C2e324d24d7eEcd1fb | 0x787f13dEa48Db0897CbCDD985de77809D837F988 | 1.0005 |
| AMZN | 0xb200000000000000000000d9192b6B456483C2E8 | 0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295 | 1 |
| GOOGL | 0xb2000000000000000000002D0BA3164cc74f58B7 | 0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2 | 1.0004 |
| META | 0xb2000000000000000000008bC8786B856E61707C | 0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D | 1.0003 |
| MSFT | 0xB200000000000000000000Ab99cFa739E253872B | 0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c | 1 |
| MSTR | 0xb2000000000000000000004884b426556b92883d | 0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a | 1 |
| NVDA | 0xb20000000000000000000078ee7ce2fE4908108C | 0x04689a41629776563E6822F76f2e57D148d28513 | 1.0005 |
| SNDK | 0xb200000000000000000000397293Cb8cda9a10c5 | 0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA | **8** |
| SPCX | 0xb2000000000000000000007b9fcbd005511aCBd5 | 0x6A634B235903C4ad6376892180d6fF8612e3Fa68 | 1 |
| TSLA | 0xb2000000000000000000001e800a7f5189430cD0 | 0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4 | 1 |

Three more tokens also have feeds: ANT, CRCL and INTC.

**This affects the "no robots" demo beat.** Robotics names are in the list: ISRG, SYM, TER, ROK and PATH. NFLX is there too. None of them has a price feed, and SYM, TER, ROK and PATH have zero supply. "No robotics stock exists on Base" would be false. The true statement is: *"robotics stocks are listed on Base, but none has a live price feed or any supply yet, so I can't price or buy them safely."* That is a stronger refusal anyway.

The `/chains` endpoint returns **mainnet only**: no Sepolia. Base contracts are the policy registry `0x8453…0002`, the token factory `0x4bA3E29E254F25E94E61C4c9d67b37027331534D`, and the price registry `0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD`.

## 2. How to buy them

- The Base docs route trading through the **0x Swap API** (AllowanceHolder flow: `/price`, then `/quote`, then an approval of the returned spender only, then submit). It needs a server-side `ZERO_EX_API_KEY`.
- The docs name no specific stock-token DEX. They say aggregators track "the DEXs where the B20 trades".
- **Not verified yet:** whether 0x has liquidity for these tokens, and in what size. That needs a 0x key.
- **No Sepolia route exists**, since the tokens aren't on Sepolia. The testnet fallback (mock B20-shaped ERC-20s plus a mock swap with our own oracle) is required. Base Sepolia test USDC comes from faucet.circle.com.

## 3. Compliance

- "Holding and trading on the secondary market is permissionless. KYC only happens during mint and redeem", which is limited to Authorized Participants.
- Onchain policies can block addresses such as sanctioned ones, and a blocked transfer reverts. Check `isAuthorized(policyId, account)` first. `approve()` is not policy-gated.
- Individual functions can be paused, so watch `paused_features`.
- **"Coinbase tokenized stocks are only available to persons in eligible jurisdictions outside of the U.S."**
- The hackathon FAQ says: **"projects that enable trading for US users are not eligible."** So the app needs a US block for trading (geo-IP plus a self-attestation at sign-up), not just an 18+ checkbox.

## 4. Multiplier

`shares = raw balance × multiplier` (WAD, 1e18). Read it onchain with `balanceOfUI(account)` / `uiMultiplier()`, or get `multiplier` from the API. One token does not always equal one share: dividends are paid as multiplier increases.

The Chainlink feed already reports `underlying price × multiplier` ("total return"). So:

**value in USD = raw token balance × feed price.** Don't multiply by the multiplier a second time.

The multiplier only matters for showing the share count. SNDK at ×8 is the test case.

## 5. Chainlink feed behaviour

- 8 decimals, read through `latestRoundData()`.
- During market hours it updates on a 0.5% move or every 24 hours (heartbeat).
- Off-hours (nights, weekends, holidays) it holds the last value, so `updatedAt` stops advancing.
- In a corporate action the registry pause flag is set, the feed freezes, and it only resumes once Coinbase confirms both the price and the multiplier.
- The docs say: "never settle or liquidate against a frozen feed."
- The feed alone can't distinguish "market closed" from "frozen for a corporate action". The rules engine needs an NYSE calendar plus a staleness bound on `updatedAt`.
- The API's `nav_price` is not an execution price.

## Contradictions with the plan

1. **OnchainKit is retired** (repo archived, no replacement). Use **wagmi + viem** with the `baseAccount` connector from `@base-org/account` (still recommended by CDP). The CDP Paymaster is a separate service.
2. **Builder Codes:** register on dashboard.base.org to get `bc_…`, then build the ERC-8021 suffix with `Attribution.toDataSuffix` from `ox/erc8021`. Wagmi ignores `dataSuffix` in `createConfig`, so it must be passed on **each** `sendCalls` / `writeContract` call.
3. **Weekly feed via spend permissions:** what's documented now is Base Subscriptions (`base.subscription.subscribe/charge`, works on Sepolia with `testnet: true`). It pulls USDC **to the app's CDP server wallet**, so the app would briefly hold user funds before buying. The non-custodial alternative is a weekly reminder plus a one-tap approval. Recommendation: use the one-tap approval.
4. **"No robots available"** needs rewording, as described in section 1.
5. **Tokens aren't on Sepolia**, so the mock-stock fallback is required for testnet.
