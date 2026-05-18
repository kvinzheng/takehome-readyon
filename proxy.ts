import { auth, getSessionUser } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { role } = getSessionUser(session);

  // Managers may visit /employee (read-only employee view). Employees may not
  // visit /manager.
  if (pathname.startsWith("/manager") && role !== "manager") {
    return NextResponse.redirect(new URL("/employee", req.url));
  }
});

export const config = {
  matcher: ["/employee", "/manager"],
};
