import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "base-uri 'self'; frame-ancestors 'self'; object-src 'none'" },
        ],
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
    // Large LMS packages are uploaded via multipart/form-data on API routes.
    // Next.js proxies request bodies through middleware and defaults to ~10MB.
    // Raise this limit so TinCan/iSpring zip uploads do not fail at 10MB.
    proxyClientMaxBodySize: '100mb',
  },
};

export default nextConfig;
