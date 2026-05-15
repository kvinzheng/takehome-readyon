import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReadyOn Time Off",
  description: "Time-off management powered by HCM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 flex flex-col">
        <nav className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-6 px-4 py-3">
            <span className="font-bold text-indigo-600">ReadyOn</span>
            <Link
              href="/employee"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Employee
            </Link>
            <Link
              href="/manager"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Manager
            </Link>
          </div>
        </nav>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
