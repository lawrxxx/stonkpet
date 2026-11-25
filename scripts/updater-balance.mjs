// Prints the testnet price updater's Base Sepolia ETH balance (it pays for price pushes).
// Usage: NODE_USE_ENV_PROXY=1 node scripts/updater-balance.mjs [address]
import { createPublicClient, formatEther, http } from "viem";
import { baseSepolia } from "viem/chains";

const address = process.argv[2] || "0xD8Ead8019e9a023C2FA8a2fA93ae12F9fa863f44";
const c = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") });
console.log(address, formatEther(await c.getBalance({ address })), "ETH");
