import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    ADMIN_PATH: process.env.ADMIN_PATH ?? "/admin",
  },
  experimental: {
    // Keep recently visited pages in the client router cache so repeat
    // navigations render instantly instead of re-requesting the server.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  async headers() {
    return [
      {
        source: "/preview/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  reactStrictMode: true,
};

export default nextConfig;
