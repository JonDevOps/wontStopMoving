import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "About Us",
  description: "How Wont Stop Moving works: vetted, independent movers, upfront pricing, online booking, and movers paid only after your move is done.",
  path: "/about",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
