import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The GCS client is loaded on the server only, inside the routes that need it.
  serverExternalPackages: ["@google-cloud/storage"],
};

export default nextConfig;
