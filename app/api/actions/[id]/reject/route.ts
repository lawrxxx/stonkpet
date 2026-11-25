import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

/** The user said "hold on". */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  if (me instanceof Response) return me;
  const { id } = await ctx.params;
  const { error } = await db().from("actions")
    .update({ status: "rejected", reason: "You said hold on.", decided_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", me.userId).in("status", ["pending", "approved", "queued"]);
  if (error) throw error;
  return Response.json({ ok: true });
}
