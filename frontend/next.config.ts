import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Liara builds from the repository root while the Next.js app lives in /frontend.
  // Put the production .next output where Liara's Next runtime expects it: /app/.next.
  distDir: '../.next',
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
