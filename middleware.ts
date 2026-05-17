import { auth, getSessionUser } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { role } = getSessionUser(session);

  if (pathname.startsWith("/employee") && role !== "employee") {
    return NextResponse.redirect(new URL("/manager", req.url));
  }

  if (pathname.startsWith("/manager") && role !== "manager") {
    return NextResponse.redirect(new URL("/employee", req.url));
  }
});

export const config = {
  matcher: ["/employee/:path*", "/manager/:path*"],
};
