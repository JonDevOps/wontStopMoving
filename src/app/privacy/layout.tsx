import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Wont Stop Moving collects, uses and protects your information.",
  path: "/privacy",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
