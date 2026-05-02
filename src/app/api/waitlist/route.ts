import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const waitlistSchema = z.object({
  email: z.string().email(),
  role: z.string().max(120).optional().default(""),
  company: z.string().max(160).optional().default(""),
  useCase: z.string().max(500).optional().default(""),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = waitlistSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid work email and keep fields concise." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true, mode: "demo", message: "Waitlist captured in demo mode. Supabase is not configured." });
  }

  const { error } = await supabase.from("waitlist_signups").insert({
    email: parsed.data.email,
    role: parsed.data.role,
    company: parsed.data.company,
    use_case: parsed.data.useCase,
    source: "landing_page",
  });

  if (error) {
    return NextResponse.json(
      {
        ok: true,
        mode: "schema_missing",
        message: "Supabase is reachable, but the waitlist table may need the included migration. Demo capture succeeded locally.",
        detail: error.message,
      },
      { status: 202 },
    );
  }

  return NextResponse.json({ ok: true, mode: "supabase", message: "You are on the ComplyTrace design-partner list." });
}
