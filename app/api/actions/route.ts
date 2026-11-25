import { z } from "zod";
import { tradingLive } from "@/lib/deployment";
import { check } from "@/lib/rules";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { portfolio } from "@/lib/server/portfolio";
import { loadUser, snapshotFor } from "@/lib/server/trade";

/**
 * Propose a money-moving action. The rules engine runs here, on real onchain balances
 * and live prices, before anything is created. Nothing is sent onchain from this route;
 * see /api/actions/[id]/approve.
 */
const Body = z.object({
  type: z.literal("feed"),
  amountUsd: z.number().positive().max(100000),
  source: z.enum(["ui", "chat", "autopilot"]).default("ui"),
});

export async function POST(req: Request) {
  const me = await requireUser();
  if (me instanceof Response) return me;
  if (!tradingLive()) return Response.json({ error: "not_live", message: "Real buys aren't switched on yet." }, { status: 503 });
  let b: z.infer<typeof Body>;
  try { b = Body.parse(await req.json()); } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }

  const u = await loadUser(me.userId);
  if (!u.plan) return Response.json({ error: "no_plan", message: "Make a plan first, then feed me." }, { status: 409 });

  const pf = await portfolio(me.address);
  const action = { type: "feed" as const, amountUsd: Math.round(b.amountUsd * 100) / 100 };
  const v = check(action, snapshotFor(pf, u));

  const row = {
    user_id: me.userId, plan_id: u.plan.id, type: action.type, params: action, source: b.source,
    status: !v.ok ? "rejected" : v.queueUntilOpen ? "queued" : "pending",
    reason: v.ok ? null : v.reason,
  };
  const { data, error } = await db().from("actions").insert(row).select("id").single();
  if (error) throw error;

  if (!v.ok) return Response.json({ id: data.id, ok: false, code: v.code, reason: v.reason }, { status: 200 });
  return Response.json({ id: data.id, ok: true, needsApproval: v.needsApproval, queueUntilOpen: v.queueUntilOpen, notes: v.notes });
}
