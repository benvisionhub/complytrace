import { NextResponse } from "next/server";
import { generateAuditReport } from "@/lib/audit";
import { sampleTraces } from "@/lib/sample-data";

export async function POST() {
  const report = generateAuditReport(sampleTraces);
  const apiKey = process.env.OPENROUTER_API_KEY;
  const fallback = {
    ok: true,
    mode: "deterministic-fallback",
    critique:
      "Synthetic metadata shows a strong minimization posture: no raw prompts, no customer financial data, explicit redaction evidence, and human approvals. Improve readiness by tightening the pending fraud-review SLA and adding retention-owner attestations to each evidence pack.",
    report,
  };

  if (!apiKey) return NextResponse.json(fallback);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://complytrace.local",
        "X-Title": "ComplyTrace MVP",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a compliance auditor. Critique only the synthetic metadata evidence pack. Do not request or infer customer financial data, raw prompts, PII, or confidential payloads. Return concise audit-ready bullets.",
          },
          { role: "user", content: JSON.stringify(report).slice(0, 6000) },
        ],
        max_tokens: 350,
        temperature: 0.2,
      }),
    });

    if (!response.ok) return NextResponse.json({ ...fallback, mode: "openrouter-error-fallback" });
    const data = await response.json();
    const critique = data?.choices?.[0]?.message?.content ?? fallback.critique;
    return NextResponse.json({ ok: true, mode: "openrouter", critique, report });
  } catch {
    return NextResponse.json(fallback);
  }
}
