// Checks the live Sign-In with Ethereum endpoints with a throwaway key (no funds needed).
// Usage: NODE_USE_ENV_PROXY=1 node scripts/check-siwe-live.mjs [baseUrl]
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

const B = process.argv[2] || "https://stonkpet.vercel.app";
const host = new URL(B).host;
const acct = privateKeyToAccount(generatePrivateKey());
const pick = (r, n) => r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith(n + "=")) ?? "";
const nr = await fetch(B + "/api/auth/nonce");
const { nonce } = await nr.json();
console.log("nonce:", nonce ? "issued" : "NONE (server has no session secret)");
if (!nonce) process.exit(1);
const message = createSiweMessage({ address: acct.address, chainId: 84532, domain: host, nonce, uri: B, version: "1" });
const vr = await fetch(B + "/api/auth/verify", { method: "POST", headers: { "content-type": "application/json", cookie: pick(nr, "sp_nonce") }, body: JSON.stringify({ message, signature: await acct.signMessage({ message }) }) });
const text = await vr.text();
console.log("verify:", vr.status, text.slice(0, 300) || "(empty body)");
const me = await (await fetch(B + "/api/auth/me", { headers: { cookie: pick(vr, "sp_session") } })).json();
console.log("session:", me.address === acct.address.toLowerCase() ? "OK" : JSON.stringify(me));
