import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Autoriser l'accès depuis l'IP locale pour le développement
  allowedDevOrigins: ["10.153.255.238", "localhost"],
};

export default nextConfig;
