// Dev check: runs the real server trade engine (lib/server/trade.ts) against the
// throwaway test exchange from `deploy-testnet.mjs --test`, which uses TestUSDC.
// Live mainnet prices → split → push prices → approve + buyMany → verify onchain.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/test-trade-engine.mts <testExchangeAddress> <testUsdcAddress>
//
// Uses the updater key from secrets/price-updater.txt as the buyer (it holds TestUSDC from the test run).
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const [exchange, usdc] = process.argv.slice(2) as `0x${string}`[];
if (!exchange || !usdc) throw new Error("usage: test-trade-engine.mts <exchange> <usdc>");
const transport = http("https://sepolia.base.org");
const pub = createPublicClient({ chain: baseSepolia, transport });
const tokenOf = parseAbi(["function tokenOf(string) view returns (address)", "function balanceOf(address) view returns (uint256)"]);
const tokens: Record<string, `0x${string}`> = {};
for (const t of ["NVDA", "SNDK"]) tokens[t] = await pub.readContract({ address: exchange, abi: tokenOf, functionName: "tokenOf", args: [t] });
process.env.STONKPET_DEPLOYMENT = JSON.stringify({ exchange, usdc, tokens }); // must be set before the app modules load
process.env.PRICE_UPDATER_KEY ||= readFileSync(new URL("../secrets/price-updater.txt", import.meta.url), "utf8").match(/0x[0-9a-fA-F]{64}/)![0];

const { feedCalls, feedLegs, pushPrices, verifyFeed } = await import("../lib/server/trade");
const { priceBoard } = await import("../lib/server/prices");

const acct = privateKeyToAccount(process.env.PRICE_UPDATER_KEY as `0x${string}`);
const w = createWalletClient({ chain: baseSepolia, transport, account: acct });

const board = await priceBoard();
const legs = feedLegs({ NVDA: 0.6, SNDK: 0.4 }, "NVDA", 5, board);
console.log("legs:", legs.map((l) => `${l.ticker} $${Number(l.usdc) / 1e6} @ $${Number(l.priceE8) / 1e8}`).join(" | "));
console.log("pushed prices:", await pushPrices(legs));

let last: `0x${string}` = "0x";
for (const c of feedCalls(legs)) {
  last = await w.sendTransaction({ to: c.to, data: c.data });
  console.log("call to", c.to.slice(0, 10), (await pub.waitForTransactionReceipt({ hash: last })).status);
}
const v = await verifyFeed(last, acct.address);
console.log("verify buyer:", v.ok ? `OK, ${v.bought.length} purchases, $${v.bought.reduce((s, b) => s + Number(b.usdcIn), 0) / 1e6}` : v.reason);
const other = await verifyFeed(last, "0x000000000000000000000000000000000000dEaD");
console.log("verify a different wallet:", other.ok ? "WRONGLY ACCEPTED" : `rejected (${other.reason})`);
for (const t of ["NVDA", "SNDK"]) console.log(t, "balance:", Number(await pub.readContract({ address: tokens[t], abi: tokenOf, functionName: "balanceOf", args: [acct.address] })) / 1e8);
