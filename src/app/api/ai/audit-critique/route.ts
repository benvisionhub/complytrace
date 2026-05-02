import { NextResponse } from "next/server";
import { z } from "zod";
import { demoAgentAuditReport, demoAgentTrace } from "@/lib/demo-data";
import { summarizeTrace } from "@/lib/audit";

const critiqueSchema = z.object({
  focus: z.string().max(200).optional().default("production readiness"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = critiqueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid critique request." }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const traceSummary = summarizeTrace(demoAgentTrace);

  const fallbackCritique =
    "Demo critique: the trace has strong metadata-only posture, explicit redaction evidence, and human approval. Before production, add a named retention owner, incident severity mapping, SOC 2 / model-risk control references, and an SLA proof for pending escalations.";

  if (!apiKey) {
    return NextResponse.json({ ok: true, mode: "demo", critique: fallbackCritique, traceSummary });
  }

  const prompt = `You are critiquing a synthetic AI-agent audit trail for a fintech SaaS demo. Do not request customer data. Focus: ${parsed.data.focus}. Trace summary: ${JSON.stringify(traceSummary)}. Audit report: ${JSON.stringify(demoAgentAuditReport)}. Return 4 concise bullets: strengths, risks, missing evidence, next improvement.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://complytrace.vercel.app",
        "X-Title": "ComplyTrace",
      },
      body: JSON.stringify({
        model: "openai/gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a strict but constructive AI governance reviewer. Keep outputs concise and grounded in provided metadata only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ ok: true, mode: "openrouter-fallback", critique: fallbackCritique, traceSummary });
    }

    const data = await response.json();
    const critique = data?.choices?.[0]?.message?.content ?? "No critique returned.";

    return NextResponse.json({ ok: true, mode: "openrouter", critique, traceSummary });
  } catch {
    return NextResponse.json({ ok: true, mode: "openrouter-fallback", critique: fallbackCritique, traceSummary });
  }
}
