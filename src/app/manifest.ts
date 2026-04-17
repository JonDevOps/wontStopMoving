import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wont Stop Moving',
    short_name: 'WSM',
    description: 'Moving Made Simple - Nationwide moving excellence across 50 states + Puerto Rico.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1e3a8a',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '192x192 512x512',
        type: 'image/x-icon',
      },
    ],
  }
}
