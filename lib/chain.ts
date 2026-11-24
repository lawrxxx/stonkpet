import { base, baseSepolia } from "viem/chains";

/**
 * One flag switches networks: NEXT_PUBLIC_CHAIN=mainnet | sepolia (default).
 * Every address below was checked onchain (symbol/decimals or description()).
 */
export const NETWORK: "mainnet" | "sepolia" = process.env.NEXT_PUBLIC_CHAIN === "mainnet" ? "mainnet" : "sepolia";
export const IS_TESTNET = NETWORK === "sepolia";
export const CHAIN = IS_TESTNET ? baseSepolia : base;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || (IS_TESTNET ? "https://sepolia.base.org" : "https://mainnet.base.org");

type Token = { address: `0x${string}`; decimals: number };
export const TOKENS: { USDC: Token; cbBTC: Token | null } = IS_TESTNET
  ? { USDC: { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 }, cbBTC: null }
  : { USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 }, cbBTC: { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8 } };

/** Chainlink price feeds (8 decimals). */
export const FEEDS = {
  ETH_USD: (IS_TESTNET ? "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1" : "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70") as `0x${string}`,
};

export const EXPLORER = CHAIN.blockExplorers.default.url;
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`;
export const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);

export const FAUCETS = {
  usdc: "https://faucet.circle.com",
  eth: "https://portal.cdp.coinbase.com/products/faucet",
};
