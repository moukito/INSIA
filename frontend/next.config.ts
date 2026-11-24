import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /*ajout*/
  async rewrites() {
    return [
      {
        source: "/api/orientation/:path*",
        destination: "http://127.0.0.1:8000/api/orientation/:path*",
      },
    ];
  },
};

export default nextConfig;