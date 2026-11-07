import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Service Areas",
  description: "Find movers in your state or city across the United States, Puerto Rico and Canada.",
  path: "/locations",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
