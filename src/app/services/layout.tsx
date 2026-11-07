import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Moving Services",
  description: "Local and long-distance moving, packing, specialty items, storage, cleaning and more.",
  path: "/services",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
