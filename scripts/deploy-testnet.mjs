// Deploys the testnet mock stocks to Base Sepolia.
//
//   node scripts/deploy-testnet.mjs --test   integration test against a throwaway TestUSDC
//   node scripts/deploy-testnet.mjs          real deployment against Circle's Base Sepolia USDC,
//                                            lists every stock stonkpet can trade, seeds live prices,
//                                            writes data/testnet-deployment.json
//
// Key: PRICE_UPDATER_KEY env var, or secrets/price-updater.txt (git-ignored).
// Run with NODE_USE_ENV_PROXY=1 behind a proxy.
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, formatUnits, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PRICES_URL = process.env.PRICES_URL || "https://stonkpet.vercel.app/api/prices";
const WAD = 10n ** 18n;

const key = process.env.PRICE_UPDATER_KEY || readFileSync(new URL("../secrets/price-updater.txt", import.meta.url), "utf8").match(/0x[0-9a-fA-F]{64}/)?.[0];
if (!key) throw new Error("No PRICE_UPDATER_KEY");
const account = privateKeyToAccount(key);
const transport = http(process.env.SEPOLIA_RPC_URL || "https://sepolia.base.org");
const pub = createPublicClient({ chain: baseSepolia, transport });
const wallet = createWalletClient({ chain: baseSepolia, transport, account });
const { artifacts } = JSON.parse(readFileSync(new URL("../contracts/out.json", import.meta.url), "utf8"));
const A = (n) => artifacts[n];

async function deploy(name, args) {
  const hash = await wallet.deployContract({ abi: A(name).abi, bytecode: A(name).bytecode, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${name} deploy failed: ${hash}`);
  console.log(`deployed ${name} at ${r.contractAddress}`);
  return r.contractAddress;
}
async function write(address, name, functionName, args) {
  const { request } = await pub.simulateContract({ account, address, abi: A(name).abi, functionName, args });
  const hash = await wallet.writeContract(request);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${functionName} failed: ${hash}`);
  return { hash, receipt: r };
}
const read = (address, name, functionName, args = []) => pub.readContract({ address, abi: A(name).abi, functionName, args });
async function expectRevert(label, address, name, fn, args, errName) {
  try { await pub.simulateContract({ account, address, abi: A(name).abi, functionName: fn, args }); }
  catch (e) {
    const got = e?.cause?.data?.errorName ?? e?.cause?.reason ?? e?.shortMessage;
    const ok = !errName || String(got).includes(errName) || String(e?.message).includes(errName);
    console.log(`${ok ? "PASS" : "FAIL"} ${label}: reverted (${got})`);
    if (!ok) process.exitCode = 1;
    return;
  }
  console.log(`FAIL ${label}: did not revert`); process.exitCode = 1;
}
const check = (label, cond, detail = "") => { console.log(`${cond ? "PASS" : "FAIL"} ${label}${detail ? " " + detail : ""}`); if (!cond) process.exitCode = 1; };

console.log("deployer / updater:", account.address, formatUnits(await pub.getBalance({ address: account.address }), 18), "ETH");

if (process.argv.includes("--test")) {
  // ---------- integration test on Base Sepolia with a throwaway USDC ----------
  const usdc = await deploy("TestUSDC", []);
  const ex = await deploy("MockStockExchange", [usdc, account.address]);
  await write(ex, "MockStockExchange", "list", ["NVDA", "NVIDIA Corporation", WAD]);
  await write(ex, "MockStockExchange", "list", ["SNDK", "Sandisk Corporation", 8n * WAD]);
  const nvda = await read(ex, "MockStockExchange", "tokenOf", ["NVDA"]);
  const sndk = await read(ex, "MockStockExchange", "tokenOf", ["SNDK"]);
  await expectRevert("duplicate listing", ex, "MockStockExchange", "list", ["NVDA", "x", WAD], "AlreadyListed");
  await expectRevert("buy before any price", ex, "MockStockExchange", "buy", [nvda, 1n, 0n], "StalePrice");

  await write(ex, "MockStockExchange", "setPrices", [[nvda, sndk], [15280000000n, 61531000000n]]); // $152.80, $615.31
  await write(usdc, "TestUSDC", "mint", [account.address, parseUnits("100", 6)]);
  await write(usdc, "TestUSDC", "approve", [ex, parseUnits("100", 6)]);

  const q = await read(ex, "MockStockExchange", "quoteBuy", [nvda, parseUnits("30", 6)]);
  await expectRevert("slippage guard", ex, "MockStockExchange", "buyMany", [[nvda], [parseUnits("30", 6)], [q + 1n]], "Slippage");
  await write(ex, "MockStockExchange", "buyMany", [[nvda, sndk], [parseUnits("30", 6), parseUnits("20", 6)], [q, 0n]]);
  const balN = await read(nvda, "MockStockToken", "balanceOf", [account.address]);
  const balS = await read(sndk, "MockStockToken", "balanceOf", [account.address]);
  check("bought NVDA at $152.80 for $30", balN === 19633507n, `(${formatUnits(balN, 8)} tokens)`);
  check("bought SNDK for $20", balS > 0n, `(${formatUnits(balS, 8)} tokens)`);
  check("SNDK shares use the x8 multiplier", (await read(sndk, "MockStockToken", "balanceOfUI", [account.address])) === balS * 8n);
  check("exchange holds the $50 USDC", (await read(usdc, "TestUSDC", "balanceOf", [ex])) === parseUnits("50", 6));

  await write(ex, "MockStockExchange", "sell", [nvda, balN / 2n, 0n]);
  check("sold half the NVDA back", (await read(nvda, "MockStockToken", "balanceOf", [account.address])) === balN - balN / 2n);

  await write(ex, "MockStockExchange", "setMaxPriceAge", [1n]);
  await new Promise((r) => setTimeout(r, 5000));
  await expectRevert("never trades on a stale price", ex, "MockStockExchange", "buy", [nvda, parseUnits("1", 6), 0n], "StalePrice");
  console.log(process.exitCode ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
} else {
  // ---------- real testnet deployment ----------
  const board = await (await fetch(PRICES_URL)).json();
  const stocks = board.prices.filter((p) => p.price > 0);
  console.log(`listing ${stocks.length} stocks from ${PRICES_URL} (market ${board.market.reason})`);
  const ex = await deploy("MockStockExchange", [SEPOLIA_USDC, account.address]);
  const tokens = {};
  for (const s of stocks) {
    const mult = BigInt(Math.round(s.multiplier * 1e6)) * 10n ** 12n;
    await write(ex, "MockStockExchange", "list", [s.ticker, s.name, mult]);
    tokens[s.ticker] = await read(ex, "MockStockExchange", "tokenOf", [s.ticker]);
    console.log(`  ${s.ticker.padEnd(6)} ${tokens[s.ticker]}  (${s.source})`);
  }
  const addrs = stocks.map((s) => tokens[s.ticker]);
  const prices = stocks.map((s) => BigInt(Math.round(s.price * 1e8)));
  await write(ex, "MockStockExchange", "setPrices", [addrs, prices]);
  const out = { chainId: baseSepolia.id, exchange: ex, usdc: SEPOLIA_USDC, updater: account.address, tokens, deployedAt: new Date().toISOString() };
  writeFileSync(new URL("../data/testnet-deployment.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
  console.log("\nwrote data/testnet-deployment.json");
}
