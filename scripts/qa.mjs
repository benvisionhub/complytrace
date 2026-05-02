import { chromium } from "playwright";

const url = process.env.QA_URL || "http://localhost:3000";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (msg) => {
  if (["error", "warning"].includes(msg.type())) consoleErrors.push(`${msg.type()}: ${msg.text()}`);
});
page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

await page.goto(url, { waitUntil: "networkidle" });
const title = await page.title();
const h1 = await page.locator("h1").textContent();
await page.getByRole("link", { name: /View live demo/i }).click();
await page.getByRole("button", { name: /Run critique/i }).click();
await page.locator("text=Ask AI to critique this audit pack").waitFor({ timeout: 10000 });
await page.locator("pre").last().waitFor({ timeout: 30000 });
const critique = (await page.locator("pre").last().textContent())?.slice(0, 220);
await page.getByPlaceholder("work email").fill("qa+synthetic@complytrace.example");
await page.getByRole("button", { name: /Join design partner list/i }).click();
await page.waitForSelector("text=/design-partner|Supabase|captured|table|schema/i", { timeout: 20000 });
const formStatus = (await page.locator("text=/design-partner|Supabase|captured|table|schema/i").last().textContent())?.slice(0, 220);
const apiChecks = await page.evaluate(async () => {
  const traceResponse = await fetch("/api/traces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workflow: "qa-browser-refund",
      actionCategory: "refund",
      prompt: "qa@example.com ssn 123-45-6789 card 4242 4242 4242 4242",
      toolInput: { customerEmail: "qa@example.com", accountNumber: "000111222333" },
    }),
  });
  const traceJson = await traceResponse.json();
  const traceText = JSON.stringify(traceJson);
  return {
    traceStatus: traceResponse.status,
    traceOk: traceJson.ok === true,
    riskLabel: traceJson.packet?.report?.traceSummary?.riskLabel,
    rootHashLength: traceJson.packet?.evidence?.rootHash?.length,
    hashChainValid: traceJson.packet?.evidence?.hashChainValid,
    leakedSecrets: ["qa@example.com", "123-45-6789", "4242 4242 4242 4242", "000111222333"].filter((secret) => traceText.includes(secret)),
  };
});
await page.setViewportSize({ width: 390, height: 900 });
await page.goto(url, { waitUntil: "networkidle" });
const mobileH1Visible = await page.locator("h1").isVisible();
console.log(JSON.stringify({ title, h1, critique, formStatus, apiChecks, mobileH1Visible, consoleErrors }, null, 2));
await browser.close();
