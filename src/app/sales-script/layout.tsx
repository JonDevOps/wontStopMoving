import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Sales Script",
  description: "Sales Script",
  path: "/sales-script",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
