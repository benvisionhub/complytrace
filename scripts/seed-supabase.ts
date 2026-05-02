import { createClient } from "@supabase/supabase-js";
import { demoTraceEvents } from "../src/lib/demo-data";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows = demoTraceEvents.map((trace) => ({ trace_id: trace.id, trace }));
  const { error } = await supabase.from("demo_traces").upsert(rows, { onConflict: "trace_id" });
  if (error) throw error;
  console.log(`Seeded ${rows.length} synthetic metadata traces.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
