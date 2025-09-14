import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration for Turbopack (experimental)
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
