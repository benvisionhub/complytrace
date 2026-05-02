import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sampleTraces } from "@/lib/sample-data";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: true, mode: "static", traces: sampleTraces });
  const { data, error } = await supabase.from("demo_traces").select("trace").order("created_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ ok: true, mode: "static-fallback", traces: sampleTraces, warning: error.code });
  return NextResponse.json({ ok: true, mode: "supabase", traces: data?.map((row) => row.trace) ?? sampleTraces });
}
