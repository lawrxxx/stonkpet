import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

/**
 * Save an approved plan with the rules and pet it was made under.
 * Weights are re-validated here; the client can't sneak in a position over the max.
 */
const Body = z.object({
  brief: z.string().trim().min(3).max(600),
  pet: z.object({ name: z.string().trim().min(1).max(14), personality: z.enum(["calm", "balanced", "spicy"]) }),
  rules: z.object({ maxPct: z.number().int().min(10).max(60), askAboveUsd: z.number().min(0).max(100000), excluded: z.array(z.string().max(12)).max(50) }),
  plan: z.object({
    theme: z.string().max(80),
    weights: z.record(z.string().max(12), z.number().min(0).max(1)),
    cash: z.number().min(0).max(1),
    lead: z.string().max(12),
    priceSource: z.record(z.string(), z.enum(["chainlink", "dex"])).default({}),
    flags: z.array(z.unknown()).default([]),
    facts: z.array(z.unknown()).default([]),
    assumptions: z.array(z.string()).default([]),
    opinions: z.array(z.string()).default([]),
    reasons: z.record(z.string(), z.string()).default({}),
    model: z.string().nullable().default(null),
  }),
});

export async function POST(req: Request) {
  const me = await requireUser();
  if (me instanceof Response) return me;
  let b: z.infer<typeof Body>;
  try { b = Body.parse(await req.json()); } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }

  const over = Object.entries(b.plan.weights).find(([, w]) => w * 100 > b.rules.maxPct + 1e-6);
  if (over) return Response.json({ error: "over_max", message: `${over[0]} is over your ${b.rules.maxPct}% max.` }, { status: 422 });
  const excluded = Object.keys(b.plan.weights).find((t) => b.rules.excluded.includes(t));
  if (excluded) return Response.json({ error: "excluded", message: `${excluded} is on your never-buy list.` }, { status: 422 });

  const d = db();
  const now = new Date().toISOString();
  const { data: brief, error: e1 } = await d.from("briefs").insert({ user_id: me.userId, text: b.brief }).select("id").single();
  if (e1) throw e1;
  await d.from("plans").update({ status: "superseded" }).eq("user_id", me.userId).eq("status", "approved");
  const p = b.plan;
  const { data: plan, error: e2 } = await d.from("plans").insert({
    user_id: me.userId, brief_id: brief.id, status: "approved", approved_at: now,
    theme: p.theme, weights: p.weights, cash: p.cash, lead: p.lead, price_source: p.priceSource,
    flags: p.flags, facts: p.facts, assumptions: p.assumptions, opinions: p.opinions, reasons: p.reasons, model: p.model,
  }).select("id").single();
  if (e2) throw e2;
  await d.from("rules").upsert({ user_id: me.userId, max_pct: b.rules.maxPct, ask_above_usd: b.rules.askAboveUsd, excluded: b.rules.excluded, updated_at: now });
  await d.from("pets").upsert({ user_id: me.userId, name: b.pet.name, personality: b.pet.personality, updated_at: now });
  await d.from("activity").insert({ user_id: me.userId, title: "Made your plan", detail: `You said it looked good: ${p.theme}.` });
  return Response.json({ planId: plan.id });
}
