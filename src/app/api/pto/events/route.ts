import { NextRequest } from "next/server";
import { onBalanceUpdate } from "@/lib/sse-bus";

/**
 * GET /api/pto/events
 *
 * Server-Sent Events stream. Each connected browser tab opens one persistent
 * HTTP connection here. When the anniversary-bonus route fires, it emits a
 * "balance-update" event on the SSE bus; this handler pushes it down to every
 * connected client. The client then calls router.refresh() so Next.js
 * re-renders the Server Component with the fresh balance — no polling needed.
 *
 * SSE vs long-polling:
 *   - Long polling: client closes + re-opens the connection after each response.
 *   - SSE: one persistent connection; server pushes frames as they happen.
 *     The browser's EventSource API handles reconnection automatically.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (chunk: string) =>
        controller.enqueue(encoder.encode(chunk));

      // Initial handshake so the client knows the connection is live
      enqueue("event: connected\ndata: {}\n\n");

      // Push a balance-update frame whenever the bus fires
      const unsub = onBalanceUpdate((payload) => {
        enqueue(`event: balance-update\ndata: ${JSON.stringify(payload)}\n\n`);
      });

      // Keep-alive comment every 20 s — prevents proxies from closing idle connections
      const ping = setInterval(() => {
        enqueue(": ping\n\n");
      }, 20_000);

      // Clean up when the client navigates away or closes the tab
      request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsub();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
