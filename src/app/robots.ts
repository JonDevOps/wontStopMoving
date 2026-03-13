import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://wontstopmoving.com'
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Protect all dashboard routes from search engine indexing
      disallow: ['/dashboard/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
