// Measures LCP/FCP/TTFB on /login (the unauth landing page) using Playwright +
// the browser's PerformanceObserver. Run against a production build:
//
//   npm run build && npx next start -p 3100 &
//   node scripts/measure-lcp.mjs
//
// Outputs the three Core Web Vitals timings in milliseconds.

import { chromium } from "playwright";

const URL = process.env.MEASURE_URL ?? "http://localhost:3100/login";
const RUNS = Number(process.env.MEASURE_RUNS ?? 5);

const samples = [];

for (let i = 0; i < RUNS; i++) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: "load" });

  const metrics = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const out = { lcp: 0, fcp: 0, ttfb: 0 };
        const nav = performance.getEntriesByType("navigation")[0];
        if (nav) out.ttfb = nav.responseStart - nav.requestStart;

        const fcpEntry = performance
          .getEntriesByType("paint")
          .find((p) => p.name === "first-contentful-paint");
        if (fcpEntry) out.fcp = fcpEntry.startTime;

        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          out.lcp = entries[entries.length - 1].startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });

        // Wait a beat so the LCP observer has a chance to fire.
        setTimeout(() => resolve(out), 500);
      })
  );

  samples.push(metrics);
  await browser.close();
}

const avg = (k) =>
  Math.round(samples.reduce((s, m) => s + m[k], 0) / samples.length);

console.log(
  JSON.stringify(
    {
      url: URL,
      runs: RUNS,
      ttfb_ms: avg("ttfb"),
      fcp_ms: avg("fcp"),
      lcp_ms: avg("lcp"),
      samples,
    },
    null,
    2
  )
);
