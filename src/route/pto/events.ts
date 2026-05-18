import { onPtoUpdate } from "@/lib/sse-bus";

export function createEventsStream(signal: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const enqueue = (chunk: string) =>
        controller.enqueue(encoder.encode(chunk));

      enqueue("event: connected\ndata: {}\n\n");

      const unsub = onPtoUpdate((payload) => {
        // Emit BOTH the new generic event and the legacy balance-update name
        // so older clients keep working during rollout.
        const data = JSON.stringify(payload);
        enqueue(`event: pto-update\ndata: ${data}\n\n`);
        enqueue(`event: balance-update\ndata: ${data}\n\n`);
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
