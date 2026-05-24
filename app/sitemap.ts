import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: 'https://dripmetric.com',
      lastModified,
    },
    {
      url: 'https://dripmetric.com/docs',
      lastModified,
    },
    {
      url: 'https://dripmetric.com/privacy',
      lastModified,
    },
    {
      url: 'https://dripmetric.com/terms',
      lastModified,
    },
    {
      url: 'https://dripmetric.com/login',
      lastModified,
    },
    {
      url: 'https://dripmetric.com/unsubscribe',
      lastModified,
    },
  ]
}
