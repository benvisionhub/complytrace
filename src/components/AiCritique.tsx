"use client";

import { useState } from "react";

export function AiCritique() {
  const [critique, setCritique] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runCritique() {
    setLoading(true);
    setCritique(null);
    const response = await fetch("/api/ai/audit-critique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focus: "production readiness and missing audit evidence" }),
    });
    const data = await response.json();
    setCritique(data.critique ?? data.error ?? "No critique returned.");
    setLoading(false);
  }

  return (
    <div className="rounded-3xl border border-indigo-400/20 bg-indigo-950/40 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-200">OpenRouter review</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Ask AI to critique this audit pack</h3>
          <p className="mt-2 text-sm text-indigo-100/80">Uses only synthetic trace metadata and the generated audit summary.</p>
        </div>
        <button onClick={runCritique} disabled={loading} className="rounded-2xl bg-white px-5 py-3 font-semibold text-indigo-950 hover:bg-indigo-100 disabled:opacity-60">
          {loading ? "Reviewing..." : "Run critique"}
        </button>
      </div>
      {critique ? <pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">{critique}</pre> : null}
    </div>
  );
}
