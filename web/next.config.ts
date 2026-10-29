import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Cloud Run image (deploy/Dockerfile.web).
  output: "standalone",
};

export default nextConfig;
