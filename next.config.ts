import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    ADMIN_PATH: process.env.ADMIN_PATH ?? "/admin",
  },
  reactStrictMode: true,
};

export default nextConfig;
