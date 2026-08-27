import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Liara builds from the repository root while the Next.js app lives in /frontend.
  // Keep the production output at repository-root .next so Liara's Next runtime can copy it.
  distDir: '../.next',
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
