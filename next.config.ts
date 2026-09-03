import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf"],
  allowedDevOrigins: ["127.0.0.1", "localhost", "::1"],
};

export default nextConfig;
