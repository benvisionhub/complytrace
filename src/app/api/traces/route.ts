import { NextResponse } from "next/server";
import { z } from "zod";
import { demoComplianceAuditPacket, simulateComplianceTrace, type TraceSimulationInput } from "@/lib/compliance/product";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const traceSchema = z.object({
  app: z.string().max(120).optional(),
  workflow: z.string().max(160).optional(),
  environment: z.enum(["sandbox", "staging", "production-shadow", "production"]).optional(),
  actionCategory: z.string().max(120).optional(),
  modelProvider: z.string().max(120).optional(),
  modelName: z.string().max(160).optional(),
  prompt: z.string().max(8000).optional(),
  output: z.string().max(8000).optional(),
  toolName: z.string().max(120).optional(),
  toolOperation: z.string().max(120).optional(),
  toolInput: z.unknown().optional(),
  humanApproval: z
    .object({
      reviewerRole: z.string().max(120),
      decision: z.enum(["approved", "rejected", "pending"]),
      evidenceRef: z.string().max(200),
    })
    .optional(),
  policyDecision: z.enum(["allow", "block", "escalate"]).optional(),
  policySeverity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export async function GET() {
  return NextResponse.json({ ok: true, mode: "sdk-demo", packet: demoComplianceAuditPacket });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = traceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid trace payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const packet = await simulateComplianceTrace(parsed.data as TraceSimulationInput);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ ok: true, mode: "sdk-demo-no-supabase", traceId: packet.trace.id, packet });
  }

  const { error } = await supabase.from("agent_traces").insert({
    trace_id: packet.trace.id,
    agent_name: packet.trace.app,
    environment: packet.trace.environment,
    data_mode: packet.trace.dataMode,
    payload: packet.trace,
    audit_packet: packet,
    root_hash: packet.evidence.rootHash,
    risk_label: packet.report.traceSummary.riskLabel,
    risk_score: packet.report.traceSummary.riskScore,
  });

  if (error) {
    return NextResponse.json(
      {
        ok: true,
        mode: "sdk-demo-schema-missing",
        message: "Trace generated. Apply the Supabase migration to persist audit packets.",
        detail: error.message,
        traceId: packet.trace.id,
        packet,
      },
      { status: 202 },
    );
  }

  return NextResponse.json({ ok: true, mode: "supabase", traceId: packet.trace.id, rootHash: packet.evidence.rootHash, packet });
}
