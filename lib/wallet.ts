"use client";
import { useCallback } from "react";
import { erc20Abi, formatUnits, parseAbi, type Hex } from "viem";
import { useBalance, useConnect, useConnection, useConnectors, useDisconnect, useReadContract, useSendCalls, useWaitForCallsStatus } from "wagmi";
import { DATA_SUFFIX } from "./builderCode";
import { CHAIN, FEEDS, TOKENS } from "./chain";

/** Passkey sign-in with Base Account. */
export function useWallet() {
  const { address, status } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const signIn = useCallback(async () => {
    const c = connectors[0];
    if (!c) throw new Error("No wallet connector");
    await connect.mutateAsync({ connector: c, chainId: CHAIN.id });
  }, [connectors, connect]);
  return {
    address,
    connected: status === "connected" && !!address,
    connecting: status === "connecting" || status === "reconnecting" || connect.isPending,
    error: connect.error,
    signIn,
    signOut: () => disconnect.mutate(),
  };
}

const feedAbi = parseAbi(["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"]);
/** Chainlink ETH/USD. Returns null when stale (> 2h) so we never show a made-up value. */
export function useEthUsd() {
  const r = useReadContract({ address: FEEDS.ETH_USD, abi: feedAbi, functionName: "latestRoundData", query: { refetchInterval: 60_000 } });
  if (!r.data) return null;
  const [, answer, , updatedAt] = r.data;
  if (Date.now() / 1000 - Number(updatedAt) > 2 * 3600) return null;
  return Number(answer) / 1e8;
}

export type Balances = { USDC: number | null; ETH: number | null; ETHusd: number | null; cbBTC: number | null; loading: boolean };

/** Real balances on the configured chain. null = unknown (not loaded / not on this network). */
export function useBalances(address?: `0x${string}`): Balances {
  const q = { enabled: !!address, refetchInterval: 15_000 };
  const eth = useBalance({ address, query: q });
  const usdc = useReadContract({ address: TOKENS.USDC.address, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: q });
  const cb = useReadContract({ address: TOKENS.cbBTC?.address, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: { ...q, enabled: !!address && !!TOKENS.cbBTC } });
  const px = useEthUsd();
  const ETH = eth.data ? Number(formatUnits(eth.data.value, 18)) : null;
  return {
    USDC: usdc.data !== undefined ? Number(formatUnits(usdc.data, TOKENS.USDC.decimals)) : null,
    ETH,
    ETHusd: ETH !== null && px !== null ? ETH * px : null,
    cbBTC: TOKENS.cbBTC && cb.data !== undefined ? Number(formatUnits(cb.data, TOKENS.cbBTC.decimals)) : null,
    loading: eth.isLoading || usdc.isLoading,
  };
}

export type Call = { to: `0x${string}`; data?: Hex; value?: bigint };

/**
 * Every transaction the app sends goes through here: gas sponsored by the CDP
 * Paymaster (via our /api/paymaster proxy) and tagged with our Builder Code.
 */
export function useSponsoredCalls() {
  const send = useSendCalls();
  const status = useWaitForCallsStatus({ id: send.data?.id, query: { enabled: !!send.data?.id } });
  const sendCalls = useCallback(
    async (calls: Call[]) => {
      const capabilities: Record<string, unknown> = {
        paymasterService: { url: `${window.location.origin}/api/paymaster` },
      };
      if (DATA_SUFFIX) capabilities.dataSuffix = { value: DATA_SUFFIX, optional: true };
      return send.mutateAsync({ calls, chainId: CHAIN.id, capabilities });
    },
    [send],
  );
  const receipt = status.data?.receipts?.[0];
  return {
    sendCalls,
    pending: send.isPending || (!!send.data && status.isLoading),
    error: send.error || status.error,
    txHash: receipt?.transactionHash as `0x${string}` | undefined,
    success: status.data?.status === "success",
    reset: send.reset,
  };
}
