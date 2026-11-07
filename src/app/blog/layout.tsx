import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Moving Tips & Guides",
  description: "Practical moving guides: packing, planning, long-distance moves, moving with kids and pets, and settling into a new home.",
  path: "/blog",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
