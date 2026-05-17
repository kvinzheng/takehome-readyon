import { NextRequest } from "next/server";
import { updateRequestHandler, getRequestByIdHandler } from "@/api/pto/requests-id";
import { handleRoute } from "@/api/pto/utils";

/** PATCH /api/pto/requests/:id — Body: { action: "approve" | "deny" } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { action } = await req.json();
  return handleRoute(() => updateRequestHandler(id, action));
}

/** GET /api/pto/requests/:id */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleRoute(() => Promise.resolve(getRequestByIdHandler(id)));
}
