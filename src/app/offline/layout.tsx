import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Offline",
  description: "Offline",
  path: "/offline",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
