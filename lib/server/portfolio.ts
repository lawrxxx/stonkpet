import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { CHAIN, RPC_URL } from "@/lib/chain";
import { DEPLOYMENT } from "@/lib/deployment";
import { priceBoard, type PriceBoard } from "./prices";

/**
 * A wallet's real holdings: token balances read onchain on the active chain, valued at
 * live prices (Chainlink NAV, or DEX for stocks without a feed). Feed prices are
 * total-return, so value = tokens × price, without applying the multiplier again.
 */
export const chainClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL), batch: { multicall: true } });

export type Holding = { ticker: string; token: `0x${string}`; units: number; rawUnits: string; priceUsd: number | null; valueUsd: number | null; source: "chainlink" | "dex" | null };
export type Portfolio = { address: string; holdings: Holding[]; stocksUsd: number; walletUsdc: number | null; board: PriceBoard; unpriced: string[] };

export async function portfolio(address: `0x${string}`, board?: PriceBoard): Promise<Portfolio> {
  board ??= await priceBoard();
  const entries = Object.entries(DEPLOYMENT.tokens);
  const [balances, usdc] = await Promise.all([
    Promise.all(entries.map(([, token]) => chainClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] }).catch(() => null))),
    chainClient.readContract({ address: DEPLOYMENT.usdc, abi: erc20Abi, functionName: "balanceOf", args: [address] }).catch(() => null),
  ]);
  const holdings: Holding[] = [];
  const unpriced: string[] = [];
  entries.forEach(([ticker, token], i) => {
    const raw = balances[i];
    if (!raw || raw === BigInt(0)) return;
    const units = Number(formatUnits(raw, 8));
    const p = board!.prices.find((x) => x.ticker === ticker);
    const priceUsd = p?.price ?? null;
    if (priceUsd === null) unpriced.push(ticker);
    holdings.push({ ticker, token, units, rawUnits: raw.toString(), priceUsd, valueUsd: priceUsd === null ? null : units * priceUsd, source: p?.source ?? null });
  });
  const stocksUsd = holdings.reduce((a, h) => a + (h.valueUsd ?? 0), 0);
  return { address, holdings, stocksUsd, walletUsdc: usdc === null ? null : Number(formatUnits(usdc, 6)), board, unpriced };
}
