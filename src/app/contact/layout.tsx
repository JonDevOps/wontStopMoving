import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Contact Us",
  description: "Questions about a move or working with us? Call (650) 569-0584 or email support@wontstopmoving.com.",
  path: "/contact",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
