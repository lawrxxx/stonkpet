import { z } from "zod";
import { ResearchError, runResearch } from "@/lib/server/research";

/** Research with web search can take a minute or two. */
export const maxDuration = 300;

const Input = z.object({
  brief: z.string().trim().min(3).max(600),
  personality: z.enum(["calm", "balanced", "spicy"]),
  maxPct: z.number().min(10).max(60),
  askAboveUsd: z.number().min(0).max(100000),
  exclusions: z.array(z.string().max(12)).max(30).default([]),
});

// Best-effort abuse guard: each call spends real API credit. Per instance, so it's a
// speed bump, not a wall; real per-user limits arrive with sign-in sessions.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 6;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "rate_limited", message: "That's a lot of research. Give me a few minutes." }, { status: 429 });

  let input: z.infer<typeof Input>;
  try { input = Input.parse(await req.json()); }
  catch { return Response.json({ error: "bad_request", message: "That brief didn't come through right." }, { status: 400 }); }

  try {
    const proposal = await runResearch(input);
    return Response.json(proposal);
  } catch (e) {
    if (e instanceof ResearchError) {
      const status = e.code === "not_configured" ? 503 : e.code === "no_match" ? 422 : 502;
      return Response.json({ error: e.code, message: e.friendly }, { status });
    }
    console.error("research failed", e);
    return Response.json({ error: "failed", message: "My research hit a snag. Try again in a minute?" }, { status: 502 });
  }
}
