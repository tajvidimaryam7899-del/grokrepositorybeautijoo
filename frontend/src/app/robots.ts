import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/panel', '/zibagar', '/admin', '/login', '/register', '/otp'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
