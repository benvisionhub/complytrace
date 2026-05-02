"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [useCase, setUseCase] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, company, role, useCase }),
    });
    const data = await response.json();
    setStatus(data.message ?? (data.ok ? "Captured." : data.error ?? "Something went wrong."));
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-cyan-950/30">
      <div className="grid gap-3 sm:grid-cols-2">
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="work email" className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="company" className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="role" className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" />
        <input value={useCase} onChange={(e) => setUseCase(e.target.value)} placeholder="agent workflow to audit" className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" />
      </div>
      <button disabled={loading} className="mt-4 w-full rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-60">
        {loading ? "Saving..." : "Join design partner list"}
      </button>
      {status ? <p data-testid="waitlist-status" aria-live="polite" className="mt-3 text-sm text-cyan-100">{status}</p> : null}
    </form>
  );
}
