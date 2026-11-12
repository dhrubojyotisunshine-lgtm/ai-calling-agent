import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Separate build folder for previews/tests (NEXT_DIST_DIR=.next-preview) so they never clash with `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Lead imports send up to 10,000 rows to a server action.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
