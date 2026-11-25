import type {NextConfig} from 'next';

// Security headers for every response. The CSP is deliberately minimal
// (no framing, no plugins, no <base> hijacking) so it can't break Stripe,
// Firebase Auth popups or Genkit.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // `npm run dev:local` only: send the browser's Firebase emulator traffic through
  // this server, so the whole app runs on one origin (some browsers and embedded
  // panes block a page from calling other localhost ports).
  async rewrites() {
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true') return [];
    return [
      { source: '/identitytoolkit.googleapis.com/:path*', destination: 'http://127.0.0.1:9199/identitytoolkit.googleapis.com/:path*' },
      { source: '/securetoken.googleapis.com/:path*', destination: 'http://127.0.0.1:9199/securetoken.googleapis.com/:path*' },
      { source: '/emulator/:path*', destination: 'http://127.0.0.1:9199/emulator/:path*' },
      { source: '/google.firestore.v1.Firestore/:path*', destination: 'http://127.0.0.1:8180/google.firestore.v1.Firestore/:path*' },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
