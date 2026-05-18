import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake date-fns barrel imports into per-function imports so the
  // client bundle only includes the helpers actually used (`format`).
  experimental: {
    optimizePackageImports: ["date-fns"],
  },
};

export default nextConfig;
