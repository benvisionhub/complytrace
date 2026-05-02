import { AiCritique } from "@/components/AiCritique";
import { WaitlistForm } from "@/components/WaitlistForm";
import { demoAgentAuditReport, demoAgentTrace, demoEvidencePack, demoTraceEvents } from "@/lib/demo-data";
import { riskScore, summarizeTrace } from "@/lib/audit";

const summary = summarizeTrace(demoAgentTrace);
const stats = [
  ["Events captured", summary.totalEvents.toString()],
  ["Policy checks", summary.policyChecks.toString()],
  ["Human approvals", summary.humanApprovals.toString()],
  ["Data mode", "Metadata-only"],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden px-6 py-8 sm:px-10 lg:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.25),transparent_30%),radial-gradient(circle_at_70%_20%,rgba(99,102,241,0.2),transparent_25%)]" />
        <div className="relative mx-auto max-w-7xl">
          <nav className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-300 font-black text-slate-950">CT</div>
              <span className="font-semibold tracking-tight">ComplyTrace</span>
            </div>
            <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <a href="#demo">Demo</a>
              <a href="#audit">Audit pack</a>
              <a href="#pricing">Pricing</a>
              <a href="#waitlist" className="rounded-full border border-cyan-300/40 px-4 py-2 text-cyan-100">Design partner</a>
            </div>
          </nav>

          <div className="grid gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
                Metadata-only audit trails for regulated AI agents
              </div>
              <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">
                Ship fintech AI agents with evidence compliance can inspect.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                ComplyTrace records model calls, tool calls, redaction posture, policy decisions, and human approvals — without storing customer financial data, raw prompts, KYC documents, or transaction payloads by default.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#demo" className="rounded-2xl bg-cyan-300 px-6 py-4 text-center font-semibold text-slate-950 hover:bg-cyan-200">View live demo</a>
                <a href="#waitlist" className="rounded-2xl border border-slate-700 px-6 py-4 text-center font-semibold text-white hover:border-cyan-300">Join design partners</a>
              </div>
              <p className="mt-5 text-xs text-slate-500">Independent project. Not affiliated with or endorsed by JPMorgan Chase & Co. Demo uses synthetic metadata only.</p>
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-cyan-950/40">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <p className="text-sm text-slate-400">Trace</p>
                  <h2 className="text-xl font-semibold">{demoAgentTrace.id}</h2>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">{summary.redactionPosture}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {stats.map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-950 p-4">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {demoAgentTrace.events.slice(0, 5).map((event) => (
                  <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-200">{event.type.replaceAll("_", " ")}</p>
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{event.severity}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{event.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">Product demo</p>
            <h2 className="mt-3 text-4xl font-semibold">A compliance flight recorder for agent runs.</h2>
            <p className="mt-4 text-slate-300">The demo shows a synthetic refund-review agent that escalates a decision, records redaction evidence, and captures human approval.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {demoTraceEvents.map((event) => {
              const score = riskScore(event);
              return (
                <div key={event.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400">{event.workflow}</p>
                      <h3 className="mt-2 text-xl font-semibold">{event.agentName}</h3>
                    </div>
                    <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">{score}</span>
                  </div>
                  <div className="mt-5 space-y-2 text-sm text-slate-300">
                    <p>Model: {event.modelProvider} / {event.modelName}</p>
                    <p>Raw prompt stored: {event.rawPromptStored ? "yes" : "no"}</p>
                    <p>Customer data stored: {event.customerDataStored ? "yes" : "no"}</p>
                    <p>Retention: {event.retentionDays} days</p>
                  </div>
                  <div className="mt-5 space-y-2">
                    {event.policies.map((policy) => (
                      <div key={policy.id} className="rounded-2xl bg-slate-950 p-3 text-sm">
                        <span className="font-semibold text-cyan-100">{policy.status.toUpperCase()}</span> {policy.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="audit" className="px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">Audit pack</p>
            <h2 className="mt-3 text-4xl font-semibold">Evidence, not vibes.</h2>
            <p className="mt-4 text-slate-300">ComplyTrace turns runtime metadata into artifacts security, compliance, model risk, and internal audit can inspect.</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-2xl font-semibold">{demoAgentAuditReport.title}</h3>
            <p className="mt-4 leading-7 text-slate-300">{demoAgentAuditReport.executiveSummary}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {demoAgentAuditReport.evidenceChecklist.map((item) => (
                <div key={item} className="rounded-2xl bg-slate-950 p-4 text-sm text-slate-200">✓ {item}</div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Data minimization statement</p>
              <p className="mt-2">{demoAgentAuditReport.dataMinimizationStatement}</p>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Evidence pack rollup</p>
              <p className="mt-2">{demoEvidencePack.dataMinimizationStatement}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <AiCritique />
        </div>
      </section>

      <section id="pricing" className="px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-cyan-300/20 bg-cyan-300/10 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-100">Design partner pricing</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            {[
              ["Pilot", "$500/mo", "One sandbox agent, audit report template, hands-on onboarding."],
              ["Startup", "$1.5k/mo", "Five agents, Supabase-backed evidence store, team reports."],
              ["Regulated", "Custom", "VPC/local collector, SSO, retention policies, custom controls."],
            ].map(([name, price, description]) => (
              <div key={name} className="rounded-3xl bg-slate-950 p-6">
                <h3 className="text-2xl font-semibold">{name}</h3>
                <p className="mt-3 text-3xl font-bold text-cyan-200">{price}</p>
                <p className="mt-3 text-slate-300">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="waitlist" className="px-6 py-20 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">Get involved</p>
            <h2 className="mt-3 text-4xl font-semibold">Bring one AI-agent workflow. We’ll map the evidence pack.</h2>
            <p className="mt-4 text-slate-300">Best fit: AI SaaS selling into financial services, fintech startups deploying internal agents, and regulated teams needing metadata-only evidence.</p>
          </div>
          <WaitlistForm />
        </div>
      </section>
    </main>
  );
}
