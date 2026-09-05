import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Liara runs the repository root install before invoking this build.
  // Force Next.js to treat `frontend` as the tracing/package root so the
  // standalone server is emitted at frontend/.next/standalone/server.js
  // instead of frontend/.next/standalone/frontend/server.js.
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
