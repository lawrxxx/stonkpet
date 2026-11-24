// Pulls the public Base Tokenized Stocks API and writes a trimmed snapshot used for
// mock data and as an offline fallback. Live code reads the API directly.
// Usage: node scripts/snapshot-stocks.mjs
import { writeFileSync } from "node:fs";

const API = "https://api.coinbase.com/v1/tokenized-stocks";

async function all() {
  const out = [];
  let token;
  do {
    const u = new URL(API);
    u.searchParams.set("page_size", "500");
    if (token) u.searchParams.set("page_token", token);
    const r = await fetch(u);
    if (!r.ok) throw new Error(`${u}: ${r.status}`);
    const j = await r.json();
    out.push(...(j.tokens ?? []));
    token = j.next_page_token;
  } while (token);
  return out;
}

const tokens = await all();
const feeds = (await (await fetch(`${API}/nav-feeds`)).json()).nav_feeds ?? [];
const feedBy = new Map(feeds.map((f) => [f.contract_address.toLowerCase(), f.nav_feed_address]));

const stocks = tokens.map((t) => ({
  ticker: t.symbol.replace(/c$/, ""),
  symbol: t.symbol,
  name: t.name,
  address: t.contract_address,
  decimals: t.decimals,
  multiplier: t.multiplier ?? 1,
  totalSupply: t.total_supply ?? 0,
  navFeed: feedBy.get(t.contract_address.toLowerCase()) ?? null,
}));

writeFileSync(
  new URL("../data/base-stocks.snapshot.json", import.meta.url),
  JSON.stringify({ fetchedAt: new Date().toISOString(), chainId: 8453, stocks }, null, 0) + "\n",
);
console.log(`${stocks.length} tokens, ${stocks.filter((s) => s.navFeed).length} with a NAV feed`);
