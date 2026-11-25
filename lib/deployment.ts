import testnet from "@/data/testnet-deployment.json";
import { IS_TESTNET, TOKENS } from "./chain";

/**
 * Where trades settle.
 * - Testnet: the MockStockExchange + mock stock tokens we deployed (contracts/MockStocks.sol).
 * - Mainnet: the real Coinbase tokenized stocks, swapped through a DEX route (not wired yet).
 */
export type Deployment = {
  exchange: `0x${string}` | null;
  usdc: `0x${string}`;
  /** ticker → token address on the active chain */
  tokens: Record<string, `0x${string}`>;
};

/** Server-only override for integration tests against a throwaway deployment (JSON with exchange, usdc, tokens). */
const override: Deployment | null = (() => {
  try { return process.env.STONKPET_DEPLOYMENT ? (JSON.parse(process.env.STONKPET_DEPLOYMENT) as Deployment) : null; } catch { return null; }
})();

export const DEPLOYMENT: Deployment = override ?? (IS_TESTNET
  ? { exchange: (testnet.exchange as `0x${string}` | null) ?? null, usdc: TOKENS.USDC.address, tokens: testnet.tokens as Record<string, `0x${string}`> }
  : { exchange: null, usdc: TOKENS.USDC.address, tokens: {} }); // mainnet tokens come from the live catalog

export const tradingLive = () => !!DEPLOYMENT.exchange && Object.keys(DEPLOYMENT.tokens).length > 0;

/** ABI fragments the app calls on the exchange and tokens. */
export const exchangeAbi = [
  { type: "function", name: "buyMany", stateMutability: "nonpayable", inputs: [{ name: "toks", type: "address[]" }, { name: "usdcIns", type: "uint256[]" }, { name: "minOuts", type: "uint256[]" }], outputs: [] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "tokensIn", type: "uint256" }, { name: "minUsdcOut", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "setPrices", stateMutability: "nonpayable", inputs: [{ name: "toks", type: "address[]" }, { name: "prices", type: "uint256[]" }], outputs: [] },
  { type: "function", name: "quotes", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "price", type: "uint128" }, { name: "updatedAt", type: "uint64" }] },
  { type: "function", name: "maxPriceAge", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "event", name: "Bought", inputs: [{ name: "buyer", type: "address", indexed: true }, { name: "token", type: "address", indexed: true }, { name: "usdcIn", type: "uint256", indexed: false }, { name: "tokensOut", type: "uint256", indexed: false }] },
  { type: "event", name: "Sold", inputs: [{ name: "seller", type: "address", indexed: true }, { name: "token", type: "address", indexed: true }, { name: "tokensIn", type: "uint256", indexed: false }, { name: "usdcOut", type: "uint256", indexed: false }] },
] as const;
