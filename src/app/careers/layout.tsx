import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Careers",
  description: "Join Wont Stop Moving as a mover, crew member or independent moving professional.",
  path: "/careers",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
