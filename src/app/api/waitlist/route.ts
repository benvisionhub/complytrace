import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const waitlistSchema = z.object({
  email: z.string().email(),
  role: z.string().max(80).optional().default(""),
  company: z.string().max(120).optional().default(""),
  interest: z.string().max(500).optional().default(""),
});

export async function POST(request: Request) {
  const parsed = waitlistSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter a valid work email." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true, mode: "local-demo", message: "Captured in demo mode. Configure Supabase env vars for persistence." });
  }

  const { error } = await supabase.from("waitlist_signups").insert({
    email: parsed.data.email,
    role: parsed.data.role,
    company: parsed.data.company,
    interest: parsed.data.interest,
    source: "mvp-web",
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "Waitlist table is not ready. Apply supabase/migrations/001_initial_schema.sql.", detail: error.code }, { status: 503 });
  }

  return NextResponse.json({ ok: true, message: "You are on the ComplyTrace waitlist." });
}
