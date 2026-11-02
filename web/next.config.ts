import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Lead imports send up to 10,000 rows to a server action.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
