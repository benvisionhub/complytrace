import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAgentTrace } from "@/lib/demo-data";
import { summarizeTrace } from "@/lib/audit";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const traceSchema = z.object({
  trace: z.unknown().optional(),
});

export async function GET() {
  return NextResponse.json({ ok: true, trace: demoAgentTrace, summary: summarizeTrace(demoAgentTrace) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = traceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid trace payload." }, { status: 400 });
  }

  const trace = parsed.data.trace ?? demoAgentTrace;
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ ok: true, mode: "demo", traceId: demoAgentTrace.id });
  }

  const { error } = await supabase.from("agent_traces").insert({
    trace_id: demoAgentTrace.id,
    agent_name: demoAgentTrace.agentName,
    environment: demoAgentTrace.environment,
    data_mode: demoAgentTrace.dataMode,
    payload: trace,
  });

  if (error) {
    return NextResponse.json(
      { ok: true, mode: "schema_missing", message: "Supabase reachable; apply migration to persist traces.", detail: error.message },
      { status: 202 },
    );
  }

  return NextResponse.json({ ok: true, mode: "supabase", traceId: demoAgentTrace.id });
}
