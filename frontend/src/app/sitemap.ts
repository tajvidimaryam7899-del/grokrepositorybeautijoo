import type { MetadataRoute } from 'next';
import { listCategories, searchProfessionals } from '@/lib/public-api';
import { absoluteUrl } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/search',
    '/professionals',
    '/services',
  ].map((path) => ({
    url: absoluteUrl(path || '/'),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));

  let categoryRoutes: MetadataRoute.Sitemap = [];
  let proRoutes: MetadataRoute.Sitemap = [];
  let cityRoutes: MetadataRoute.Sitemap = [];

  try {
    const cats = await listCategories();
    categoryRoutes = cats.map((c) => ({
      url: absoluteUrl(`/categories/${c.slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    /* API unavailable at build — static only */
  }

  try {
    const pros = await searchProfessionals({ page: 1, limit: 50 });
    proRoutes = pros.items.map((p) => ({
      url: absoluteUrl(`/professionals/${p.slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }));
    const cities = new Set<string>();
    for (const p of pros.items) {
      const city = p.locations?.[0]?.location?.city;
      if (city) cities.add(city);
    }
    cityRoutes = [...cities].map((city) => ({
      url: absoluteUrl(`/locations/${encodeURIComponent(city)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch {
    /* ignore */
  }

  return [...staticRoutes, ...categoryRoutes, ...proRoutes, ...cityRoutes];
}
