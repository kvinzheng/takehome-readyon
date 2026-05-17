import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { auth, getSessionUser } from "@/auth";
import { logout } from "@/app/actions";
import { Providers } from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReadyOn Time Off",
  description: "Time-off request management",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const sessionUser = session ? getSessionUser(session) : null;

  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 flex flex-col">
        <Providers session={session}>
        <nav className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3">
            <span className="font-bold text-indigo-600">ReadyOn</span>
            {sessionUser && (
              <>
                <span className="text-sm text-gray-600">{sessionUser.name}</span>
                <span className="text-xs text-gray-400 capitalize">{sessionUser.role}</span>
                <form action={logout} className="ml-auto">
                  <button
                    type="submit"
                    className="text-sm font-medium text-gray-500 hover:text-gray-900"
                  >
                    Sign out
                  </button>
                </form>
              </>
            )}
          </div>
        </nav>
        {children}
        </Providers>
      </body>
    </html>
  );
}
