import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://wontstopmoving.com'
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/employee/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
