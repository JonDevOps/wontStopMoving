import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Find Independent Movers",
  description: "Browse vetted, independent moving professionals and book directly. Your mover is paid only after the job is done.",
  path: "/marketplace",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
