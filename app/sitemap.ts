import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://dripmetric.com',
      lastModified: '2026-05-24',
      priority: 1.0,
    },
    {
      url: 'https://dripmetric.com/docs',
      lastModified: '2026-05-24',
      priority: 0.8,
    },
  ]
}
