"use client";
import dynamic from "next/dynamic";

/**
 * The wallet stack only runs in the browser. Loading it client-only keeps the
 * Base Account SDK's Node entry (which pulls in the CDP server SDK) out of the
 * server bundle. The Shell already waits for hydration before rendering screens.
 */
export const ClientProviders = dynamic(() => import("./Providers").then((m) => m.Providers), { ssr: false });
