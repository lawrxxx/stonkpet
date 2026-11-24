import { priceBoard } from "@/lib/server/prices";

/** Live prices + market state. Cached at the edge for 60s; prices only move on 0.5% deviations anyway. */
export async function GET() {
  const board = await priceBoard();
  return Response.json(board, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=120" } });
}
