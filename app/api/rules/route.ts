import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

/** Update autopilot settings (currently: after-hours trading). Stored in rules.autopilot. */
const Body = z.object({ tradeAfterHours: z.boolean() });

export async function POST(req: Request) {
  const me = await requireUser();
  if (me instanceof Response) return me;
  let b: z.infer<typeof Body>;
  try { b = Body.parse(await req.json()); } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }
  const d = db();
  const { data: r } = await d.from("rules").select("autopilot").eq("user_id", me.userId).maybeSingle();
  const autopilot = { ...(r?.autopilot ?? {}), afterHours: b.tradeAfterHours };
  const { error } = await d.from("rules").upsert({ user_id: me.userId, autopilot, updated_at: new Date().toISOString() });
  if (error) throw error;
  await d.from("activity").insert({ user_id: me.userId, title: b.tradeAfterHours ? "After-hours trading on" : "After-hours trading off", detail: b.tradeAfterHours ? "I can trade while the market's closed, at exchange prices within 2% of the last close. I'll always ask first." : "Back to market hours only." });
  return Response.json({ ok: true, tradeAfterHours: b.tradeAfterHours });
}
