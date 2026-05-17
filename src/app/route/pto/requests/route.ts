import { NextRequest } from "next/server";
import { submitRequestHandler, getRequestsHandler } from "@/route/pto/requests";
import { handleRoute } from "@/route/pto/utils";

/** POST /api/pto/requests — submit a time-off request */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const scenario = req.headers.get("x-pto-scenario");
  return handleRoute(() => submitRequestHandler(body, scenario));
}

/** GET /api/pto/requests?employeeId=X */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handleRoute(() =>
    Promise.resolve(getRequestsHandler(searchParams.get("employeeId")))
  );
}
