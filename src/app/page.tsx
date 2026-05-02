"use client";

import { useMemo, useState } from "react";
import { generateAuditReport, riskScore, summarizeTraces } from "@/lib/audit";
import { sampleTraces } from "@/lib/sample-data";

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "blue" | "slate" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [critique, setCritique] = useState("");
  const [loading, setLoading] = useState(false);
  const traces = sampleTraces;
  const summary = useMemo(() => summarizeTraces(traces), [traces]);
  const report = useMemo(() => generateAuditReport(traces), [traces]);

  async function joinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Submitting metadata-only waitlist request…");
    const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role: "Compliance / AI governance", interest: "metadata-only AI audit trails" }) });
    const data = await res.json();
    setStatus(data.message || data.error || "Submitted.");
  }

  async function runCritique() {
    setLoading(true);
    setCritique("");
    const res = await fetch("/api/audit-critique", { method: "POST" });
    const data = await res.json();
    setCritique(`[${data.mode}] ${data.critique}`);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
        <div>
          <Badge tone="blue">Metadata-only compliance evidence for fintech AI agents</Badge>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-7xl">Audit trails regulators can inspect. Customer data your app never needs to store.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">ComplyTrace records policy decisions, redaction evidence, human approvals, model metadata, and retention posture — not raw prompts, account records, transaction payloads, or customer financial data.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#demo" className="rounded-full bg-white px-5 py-3 font-semibold text-slate-950">View demo dashboard</a>
            <a href="#waitlist" className="rounded-full border border-white/20 px-5 py-3 font-semibold text-white">Join waitlist</a>
          </div>
          <p className="mt-5 text-sm text-slate-400">Independent project. Not affiliated with or endorsed by JPMorgan Chase & Co. Synthetic demo data only.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="grid grid-cols-2 gap-4">
            {[
              [summary.total, "synthetic traces"],
              [summary.metadataOnly, "metadata-only"],
              [summary.noRawPrompts, "raw prompts stored"],
              [summary.humanApproved, "human approvals"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-slate-900 p-5"><div className="text-4xl font-bold">{label === "raw prompts stored" ? 0 : value}</div><div className="mt-1 text-sm text-slate-400">{label}</div></div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-emerald-400/10 p-5 text-emerald-100 ring-1 ring-emerald-400/20">Evidence pack excludes customer financial data by design. Service-role persistence is server-side only.</div>
        </div>
      </section>

      <section id="demo" className="bg-white px-6 py-16 text-slate-950">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><Badge tone="green">Product demo dashboard</Badge><h2 className="mt-4 text-4xl font-semibold">Trace explorer</h2><p className="mt-3 max-w-3xl text-slate-600">Each row is synthetic metadata: policy outcomes, redaction classification, approval state, model identifier, and retention window.</p></div>
            <button onClick={runCritique} className="rounded-full bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60" disabled={loading}>{loading ? "Running AI critique…" : "Generate AI audit critique"}</button>
          </div>
          {critique && <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-sky-950">{critique}</div>}
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {traces.map((trace) => {
              const score = riskScore(trace);
              return <article key={trace.id} className="rounded-3xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-semibold">{trace.agentName}</h3><p className="mt-1 text-sm text-slate-500">{trace.workflow}</p></div><Badge tone={score < 30 ? "green" : score < 60 ? "amber" : "red"}>Risk {score}</Badge></div>
                <dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between"><dt>Redaction</dt><dd className="font-medium">{trace.redactionClass}</dd></div><div className="flex justify-between"><dt>Environment</dt><dd>{trace.environment}</dd></div><div className="flex justify-between"><dt>Retention</dt><dd>{trace.retentionDays} days</dd></div><div className="flex justify-between"><dt>Raw prompt stored</dt><dd>No</dd></div></dl>
                <div className="mt-5 space-y-2">{trace.policies.map((policy) => <div key={policy.id} className="rounded-xl bg-slate-50 p-3 text-sm"><Badge tone={policy.status === "pass" ? "green" : policy.status === "warn" ? "amber" : "red"}>{policy.status}</Badge><p className="mt-2 font-medium">{policy.name}</p><p className="mt-1 text-slate-600">{policy.evidence}</p></div>)}</div>
              </article>;
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-16 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><Badge tone="blue">Sample audit report</Badge><h2 className="mt-4 text-3xl font-semibold">Audit-ready evidence pack</h2><p className="mt-4 text-slate-600">{report.dataMinimizationStatement}</p><ul className="mt-6 space-y-2 text-sm text-slate-700">{report.evidence.slice(0, 9).map((line) => <li key={line} className="rounded-xl bg-slate-50 p-3">{line}</li>)}</ul><p className="mt-5 font-medium">Recommendation: {report.recommendation}</p></div>
          <div id="waitlist" className="rounded-3xl bg-slate-950 p-8 text-white shadow-sm"><Badge>Pricing / CTA</Badge><h2 className="mt-4 text-3xl font-semibold">Design partner waitlist</h2><p className="mt-4 text-slate-300">Early pricing hypothesis: free synthetic demo, team evidence packs from $499/month, enterprise deployment with private retention controls. No confidential data is requested in this form.</p><form onSubmit={joinWaitlist} className="mt-6 space-y-3"><input aria-label="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="work@email.com" className="w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-slate-950" /><button className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950">Request early access</button></form>{status && <p className="mt-4 text-sm text-emerald-200">{status}</p>}<p className="mt-6 text-xs text-slate-400">We avoid raw prompt/customer-data storage by default; waitlist stores contact metadata only if Supabase is configured.</p></div>
        </div>
      </section>
    </main>
  );
}
