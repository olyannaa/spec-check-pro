import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "pdfkit", "docx"],
  allowedDevOrigins: ["127.0.0.1", "localhost", "::1"],
};

export default nextConfig;
