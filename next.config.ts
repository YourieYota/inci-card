import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Autoriser l'accès depuis l'IP locale pour le développement
  allowedDevOrigins: ["10.153.255.238", "localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Autoriser les images servies par le pont Canon (localhost:4000/photos/)
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
        pathname: '/photos/**',
      },
    ],
  },

  // Headers HTTP
  async headers() {
    return [
      // ── Content Security Policy global ──────────────────────────────────────
      // Autorise les images du pont Canon (localhost:4000/photos/) dans les <img>
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              // Autoriser les images depuis : self, data: (Base64), blob: (canvas), localhost:4000 (pont Canon)
              "img-src 'self' data: blob: http://localhost:4000",
              "connect-src 'self' http://localhost:4000 ws://localhost:3000",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
      // ── Service Worker PWA ───────────────────────────────────────────────────
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/manifest+json; charset=utf-8",
          },
        ],
      },
    ];
  },

};

export default nextConfig;
