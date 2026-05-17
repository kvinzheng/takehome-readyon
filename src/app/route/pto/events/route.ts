import { NextRequest } from "next/server";
import { createEventsStream } from "@/route/pto/events";

export const dynamic = "force-dynamic";

/** GET /route/pto/events — SSE stream for real-time balance updates */
export async function GET(request: NextRequest) {
  const stream = createEventsStream(request.signal);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
