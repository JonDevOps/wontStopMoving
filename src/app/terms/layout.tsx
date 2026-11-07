import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Terms of Service",
  description: "The terms for using Wont Stop Moving and booking moves through our platform.",
  path: "/terms",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
