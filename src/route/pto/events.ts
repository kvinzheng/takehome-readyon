import { onBalanceUpdate } from "@/lib/sse-bus";

export function createEventsStream(signal: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const enqueue = (chunk: string) =>
        controller.enqueue(encoder.encode(chunk));

      enqueue("event: connected\ndata: {}\n\n");

      const unsub = onBalanceUpdate((payload) => {
        enqueue(`event: balance-update\ndata: ${JSON.stringify(payload)}\n\n`);
      });

      const ping = setInterval(() => {
        enqueue(": ping\n\n");
      }, 20_000);

      signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsub();
        controller.close();
      });
    },
  });
}
