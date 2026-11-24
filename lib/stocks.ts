import snapshot from "@/data/base-stocks.snapshot.json";

/**
 * Stock catalog. Source of truth is the public Base Tokenized Stocks API
 * (GET https://api.coinbase.com/v1/tokenized-stocks + /nav-feeds). The snapshot
 * in data/ is refreshed with `node scripts/snapshot-stocks.mjs` and used for mock
 * data and as an offline fallback.
 *
 * stonkpet only trades tokens that have a Chainlink NAV feed: without a price we
 * can't check the max-% rule or value a trade, so we never guess.
 */
export type ListedStock = {
  ticker: string; // NVDA
  symbol: string; // NVDAc (onchain symbol)
  name: string; // NVIDIA Corporation
  address: `0x${string}`;
  decimals: number;
  multiplier: number;
  totalSupply: number;
  navFeed: `0x${string}` | null;
};

export const SNAPSHOT_AT: string = snapshot.fetchedAt;
export const LISTED: ListedStock[] = snapshot.stocks as ListedStock[];
export const TRADABLE: ListedStock[] = LISTED.filter((s) => s.navFeed);
export const LISTED_COUNT = LISTED.length;
export const TRADABLE_COUNT = TRADABLE.length;

const byTicker = new Map(LISTED.map((s) => [s.ticker, s]));
export const listed = (ticker: string) => byTicker.get(ticker);
export const isTradable = (ticker: string) => !!byTicker.get(ticker)?.navFeed;

/** Friendly short names, in the demo's voice. */
const SHORT: Record<string, string> = {
  NVDA: "NVIDIA", MSFT: "Microsoft", GOOGL: "Alphabet", META: "Meta", AAPL: "Apple",
  AMZN: "Amazon", TSLA: "Tesla", MSTR: "Strategy", SNDK: "SanDisk", SPCX: "SpaceX",
  INTC: "Intel", CRCL: "Circle", ANT: "Anthropic",
  NFLX: "Netflix", AMD: "AMD", PLTR: "Palantir", HOOD: "Robinhood", PYPL: "PayPal",
  UBER: "Uber", ISRG: "Intuitive Surgical", SYM: "Symbotic", TER: "Teradyne",
  ROK: "Rockwell Automation", PATH: "UiPath",
  MU: "Micron", AVGO: "Broadcom", TTWO: "Take-Two", ORCL: "Oracle", BE: "Bloom Energy", MRVL: "Marvell",
  MRNA: "Moderna", LLY: "Eli Lilly", MCD: "McDonald's", SKHY: "SK Hynix", SERV: "Serve Robotics",
};
export const nameOf = (t: string) =>
  SHORT[t] ?? byTicker.get(t)?.name.replace(/,? (Inc|Corp|Corporation|PBC|Ltd|plc|Holdings|Group)\.?$/i, "") ?? t;

/** Plain-language one-liners. Placeholder copy for mock mode; research replaces it with sourced facts. */
export const ABOUT: Record<string, string> = {
  NVDA: "Makes the chips most AI runs on.",
  MSFT: "Runs a huge cloud business and backs a lot of AI tools.",
  GOOGL: "Owns Google Search, YouTube and its own AI models.",
  META: "Owns Instagram, WhatsApp and Facebook, and spends big on AI.",
  AAPL: "Makes the iPhone, Mac and AirPods.",
  AMZN: "Runs online shopping and the AWS cloud.",
  TSLA: "Makes electric cars and is building robots.",
  MSTR: "Holds a lot of Bitcoin, so it moves like crypto.",
  SNDK: "Makes memory and storage chips.",
  SPCX: "Builds rockets and runs Starlink.",
  INTC: "Makes computer chips and is building chip factories.",
  CRCL: "Issues USDC, the stablecoin.",
  ANT: "Makes Claude, an AI model.",
};

/** Words people use → ticker, for tradable stocks. */
export const ALIAS: Record<string, string> = {
  nvidia: "NVDA", nvda: "NVDA", microsoft: "MSFT", msft: "MSFT", google: "GOOGL", alphabet: "GOOGL",
  googl: "GOOGL", youtube: "GOOGL", meta: "META", facebook: "META", instagram: "META", apple: "AAPL",
  aapl: "AAPL", iphone: "AAPL", amazon: "AMZN", amzn: "AMZN", tesla: "TSLA", tsla: "TSLA",
  microstrategy: "MSTR", strategy: "MSTR", mstr: "MSTR", sandisk: "SNDK", sndk: "SNDK",
  spacex: "SPCX", spcx: "SPCX", starlink: "SPCX", intel: "INTC", intc: "INTC", circle: "CRCL",
  crcl: "CRCL", anthropic: "ANT", claude: "ANT",
};

/** Listed on Base, but no price feed yet, so stonkpet won't trade them. */
export const LISTED_ALIAS: Record<string, string> = {
  netflix: "NFLX", amd: "AMD", palantir: "PLTR", robinhood: "HOOD", paypal: "PYPL", uber: "UBER",
  "intuitive surgical": "ISRG", symbotic: "SYM", teradyne: "TER", rockwell: "ROK", uipath: "PATH",
  disney: "DIS", nike: "NKE", berkshire: "BRK.B",
  micron: "MU", broadcom: "AVGO", oracle: "ORCL", marvell: "MRVL", moderna: "MRNA", lilly: "LLY",
  "eli lilly": "LLY", mcdonald: "MCD", "mcdonald's": "MCD", "take-two": "TTWO", "sk hynix": "SKHY", hynix: "SKHY",
  "bloom energy": "BE", "serve robotics": "SERV",
};

/** Not on Base at all (checked against the snapshot). */
export const NOT_LISTED = ["coinbase", "spotify", "samsung", "tsmc", "boston dynamics"];

/** Robotics names that exist on Base but can't be priced yet. */
export const ROBOT_TICKERS = ["ISRG", "SYM", "TER", "ROK", "PATH"].filter((t) => byTicker.has(t));

const rx = (k: string) => new RegExp("\\b" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
export function findStock(t: string): string | null {
  for (const k in ALIAS) if (rx(k).test(t)) return ALIAS[k];
  return null;
}
export function findListedOnly(t: string): string | null {
  for (const k in LISTED_ALIAS) if (rx(k).test(t) && byTicker.has(LISTED_ALIAS[k]) && !isTradable(LISTED_ALIAS[k])) return LISTED_ALIAS[k];
  return null;
}
export function findNotListed(t: string): string | null {
  return NOT_LISTED.find((m) => t.includes(m)) ?? null;
}
